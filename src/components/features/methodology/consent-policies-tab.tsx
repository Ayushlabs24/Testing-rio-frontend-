"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Send,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FormattedDate } from "@/components/common/formatted-date";
import { RejectReasonDialog } from "@/components/features/sharing/reject-reason-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermission } from "@/hooks/use-permission";
import { consentService } from "@/services/consent/consent.service";
import { consentPolicyTextFor } from "@/services/consent/consent.types";
import { resolveApiErrorMessage } from "@/lib/api-error-message";
import type {
  ConsentKind,
  ConsentLocale,
  ConsentPolicyStatus,
  ConsentPolicyVersion,
  ConsentPolicyVersionList,
} from "@/services/consent/consent.types";

/**
 * Client-confirmed (2026-08-27), superseding V1's hardcoded consent text:
 * the Terms of Use and Data Sharing Policy shown at signup are "dynamically
 * managed and versioned ... not hard-coded", drafted by a System Admin and
 * signed off by a System Reviewer before they go live — and the client asked
 * for it here, as a tab in Methodology Configuration alongside the others,
 * "with text boxes to enter the policies at both system admin and system
 * reviewer".
 *
 * Hence the shape of this tab: the reviewer sees exactly the same text box
 * the admin typed into, just not editable. Reviewing legal wording from a
 * read-only summary card while the actual text lived somewhere else would
 * make the sign-off gate ceremonial.
 *
 * Both translations are edited together, side by side on a wide screen: a
 * version is one policy in two renderings, and whoever writes the Arabic
 * needs the English in front of them to translate from. Requiring an editor
 * to switch the whole application's language to reach the second field made
 * that impossible, and hid from them whether the other translation existed at
 * all.
 *
 * Only English is mandatory. A missing Arabic copy is a content gap that
 * degrades gracefully — Arabic readers are served the English wording and
 * their acceptance is recorded as English (see consentPolicyTextFor) — so it
 * warns rather than blocking a version from going live. `ConsentPolicy.textAr`
 * is nullable for exactly this reason: a translation is allowed to lag its
 * source.
 */

const STATUS_BADGE: Record<ConsentPolicyStatus, string | undefined> = {
  published: "bg-badge-success text-badge-success-foreground border-transparent",
  approved: "bg-badge-info text-badge-info-foreground border-transparent",
  pending_approval: "bg-badge-warning text-badge-warning-foreground border-transparent",
  draft: undefined,
};

function StatusBadge({ status }: { status: ConsentPolicyStatus }) {
  const t = useTranslations("app.settings.methodology.consent");
  return (
    <Badge
      variant={status === "published" ? "default" : "outline"}
      className={STATUS_BADGE[status]}
    >
      {t(`status.${status}`)}
    </Badge>
  );
}

interface DraftFields {
  version: string;
  text: string;
  textAr: string;
}

/**
 * The two translations a version carries, in the order they are edited.
 * Declared once rather than written twice inline so the pair can never drift
 * — the same list drives the labels, the text direction and the
 * missing-translation warnings.
 */
const LOCALE_FIELDS = [
  { localeKey: "en", field: "text" },
  { localeKey: "ar", field: "textAr" },
] as const satisfies ReadonlyArray<{
  localeKey: ConsentLocale;
  field: "text" | "textAr";
}>;

/**
 * The live policy wording, shown as soon as the tab opens.
 *
 * A Terms of Use runs to thousands of words and three of these cards share
 * one page, so the body is clamped to a few lines by default and expands in
 * place. The toggle only appears when the text actually overflows the clamp —
 * a two-line citizen notice gets no button, because there is nothing more to
 * show. Expanded, the box is still bounded and scrolls on its own rather than
 * pushing the version history and the cards below it off-screen.
 */
function PolicyTextPreview({
  text,
  localeKey,
}: {
  text: string;
  localeKey: ConsentLocale;
}) {
  const t = useTranslations("app.settings.methodology.consent");
  const dir = localeKey === "ar" ? "rtl" : "ltr";
  const bodyRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Measured after layout rather than guessed from character count: the same
  // string is short in English and tall once wrapped in a narrow column, and
  // Arabic wraps differently again. Only measured while collapsed — expanded,
  // clientHeight is the full text and the comparison says nothing.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 4);
  }, [text, expanded]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-muted-foreground text-xs font-medium">
          {t("textLabel", { language: t(`language.${localeKey}`) })}
        </Label>
      </div>
      <div className="relative">
        <div
          ref={bodyRef}
          dir={dir}
          className={`bg-muted/40 border-border text-foreground rounded-lg border p-3 text-xs leading-relaxed whitespace-pre-line ${
            expanded ? "max-h-96 overflow-y-auto" : "max-h-28 overflow-hidden"
          }`}
        >
          {text}
        </div>
        {/* Fades the clipped last line instead of cutting a word in half, so
            the clamp reads as "there is more" rather than as the end. */}
        {!expanded && overflows ? (
          <div className="from-card pointer-events-none absolute inset-x-px bottom-px h-10 rounded-b-lg bg-gradient-to-t to-transparent" />
        ) : null}
      </div>
      {overflows ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-primary h-7 gap-1 px-2"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3.5" />
              {t("showLess")}
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" />
              {t("showMore")}
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}

function PolicyCard({
  kind,
  versions,
  canWrite,
  canCreate,
  canApprove,
  onChanged,
}: {
  kind: ConsentKind;
  versions: ConsentPolicyVersion[];
  canWrite: boolean;
  canCreate: boolean;
  canApprove: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("app.settings.methodology.consent");
  const tApiErr = useTranslations("apiErrors");
  // Both translations are edited together now, so this is only used by the
  // read-only viewer of the published wording — it shows the version the
  // reader of this page would themselves be served. Narrowed exhaustively
  // rather than cast, same as the signup form: only these two languages have
  // policy copy behind them.
  const locale: ConsentLocale = useLocale() === "ar" ? "ar" : "en";

  // The one version signup is serving right now. `active` rather than
  // "newest published": superseded versions stay published forever (their
  // acceptances remain valid), so recency alone would pick the wrong row.
  const live = versions.find((v) => v.active) ?? null;
  // Which translation the box below is really showing: `consentPolicyTextFor`
  // serves the English wording when a version has no Arabic copy, so the
  // label and text direction have to follow the text, not the app language.
  const liveTextLocale: ConsentLocale = locale === "ar" && live?.textAr ? "ar" : "en";
  // At most one version per kind is ever in flight — the backend has no way
  // to publish two, and offering "new version" while one is mid-review would
  // create a queue nobody asked for. `versions` arrives newest-first.
  const working = versions.find((v) => v.status !== "published") ?? null;

  // Identifies *which* server-side version the boxes are showing. Keyed on
  // id + updatedAt rather than the object itself, which is a new reference on
  // every refetch and would reset the boxes mid-typing.
  const workingKey = working ? `${working.id}:${working.updatedAt}` : null;
  const seedFrom = (v: ConsentPolicyVersion | null): DraftFields | null =>
    v ? { version: v.version, text: v.text, textAr: v.textAr ?? "" } : null;

  const [draft, setDraft] = useState<DraftFields | null>(() => seedFrom(working));
  const [seededFrom, setSeededFrom] = useState<string | null>(workingKey);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject" | null>(null);
  // The policy body is thousands of words, and three of these cards sit on
  // one page. Collapsing one is how you get to the next without scrolling
  // past an entire Terms of Use — see the fixed-height note on the textarea.
  const [textOpen, setTextOpen] = useState(() => working !== null);

  // Re-seed during render (React's documented "adjust state when a prop
  // changes" pattern) rather than in an effect: an effect would paint one
  // frame of the previous version's text before correcting itself, and on
  // legal wording that flash is genuinely misleading. Fires only when the
  // server's copy actually changed — saved, submitted, or rejected back to
  // draft — so it never fights the user's typing.
  if (seededFrom !== workingKey) {
    setSeededFrom(workingKey);
    setDraft(seedFrom(working));
  }

  /**
   * Closing the text box.
   *
   * An unsaved new version has nothing persisted behind it, so collapsing its
   * editor would leave a lone "Version label" field and a Create draft button
   * with nowhere to type the policy — a half-state with no way forward. Close
   * therefore discards it and returns the card to its resting layout, the
   * same thing Cancel does.
   *
   * A version that HAS been saved (`working`) is kept: it exists server-side,
   * the card still shows its status and actions, and closing is genuinely
   * just hiding the text.
   */
  function closeText() {
    setTextOpen(false);
    if (working === null) {
      setDraft(null);
      setError(null);
    }
  }

  // Starting a successor pre-fills the live wording: a new version is almost
  // always an amendment of the current text, and retyping a Terms of Use from
  // scratch is how clauses get lost.
  function startNewVersion() {
    setError(null);
    // Explicitly re-opened: the box defaults to closed on a card with nothing
    // in flight, and starting a version with the editor still collapsed would
    // hand back a form with no visible field to type in.
    setTextOpen(true);
    setDraft({
      version: "",
      text: live?.text ?? "",
      textAr: live?.textAr ?? "",
    });
  }

  async function run(action: () => Promise<unknown>, setter: (v: boolean) => void) {
    setter(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(resolveApiErrorMessage(err, tApiErr, t("genericError")));
    } finally {
      setter(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    await run(
      () =>
        working
          ? consentService.updateVersion(working.id, {
              version: draft.version.trim(),
              text: draft.text,
              // Empty box means "not translated yet" — sent as an explicit
              // null so clearing a half-finished translation is expressible,
              // not just omitted.
              textAr: draft.textAr.trim() === "" ? null : draft.textAr,
            })
          : consentService.createVersion({
              kind,
              version: draft.version.trim(),
              text: draft.text,
              textAr: draft.textAr.trim() === "" ? null : draft.textAr,
            }),
      setSaving,
    );
  }

  async function handleReview(notes: string) {
    if (!working) return;
    try {
      if (reviewMode === "approve") {
        await consentService.approveVersion(working.id, notes);
      } else {
        await consentService.rejectVersion(working.id, notes);
      }
      setReviewMode(null);
      onChanged();
    } catch (err) {
      setError(resolveApiErrorMessage(err, tApiErr, t("genericError")));
    }
  }

  // Everything except the reviewer's own decision is gated on `write`; the
  // boxes stay visible-but-disabled for the reviewer, who needs to read the
  // full wording to sign off on it.
  const editable = canWrite && (working ? working.status !== "published" : canCreate);
  const dirty =
    draft !== null &&
    (working === null ||
      draft.version.trim() !== working.version ||
      draft.text !== working.text ||
      draft.textAr !== (working.textAr ?? ""));

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-sm font-semibold">
              {t(`kind.${kind}.heading`)}
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">{t(`kind.${kind}.note`)}</p>
          </div>
          {live ? (
            <div className="text-right">
              <p className="text-muted-foreground text-xs">{t("liveVersionLabel")}</p>
              <p className="text-foreground text-sm font-medium">{live.version}</p>
              {live.publishedAt ? (
                <p className="text-muted-foreground text-xs">
                  <FormattedDate value={live.publishedAt} withTime />
                  {live.publishedByName ? ` · ${live.publishedByName}` : null}
                </p>
              ) : null}
            </div>
          ) : (
            // Not a cosmetic gap: signup 404s outright when a kind has no
            // active policy, so this is an outage the admin needs to see.
            <Badge variant="outline" className="text-destructive">
              {t("noLiveVersion")}
            </Badge>
          )}
        </div>

        {working === null ? (
          draft === null ? (
            // Nothing in flight is the resting state of a published policy,
            // not news — a dashed panel saying so pushed the wording itself
            // below the fold on all three cards. Only the action remains.
            canCreate ? (
              <div className="flex justify-end">
                <Button size="sm" className="gap-1.5" onClick={startNewVersion}>
                  <Plus className="size-3.5" />
                  {t("newVersion")}
                </Button>
              </div>
            ) : null
          ) : null
        ) : (
          <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-md p-3">
            <StatusBadge status={working.status} />
            <span className="text-foreground text-sm font-medium">{working.version}</span>
            <span className="text-muted-foreground text-xs">
              {t("lastUpdatedBy", {
                name: working.updatedByName ?? t("unknownActor"),
              })}{" "}
              · <FormattedDate value={working.updatedAt} withTime />
            </span>
            {/* Reopens the editor. Lives on this row rather than below it so
                that closing collapses the whole thing to a single summary
                line — the version field and Save button belong to the editor
                and go with it. */}
            {!textOpen ? (
              <Button
                size="sm"
                variant="outline"
                className="ms-auto"
                onClick={() => setTextOpen(true)}
              >
                {t("showText")}
              </Button>
            ) : null}
          </div>
        )}

        {working?.reviewNotes ? (
          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-muted-foreground text-xs">{t("reviewerNoteLabel")}</p>
            <p className="text-foreground mt-1 text-sm">
              {working.reviewNotes}
              {working.reviewedByName ? (
                <span className="text-muted-foreground">
                  {" — "}
                  {working.reviewedByName}
                  {working.reviewedAt ? (
                    <>
                      {" · "}
                      <FormattedDate value={working.reviewedAt} withTime />
                    </>
                  ) : null}
                </span>
              ) : null}
            </p>
          </div>
        ) : null}

        {/* The published wording, read-only and on screen the moment the tab
            opens — the client asked to see the current policies without
            hunting for them. Only when nothing is in flight: once a draft
            exists the editor below is the thing to look at, and showing both
            would beg the question of which one is live. Same language rule as
            signup — whichever translation matches the application language,
            falling back to English when the Arabic copy is missing, exactly as
            a reader would see it. */}
        {draft === null && live ? (
          <div className="space-y-2">
            {/* Labelled and laid out by the language of the text actually
                served, not the language that was asked for. When the Arabic
                copy is missing the reader gets the English wording, and
                calling that "نص السياسة (العربية)" — then flipping it
                right-to-left, which mangles English — claimed a translation
                exists. It says English, reads left-to-right, and the note
                below explains why. */}
            <PolicyTextPreview
              text={consentPolicyTextFor(live, locale)}
              localeKey={liveTextLocale}
            />
            {/* The gap is worth flagging in either language: an Arabic reader
                is looking at the fallback right now, and an English one is
                being told the version ships untranslated. */}
            {!live.textAr ? (
              <p className="text-muted-foreground text-xs">{t("textArHint")}</p>
            ) : null}
          </div>
        ) : null}

        {draft ? (
          <div className="space-y-4">
            {textOpen ? (
              <div className="space-y-2">
                <Label htmlFor={`${kind}-version`}>{t("versionLabel")}</Label>
                <Input
                  id={`${kind}-version`}
                  value={draft.version}
                  placeholder={t("versionPlaceholder")}
                  onChange={(e) => setDraft({ ...draft, version: e.target.value })}
                  disabled={!editable}
                  className="sm:max-w-xs"
                />
                <p className="text-muted-foreground text-xs">{t("versionHint")}</p>
              </div>
            ) : null}
            {textOpen ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-foreground text-sm font-semibold">
                    {t("textHeading")}
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2"
                    onClick={closeText}
                  >
                    <X className="size-3.5" />
                    {t("closeText")}
                  </Button>
                </div>

                {/* Both translations, side by side on a wide screen and
                    stacked below it. Equal weight on purpose: they are one
                    version's two renderings, and an editor working through a
                    translation needs to see the source it is translating. */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {LOCALE_FIELDS.map(({ localeKey, field }) => {
                    const isMissing = draft[field].trim() === "";
                    /* English is what every reader falls back to, so an empty
                       one is an error; a missing Arabic copy is a gap that
                       degrades gracefully (readers get the English wording and
                       the acceptance is recorded as English — see
                       consentPolicyTextFor). Hence one warns and the other
                       blocks. */
                    const missingNote = isMissing ? (
                      <p
                        className={
                          localeKey === "en"
                            ? "text-destructive text-xs"
                            : "text-muted-foreground text-xs"
                        }
                      >
                        {localeKey === "en" ? t("englishTextMissing") : t("textArHint")}
                      </p>
                    ) : null;

                    /* The reviewer's read of the wording they are about to
                       sign off on. A disabled <textarea> was the wrong control
                       for it: the browser refuses to scroll a disabled field,
                       so everything past the first screenful of a Terms of Use
                       was simply unreachable — the approval gate was being
                       asked for on text nobody could finish reading. Same
                       clamp-and-expand box as the published wording above. */
                    if (!editable) {
                      return (
                        <div key={localeKey} className="space-y-2">
                          {isMissing ? (
                            <>
                              <Label>
                                {t("textLabel", {
                                  language: t(`language.${localeKey}`),
                                })}
                              </Label>
                              {missingNote}
                            </>
                          ) : (
                            <PolicyTextPreview
                              text={draft[field]}
                              localeKey={localeKey}
                            />
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={localeKey} className="space-y-2">
                        <Label htmlFor={`${kind}-text-${localeKey}`}>
                          {t("textLabel", { language: t(`language.${localeKey}`) })}
                        </Label>
                        <Textarea
                          id={`${kind}-text-${localeKey}`}
                          value={draft[field]}
                          onChange={(e) =>
                            setDraft({ ...draft, [field]: e.target.value })
                          }
                          dir={localeKey === "ar" ? "rtl" : "ltr"}
                          // Fixed height with its own scrollbar. The shared
                          // Textarea sets `field-sizing-content`, which grows
                          // the control to fit its value — fine for a comment
                          // box, unusable for a Terms of Use, where it
                          // stretched to several screens and buried the cards
                          // below it. `resize-y` still lets an editor drag one
                          // taller.
                          className="[field-sizing:fixed] h-72 resize-y overflow-y-auto font-mono text-xs"
                        />
                        {missingNote}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          {/* Save belongs to the editor — with the box closed there is nothing
              on screen to save, and a permanently-disabled button left
              floating under a collapsed card just reads as broken. Any unsaved
              edits are still held in `draft`, so reopening brings them back
              along with this button. */}
          {editable && draft && textOpen ? (
            <Button
              size="sm"
              onClick={saveDraft}
              disabled={
                saving ||
                !dirty ||
                !draft.version.trim() ||
                // English only. It is the wording every reader ultimately
                // falls back to, so a version without it is unservable — but
                // Arabic is deliberately not gated here: a translation is
                // allowed to lag its source, and blocking Save on it would
                // strand a finished English policy behind a translator.
                !draft.text.trim()
              }
            >
              {saving ? t("saving") : working ? t("saveDraft") : t("createDraft")}
            </Button>
          ) : null}

          {canWrite && working?.status === "draft" && !dirty ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={busy}
              onClick={() => run(() => consentService.submitVersion(working.id), setBusy)}
            >
              <Send className="size-3.5" />
              {t("submitForApproval")}
            </Button>
          ) : null}

          {canApprove && working?.status === "pending_approval" ? (
            <>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setReviewMode("approve")}
              >
                <ShieldCheck className="size-3.5" />
                {t("approve")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive gap-1.5"
                onClick={() => setReviewMode("reject")}
              >
                <XCircle className="size-3.5" />
                {t("reject")}
              </Button>
            </>
          ) : null}

          {canWrite && working?.status === "approved" ? (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() =>
                run(() => consentService.publishVersion(working.id), setBusy)
              }
            >
              <CheckCircle2 className="size-3.5" />
              {busy ? t("publishing") : t("publish")}
            </Button>
          ) : null}

          {draft && working === null ? (
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              {t("cancel")}
            </Button>
          ) : null}
        </div>

        {/* Client requirement 4 — full version history retained. Every row
            here is a real policy version someone may have consented against,
            which is why none of them is ever edited or removed. */}
        <div className="border-border space-y-2 border-t pt-4">
          <h3 className="text-foreground text-xs font-semibold">{t("historyHeading")}</h3>
          {versions.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("historyEmpty")}</p>
          ) : (
            <ul className="divide-border divide-y">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge status={v.status} />
                    <span className="text-foreground">{v.version}</span>
                    {v.active ? (
                      <Badge variant="outline" className="text-xs">
                        {t("activeBadge")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {v.publishedByName ?? v.createdByName ?? t("unknownActor")} ·{" "}
                    <FormattedDate value={v.publishedAt ?? v.createdAt} withTime />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      <RejectReasonDialog
        open={reviewMode !== null}
        onOpenChange={(open) => !open && setReviewMode(null)}
        onConfirm={handleReview}
        title={
          reviewMode === "approve" ? t("approveDialogTitle") : t("rejectDialogTitle")
        }
        reasonLabel={t("reviewerNotesLabel")}
        reasonRequiredError={t("reviewerNotesRequired")}
        cancelLabel={t("cancel")}
        confirmLabel={reviewMode === "approve" ? t("confirmApprove") : t("confirmReject")}
        confirmVariant={reviewMode === "approve" ? "default" : "destructive"}
      />
    </Card>
  );
}

export function ConsentPoliciesTab() {
  const t = useTranslations("app.settings.methodology.consent");
  const tApiErr = useTranslations("apiErrors");
  const canWrite = usePermission("onboardingConsent", "write");
  const canCreate = usePermission("onboardingConsent", "create");
  const canApprove = usePermission("onboardingConsent", "approve");

  const [versions, setVersions] = useState<ConsentPolicyVersionList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Only ever sets state from the resolved promise — the retry button clears
  // the previous error itself, so nothing here runs synchronously inside the
  // mount effect below.
  function load() {
    consentService
      .listVersions()
      .then((next) => {
        setVersions(next);
        setLoadError(null);
      })
      .catch((err) => {
        // Distinct from "no versions yet": a failed request rendered as an
        // empty state would look identical to a platform with no consent
        // policy configured at all, which is an outage, not a blank slate.
        setVersions(null);
        setLoadError(resolveApiErrorMessage(err, tApiErr, t("loadError")));
      });
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-destructive text-sm">{loadError}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setLoadError(null);
            load();
          }}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!versions) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-64 animate-pulse rounded-lg" />
        <div className="bg-muted h-64 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">{t("intro")}</p>
      <PolicyCard
        kind="use_policy"
        versions={versions.usePolicy}
        canWrite={canWrite}
        canCreate={canCreate}
        canApprove={canApprove}
        onChanged={load}
      />
      <PolicyCard
        kind="data_sharing"
        versions={versions.dataSharing}
        canWrite={canWrite}
        canCreate={canCreate}
        canApprove={canApprove}
        onChanged={load}
      />
      {/* RIO-NFR-002 — the notice a citizen accepts before a public survey
          collects anything. Managed here, under the same System Admin →
          System Reviewer gate as the two signup consents: it used to live in
          the frontend's message catalogues with its version in a constant,
          so changing it meant a code release and no reviewer ever saw it. */}
      <PolicyCard
        kind="citizen_consent"
        versions={versions.citizenConsent}
        canWrite={canWrite}
        canCreate={canCreate}
        canApprove={canApprove}
        onChanged={load}
      />
    </div>
  );
}

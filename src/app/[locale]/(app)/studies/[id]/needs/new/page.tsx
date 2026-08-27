"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { BackButton } from "@/components/common/back-button";
import { GovernoratePicker } from "@/components/common/governorate-picker";
import { LoadingButton } from "@/components/common/loading-button";
import { MultiSelect } from "@/components/ui/multi-select";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { useStudyGovernorates, useStudyCenters } from "@/hooks/use-study-geography";
import { ApiError } from "@/services/api/types";
import { evidenceService } from "@/services/evidence/evidence.service";
import { needsService } from "@/services/needs/needs.service";
import { studiesService } from "@/services/studies/studies.service";
import type { Study } from "@/services/studies/studies.types";

interface NeedFormValues {
  title: string;
  statement: string;
  village: string[];
  governorateIds: string[];
  centerIds: string[];
  // Held as a string, not a number: an empty <input type="number"> yields NaN
  // once coerced, and "not answered" has to stay distinguishable from zero all
  // the way to the payload — the report says different things about the two.
  affectedPopulation: string;
  affectedPeople: string;
  affectedHouseholds: string;
}

// "Roughly how many people does this need affect?" — a whole count of people,
// or blank. The upper bound matches the API contract (Saudi Arabia's
// population rounded up): high enough never to reject a real estimate, low
// enough to catch a mistyped digit run before it reaches a report.
const MAX_AFFECTED_POPULATION = 50_000_000;

let stagedFileIdCounter = 0;
interface StagedFile {
  localId: string;
  file: File;
}

// Mirrors the Evidence page's own client-side allowlist/limits exactly (see
// EvidenceStorageService on the backend) — rejecting here is just a faster,
// friendlier version of the same server-side rule.
const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".csv",
  ".xls",
  ".xlsx",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_STUDY = 10;

function fileExtensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

export default function CreateNeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studyId } = use(params);
  const t = useTranslations("app.studies.need");
  const tGeo = useTranslations("app.geography");
  const tValidation = useTranslations("app.studies.validation");
  const router = useRouter();

  const [study, setStudy] = useState<Study | null>(null);
  const studyGovernorates = useStudyGovernorates(study);
  const studyCenters = useStudyCenters(study);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Evidence can't be uploaded until a Need exists (the backend's upload
  // endpoint requires a real needId) — files picked here are staged
  // client-side only and actually uploaded right after the Need is created,
  // before navigating away.
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [stagedFileError, setStagedFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addStagedFiles(files: FileList | File[]) {
    setStagedFileError(null);
    setStagedFiles((prev) => {
      let runningTotal = prev.length;
      const accepted: StagedFile[] = [];
      for (const file of Array.from(files)) {
        if (!ALLOWED_EXTENSIONS.includes(fileExtensionOf(file.name))) {
          setStagedFileError(t("evidenceInvalidType", { name: file.name }));
          continue;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setStagedFileError(t("evidenceFileTooLarge", { name: file.name }));
          continue;
        }
        if (runningTotal + 1 > MAX_FILES_PER_STUDY) {
          setStagedFileError(t("evidenceFileLimitReached", { max: MAX_FILES_PER_STUDY }));
          break;
        }
        runningTotal += 1;
        stagedFileIdCounter += 1;
        accepted.push({ localId: `staged-${stagedFileIdCounter}`, file });
      }
      return [...prev, ...accepted];
    });
  }

  function removeStagedFile(localId: string) {
    setStagedFiles((prev) => prev.filter((f) => f.localId !== localId));
  }

  useEffect(() => {
    let cancelled = false;
    studiesService
      .getById(studyId)
      .then((result) => {
        if (!cancelled) setStudy(result);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  const schema = z.object({
    // Optional — a blank title falls back server-side to a snippet of the
    // Statement (see NeedsService.create), so nothing is required here
    // beyond the max length.
    title: z.string().trim().max(300, tValidation("titleTooLong")),
    statement: z.string().trim().min(1, tValidation("needStatementRequired")),
    village: z.array(z.string()),
    governorateIds: z.array(z.string()),
    centerIds: z.array(z.string()),
    // Optional on purpose — an estimate nobody is confident in is worth less
    // than an honest blank, and the report prints a dash and says why.
    affectedPopulation: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || (/^\d+$/.test(v) && Number(v) <= MAX_AFFECTED_POPULATION),
    // RIO-FR-005 (Round 4, client-confirmed 2026-08-24) — "Roughly how many
    // people/households does this need affect?" Both optional, kept as
    // strings on the form so an empty field round-trips as "" rather than
    // NaN; parsed to a non-negative integer (or omitted) on submit.
    affectedPeople: z
      .string()
      .refine(
        (v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0),
        tValidation("affectedPopulationInvalid"),
      ),
    affectedHouseholds: z
      .string()
      .refine(
        (v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0),
        tValidation("affectedPopulationInvalid"),
      ),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NeedFormValues>({
    resolver: zodResolver(schema),
    // A new Need starts from the villages configured on its Study; once
    // the Need exists it owns its own values and the Study's are no
    // longer imposed.
    values: {
      title: "",
      statement: "",
      village: study?.villages ?? [],
      governorateIds: [],
      centerIds: [],
      affectedPopulation: "",
      affectedPeople: "",
      affectedHouseholds: "",
    },
  });

  const village = useWatch({ control, name: "village" });
  const governorateIds = useWatch({ control, name: "governorateIds" });
  const centerIds = useWatch({ control, name: "centerIds" });
  const centerOptions = studyCenters.filter((c) =>
    governorateIds.includes(c.governorateId),
  );
  // The selected governorate(s) have no centers configured at all — hide
  // the field rather than show a dead, always-empty dropdown.
  const centerFieldHidden = governorateIds.length > 0 && centerOptions.length === 0;

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const created = await needsService.create(studyId, {
        // Blank stays blank here — the fallback-from-statement derivation
        // happens server-side, not by pre-filling the field ourselves.
        title: values.title || undefined,
        statement: values.statement,
        village: values.village,
        governorateIds: values.governorateIds,
        centerIds: values.centerIds,
        // Blank stays absent rather than becoming 0 — the Top-Priority Report
        // distinguishes "no estimate given" (a dash) from "nobody affected".
        affectedPopulation:
          values.affectedPopulation === ""
            ? undefined
            : Number(values.affectedPopulation),
        affectedPeople:
          values.affectedPeople === "" ? undefined : Number(values.affectedPeople),
        affectedHouseholds:
          values.affectedHouseholds === ""
            ? undefined
            : Number(values.affectedHouseholds),
      });
      // The Need itself is already saved at this point — a failed upload
      // must never block navigating to it (and definitely must never cause
      // a second, duplicate Need to get created by leaving the form up for
      // another submit). Failures are surfaced on the destination page
      // instead of being silently swallowed here.
      const uploadResults = await Promise.allSettled(
        stagedFiles.map(({ file }) => evidenceService.upload(created.id, file)),
      );
      const failedNames = uploadResults
        .map((result, index) =>
          result.status === "rejected" ? stagedFiles[index].file.name : null,
        )
        .filter((name): name is string => name !== null);
      if (failedNames.length > 0) {
        sessionStorage.setItem(
          `rio.needEvidenceUploadFailed.${created.id}`,
          JSON.stringify(failedNames),
        );
      }
      router.push(`/studies/${studyId}/needs/${created.id}`);
      // router.push() enqueues the navigation but doesn't wait for it to
      // finish — returning here would let isSubmitting flip back to false
      // and the button flash re-enabled while this page is still visible.
      // Never resolving keeps it in the loading state until this component
      // unmounts on the route change.
      await new Promise<void>(() => {});
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : t("genericError"));
    }
  });

  return (
    <PermissionGuard module="dataCollection" action="create">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href={`/studies/${studyId}`} label={t("backToStudy")} />
        </div>
        <PageHeader title={t("addTitle")} description={t("pageDescription")} />

        <Card>
          <CardContent className="p-6">
            {!loaded ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : notFound ? (
              <p className="text-muted-foreground text-sm">{t("studyNotFound")}</p>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title">{t("titleLabel")}</Label>
                  <Input
                    id="title"
                    placeholder={t("titlePlaceholder")}
                    {...register("title")}
                  />
                  {errors.title ? (
                    <p className="text-destructive text-sm">{errors.title.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="statement">
                    {t("statementLabel")} <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="statement"
                    rows={5}
                    placeholder={t("statementPlaceholder")}
                    {...register("statement")}
                  />
                  {errors.statement ? (
                    <p className="text-destructive text-sm">{errors.statement.message}</p>
                  ) : null}
                </div>

                {/* Governorates/Centers scoped to the Study's own selection
                    (a subset of the Study's), side by side — each chip list
                    still wraps to more rows within its own column once many
                    are selected. Center is hidden outright (not just
                    disabled) once a governorate is chosen that has no
                    centers configured under it — an empty, unusable
                    dropdown would otherwise block the usual flow. */}
                <div
                  className={
                    centerFieldHidden ? "grid gap-5" : "grid gap-5 sm:grid-cols-2"
                  }
                >
                  <div className="space-y-2">
                    <Label>{tGeo("governorateLabel")}</Label>
                    <MultiSelect
                      options={studyGovernorates.map((g) => ({
                        value: g.id,
                        label: g.name,
                      }))}
                      values={governorateIds}
                      onChange={(next) => {
                        setValue("governorateIds", next, { shouldValidate: true });
                        // Dropping a governorate must also drop any already-selected
                        // centers that belonged to it — otherwise centerIds keeps an
                        // orphaned id centerOptions no longer contains, and the
                        // MultiSelect can't resolve a label for it (falls back to
                        // showing the raw id, as if it were a real selection).
                        const stillValidCenterIds = new Set(
                          studyCenters
                            .filter((c) => next.includes(c.governorateId))
                            .map((c) => c.id),
                        );
                        setValue(
                          "centerIds",
                          centerIds.filter((id) => stillValidCenterIds.has(id)),
                          { shouldValidate: true },
                        );
                      }}
                      placeholder={tGeo("governoratePlaceholder")}
                      searchPlaceholder={tGeo("governorateSearchPlaceholder")}
                      emptyText={tGeo("governorateEmpty")}
                      removeAriaLabel={(governorate) =>
                        tGeo("removeGovernorateSelection", { governorate })
                      }
                    />
                  </div>

                  {centerFieldHidden ? null : (
                    <div className="space-y-2">
                      <Label>{tGeo("centerLabel")}</Label>
                      <MultiSelect
                        options={centerOptions.map((c) => ({
                          value: c.id,
                          label: c.name,
                        }))}
                        values={centerIds}
                        onChange={(next) =>
                          setValue("centerIds", next, { shouldValidate: true })
                        }
                        placeholder={
                          governorateIds.length > 0
                            ? tGeo("centerPlaceholder")
                            : tGeo("selectGovernorateFirst")
                        }
                        searchPlaceholder={tGeo("centerSearchPlaceholder")}
                        emptyText={tGeo("centerEmpty")}
                        removeAriaLabel={(center) =>
                          tGeo("removeCenterSelection", { center })
                        }
                        disabled={governorateIds.length === 0}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="village">{t("villageLabel")}</Label>
                  <GovernoratePicker
                    values={village ?? []}
                    options={[]}
                    onChange={(next) =>
                      setValue("village", next, { shouldValidate: true })
                    }
                  />
                  {errors.village ? (
                    <p className="text-destructive text-sm">{errors.village.message}</p>
                  ) : null}
                </div>

                {/* The one figure behind the Top-Priority Report's Affected
                    Population column (client-confirmed Option A). It exists
                    nowhere else in the platform: Study.population is the study
                    AREA's population and sizes the sample, so it cannot stand
                    in for this. Asked here because it can only ever be
                    answered at the point the need is recorded — it is not
                    reconstructable afterwards. */}
                <div className="space-y-2">
                  <Label htmlFor="affectedPopulation">
                    {t("affectedPopulationLabel")}
                  </Label>
                  <Input
                    id="affectedPopulation"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_AFFECTED_POPULATION}
                    step={1}
                    placeholder={t("affectedPopulationPlaceholder")}
                    {...register("affectedPopulation")}
                  />
                  <p className="text-muted-foreground text-xs">
                    {t("affectedPopulationHint")}
                  </p>
                  {errors.affectedPopulation ? (
                    <p className="text-destructive text-sm">
                      {errors.affectedPopulation.message}
                    </p>
                  ) : null}
                {/* RIO-FR-005 (Round 4, client-confirmed 2026-08-24) — the
                    manually entered figure is the PRIMARY Affected
                    Population value; both are optional and independent. */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="affectedPeople">{t("affectedPeopleLabel")}</Label>
                    <Input
                      id="affectedPeople"
                      type="number"
                      min={0}
                      placeholder={t("affectedPeoplePlaceholder")}
                      {...register("affectedPeople")}
                    />
                    {errors.affectedPeople ? (
                      <p className="text-destructive text-sm">
                        {errors.affectedPeople.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="affectedHouseholds">
                      {t("affectedHouseholdsLabel")}
                    </Label>
                    <Input
                      id="affectedHouseholds"
                      type="number"
                      min={0}
                      placeholder={t("affectedHouseholdsPlaceholder")}
                      {...register("affectedHouseholds")}
                    />
                    {errors.affectedHouseholds ? (
                      <p className="text-destructive text-sm">
                        {errors.affectedHouseholds.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("evidenceLabel")}</Label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="border-input hover:bg-muted/30 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-6 py-6 text-center"
                  >
                    <Upload className="text-muted-foreground size-6" />
                    <p className="text-foreground text-sm font-medium">
                      {t("evidenceAddFiles")}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("evidenceAllowedTypesHint", { max: MAX_FILES_PER_STUDY })}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ALLOWED_EXTENSIONS.join(",")}
                      className="hidden"
                      onChange={(event) => {
                        if (event.target.files && event.target.files.length > 0) {
                          addStagedFiles(event.target.files);
                        }
                        event.target.value = "";
                      }}
                    />
                  </div>

                  {stagedFileError ? (
                    <p className="text-destructive text-sm">{stagedFileError}</p>
                  ) : null}

                  {stagedFiles.length > 0 ? (
                    <ul className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                      {stagedFiles.map(({ localId, file }) => (
                        <li
                          key={localId}
                          className="border-border flex items-center gap-3 rounded-lg border p-3"
                        >
                          <FileText className="text-muted-foreground size-5 shrink-0" />
                          <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeStagedFile(localId)}
                            aria-label={t("evidenceRemoveFile")}
                            className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                          >
                            <X className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {submitError ? (
                  <p className="text-destructive text-sm">{submitError}</p>
                ) : null}

                <div className="flex items-center gap-2">
                  <LoadingButton
                    type="submit"
                    isLoading={isSubmitting}
                    text={isSubmitting ? t("saving") : t("save")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/studies/${studyId}`)}
                    disabled={isSubmitting}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}

"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { domainsService } from "@/services/domains/domains.service";
import {
  ADDITIONAL_QUESTION_ANSWER_TYPES,
  surveysService,
  type AdditionalQuestionAnswerType,
} from "@/services/surveys/surveys.service";

// Only these two answer types collect their own option list — Single Select
// and Multi Select both render as a fixed set of choices; the rest are
// free-form (text/number).
const OPTIONS_ANSWER_TYPES = new Set<AdditionalQuestionAnswerType>([
  "multiple_choice",
  "checkbox",
]);

export interface CustomQuestionValue {
  questionText: string;
  answerType: AdditionalQuestionAnswerType;
  answerOptions: string[] | null;
  domain: string | null;
  subDomain: string | null;
  kpi: string | null;
  isRequired: boolean;
}

interface CustomQuestionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing an existing custom question; absent/null when
   * adding a new one. */
  initialValue?: CustomQuestionValue | null;
  onSave: (value: CustomQuestionValue) => void;
}

// Shared Add/Edit Custom Question modal — extracted so both the Survey
// Builder page and the AI Review screen use exactly the same question-type
// vocabulary (Free Text / Single Select / Multi Select / True-False / Scale
// / Number) and validation instead of two divergent copies.
export function CustomQuestionEditorDialog({
  open,
  onOpenChange,
  initialValue,
  onSave,
}: CustomQuestionEditorDialogProps) {
  const t = useTranslations("app.questionEditor");

  // Initialized once from props at mount, not synced via an effect — the
  // caller is expected to pass a `key` that changes each time this dialog is
  // opened (see openAddModal/openEditModal in its callers), so React mounts
  // a fresh instance with the right starting values instead of this
  // component reaching back into an effect to reset itself.
  const [text, setText] = useState(initialValue?.questionText ?? "");
  const [answerType, setAnswerType] = useState<AdditionalQuestionAnswerType>(
    initialValue?.answerType ?? "long_text",
  );
  const [options, setOptions] = useState<string[]>(
    initialValue?.answerOptions && initialValue.answerOptions.length > 0
      ? initialValue.answerOptions
      : ["", ""],
  );
  // Domain/Sub-domain/KPI — required going forward for every custom
  // question saved through this dialog (new or edited), so the Question
  // Bank and reports stay consistent regardless of how a question was
  // added. A question saved before this field existed just opens with
  // these blank; it keeps working unedited (see SurveysService#
  // updateQuestions on the backend) — only actually editing it here, via
  // this dialog's own Save, requires filling them in.
  const [domain, setDomain] = useState<string | null>(initialValue?.domain ?? null);
  const [subDomain, setSubDomain] = useState<string | null>(
    initialValue?.subDomain ?? null,
  );
  const [kpi, setKpi] = useState(initialValue?.kpi ?? "");
  const [domainOptions, setDomainOptions] = useState<
    Array<{ name: string; subDomains: string[] }>
  >([]);
  const [kpiOptions, setKpiOptions] = useState<string[]>([]);
  const [required, setRequired] = useState(initialValue?.isRequired ?? true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    domainsService
      .listWithSubDomains()
      .then((domains) =>
        setDomainOptions(
          domains
            .filter((d) => d.isActive)
            .map((d) => ({
              name: d.name,
              subDomains: d.subDomains.filter((sd) => sd.isActive).map((sd) => sd.name),
            })),
        ),
      )
      .catch(() => setDomainOptions([]));
  }, []);

  // Suggestions only — KPI has no fixed vocabulary the way Domain/Sub-domain
  // do (see surveysService.getKpiOptions), so this never blocks typing a
  // brand-new one.
  useEffect(() => {
    surveysService
      .getKpiOptions()
      .then(setKpiOptions)
      .catch(() => setKpiOptions([]));
  }, []);

  const subDomainOptions = domainOptions.find((d) => d.name === domain)?.subDomains ?? [];
  const needsOptions = OPTIONS_ANSWER_TYPES.has(answerType);

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError(t("openEndedTextRequired"));
      return;
    }
    const cleanedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (needsOptions && cleanedOptions.length < 2) {
      setError(t("openEndedOptionsRequired"));
      return;
    }
    const trimmedKpi = kpi.trim();
    if (!domain || !subDomain || !trimmedKpi) {
      setError(t("domainSubDomainKpiRequired"));
      return;
    }
    onSave({
      questionText: trimmed,
      answerType,
      answerOptions: needsOptions ? cleanedOptions : null,
      domain,
      subDomain,
      kpi: trimmedKpi,
      isRequired: required,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initialValue ? t("editOpenEndedQuestion") : t("addOpenEndedQuestion")}
          </DialogTitle>
          <DialogDescription>{t("openEndedDialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="custom-question-text">
              {t("questionLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="custom-question-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("openEndedPlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-question-answer-type">
              {t("answerTypeLabel")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={answerType}
              onValueChange={(v) => setAnswerType(v as AdditionalQuestionAnswerType)}
            >
              <SelectTrigger id="custom-question-answer-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADDITIONAL_QUESTION_ANSWER_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`answerType.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-question-domain">
              {t("domainLabel")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={domain ?? undefined}
              onValueChange={(v) => {
                setDomain(v);
                setSubDomain(null);
              }}
            >
              <SelectTrigger id="custom-question-domain" className="w-full">
                <SelectValue placeholder={t("selectDomain")} />
              </SelectTrigger>
              <SelectContent>
                {domainOptions.map((d) => (
                  <SelectItem key={d.name} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-question-sub-domain">
              {t("subDomainLabel")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={subDomain ?? undefined}
              onValueChange={setSubDomain}
              disabled={!domain}
            >
              <SelectTrigger id="custom-question-sub-domain" className="w-full">
                <SelectValue placeholder={t("selectSubDomain")} />
              </SelectTrigger>
              <SelectContent>
                {subDomainOptions.map((sd) => (
                  <SelectItem key={sd} value={sd}>
                    {sd}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-question-kpi">
              {t("kpiLabel")} <span className="text-destructive">*</span>
            </Label>
            <AutocompleteInput
              id="custom-question-kpi"
              value={kpi}
              onChange={setKpi}
              options={kpiOptions}
              placeholder={t("kpiPlaceholder")}
            />
          </div>

          {needsOptions ? (
            <div className="space-y-1.5">
              <Label>{t("optionsLabel")}</Label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={t("optionPlaceholder", { number: index + 1 })}
                    />
                    {options.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                        aria-label={t("remove")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  className="gap-1.5"
                >
                  <Plus className="size-3.5" />
                  {t("addOption")}
                </Button>
              </div>
            </div>
          ) : null}

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={required}
              onCheckedChange={(v) => setRequired(v === true)}
            />
            {t("requiredLabel")}
          </label>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={save}>
            {initialValue ? t("saveQuestion") : t("addQuestion")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

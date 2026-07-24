import type { SurveyQuestionItem } from "@/services/surveys/surveys.service";
import type { SurveyResponseDetail } from "@/services/public-surveys/public-surveys.types";

export type QuestionStatKind = "options" | "numeric" | "text";

export interface QuestionOptionStat {
  label: string;
  count: number;
  percentage: number;
}

export interface QuestionNumericStat {
  min: number;
  max: number;
  average: number;
}

export interface QuestionResponseStat {
  questionId: string;
  questionText: string;
  answerType: string;
  kind: QuestionStatKind;
  /** How many responses had *some* answer to this question (a required
   * question may still be missing here, e.g. an in-progress or legacy
   * response) — the denominator behind every percentage below. */
  totalAnswered: number;
  /** Set only when `kind === "options"`. */
  options: QuestionOptionStat[];
  /** Set only when `kind === "numeric"`. */
  numeric: QuestionNumericStat | null;
  /** Set only when `kind === "text"` — every non-blank free-text answer, so
   * a card can show a quick preview without opening the full dialog. */
  textAnswers: string[];
}

// Human-facing label for a question's answer type — what a researcher
// should see instead of the raw stored value ("select", "checkbox", ...).
// Mirrors CitizenService#mapAnswerTypeForCitizen's grouping on the backend,
// since that's what actually determines how the citizen answered it (a
// Question Bank "multiple_choice" type, despite its name, renders as a
// single pick there — this label reflects that real behavior, not the raw
// type name).
const ANSWER_TYPE_LABELS: Record<string, string> = {
  select: "Single Choice",
  multiple_choice: "Single Choice",
  checkbox: "Multiple Choice",
  boolean: "Yes / No",
  yes_no: "Yes / No",
  rating: "Likert Scale",
  numeric: "Numeric",
  long_text: "Open Ended",
  short_text: "Open Ended",
};

export function describeAnswerType(answerType: string): string {
  return ANSWER_TYPE_LABELS[answerType] ?? "Open Ended";
}

// Question Bank answer types that render as a fixed option set the citizen
// picks from (see CitizenService#mapAnswerTypeForCitizen on the backend,
// which this mirrors) — `checkbox` is the one multi-select type among them,
// so an answer to it may name more than one option at once.
const OPTION_ANSWER_TYPES = new Set([
  "select",
  "multiple_choice",
  "checkbox",
  "boolean",
  "yes_no",
  "rating",
]);
const MULTI_SELECT_ANSWER_TYPES = new Set(["checkbox"]);
const NUMERIC_ANSWER_TYPES = new Set(["numeric"]);

function classifyAnswerType(answerType: string): QuestionStatKind {
  if (NUMERIC_ANSWER_TYPES.has(answerType)) return "numeric";
  if (OPTION_ANSWER_TYPES.has(answerType)) return "options";
  return "text";
}

// The option label set a question's stats should tally against — its own
// `answerOptions` when the survey defined one, otherwise the same fixed
// default the citizen flow rendered (see mapAnswerTypeForCitizen), so a
// Yes/No or 1-5 rating question still gets real slices even without an
// explicit options list stored on it.
function optionLabelsFor(question: SurveyQuestionItem): string[] {
  if (question.answerOptions && question.answerOptions.length > 0) {
    return question.answerOptions;
  }
  if (question.answerType === "boolean" || question.answerType === "yes_no") {
    return ["Yes", "No"];
  }
  if (question.answerType === "rating") {
    return ["1", "2", "3", "4", "5"];
  }
  return [];
}

function answerFor(response: SurveyResponseDetail, questionId: string): string | null {
  const answer =
    response.answers.find((a) => a.questionId === questionId)?.answer ?? null;
  return answer && answer.trim() ? answer : null;
}

/** Pure tallying — counts, percentages, min/max/average. No weighting, no
 * scoring, no severity/priority/KPI logic; this is raw-response validation,
 * not analytics. */
export function computeQuestionStats(
  questions: SurveyQuestionItem[],
  responses: SurveyResponseDetail[],
): QuestionResponseStat[] {
  return questions.map((question): QuestionResponseStat => {
    const kind = classifyAnswerType(question.answerType);
    const rawAnswers = responses
      .map((r) => answerFor(r, question.id))
      .filter((a): a is string => a !== null);

    if (kind === "numeric") {
      const values = rawAnswers.map(Number).filter((n) => Number.isFinite(n));
      const numeric: QuestionNumericStat | null =
        values.length > 0
          ? {
              min: Math.min(...values),
              max: Math.max(...values),
              average:
                Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 10) /
                10,
            }
          : null;
      return {
        questionId: question.id,
        questionText: question.questionText,
        answerType: question.answerType,
        kind,
        totalAnswered: values.length,
        options: [],
        numeric,
        textAnswers: [],
      };
    }

    if (kind === "options") {
      const isMultiSelect = MULTI_SELECT_ANSWER_TYPES.has(question.answerType);
      const labels = optionLabelsFor(question);
      const counts = new Map(labels.map((label) => [label, 0]));
      let totalAnswered = 0;
      for (const raw of rawAnswers) {
        const picks = isMultiSelect
          ? raw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [raw];
        if (picks.length === 0) continue;
        totalAnswered += 1;
        for (const pick of picks) {
          counts.set(pick, (counts.get(pick) ?? 0) + 1);
        }
      }
      const options: QuestionOptionStat[] = labels.map((label) => {
        const count = counts.get(label) ?? 0;
        return {
          label,
          count,
          percentage:
            totalAnswered > 0 ? Math.round((count / totalAnswered) * 1000) / 10 : 0,
        };
      });
      return {
        questionId: question.id,
        questionText: question.questionText,
        answerType: question.answerType,
        kind,
        totalAnswered,
        options,
        numeric: null,
        textAnswers: [],
      };
    }

    return {
      questionId: question.id,
      questionText: question.questionText,
      answerType: question.answerType,
      kind,
      totalAnswered: rawAnswers.length,
      options: [],
      numeric: null,
      textAnswers: rawAnswers,
    };
  });
}

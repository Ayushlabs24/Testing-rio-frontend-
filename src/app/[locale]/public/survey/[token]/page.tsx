import { use } from "react";
import { CitizenSurveyFlow } from "@/components/features/citizen/citizen-survey-flow";

export default function PublicSurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return <CitizenSurveyFlow token={token} />;
}

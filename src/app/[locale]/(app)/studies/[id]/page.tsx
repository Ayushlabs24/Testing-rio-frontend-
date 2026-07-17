"use client";

import { use, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

export default function StudyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/studies/${id}/all-surveys`);
  }, [id, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Loader2 className="size-8 animate-spin text-indigo-600" />
      <span className="text-sm font-semibold text-slate-500">Redirecting to surveys board...</span>
    </div>
  );
}

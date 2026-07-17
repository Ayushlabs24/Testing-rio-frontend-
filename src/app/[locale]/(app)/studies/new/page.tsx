"use client";

import { useState, useRef, useEffect } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  User,
  Send,
  UploadCloud,
  File,
  X,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ClipboardList
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { parseVillageInput } from "@/lib/villages";
import { studiesService } from "@/services/studies/studies.service";
import { surveysService } from "@/services/surveys/surveys.service";
import { evidenceService } from "@/services/evidence/evidence.service";

interface Message {
  id: string;
  sender: "system" | "user";
  text?: string;
  component?: React.ReactNode;
}

export default function NewStudyChatWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Conversational Flow Steps:
  // 0: Ask Title
  // 1: Ask Problem Statement
  // 2: Ask Villages
  // 3: Ask Documents / Uploads
  // 4: Show Final Actions (Create Survey / Save Blank)
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [textareaValue, setTextareaValue] = useState("");

  // Gathered variables
  const [title, setTitle] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [villages, setVillages] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Actions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize first system message
  useEffect(() => {
    setMessages([
      {
        id: "msg-0",
        sender: "system",
        text: "Hello! I am your AI Blueprint Coordinator. Let's create your new study blueprint. To start, what is the **Title** of your study?"
      }
    ]);
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  const handleSendText = () => {
    if (step === 0) {
      if (!inputValue.trim()) return;
      const userText = inputValue.trim();
      setTitle(userText);
      setInputValue("");

      setMessages(prev => [
        ...prev,
        { id: `user-title`, sender: "user", text: userText },
        {
          id: `sys-problem`,
          sender: "system",
          text: `Got it. The title will be **"${userText}"**.\n\nNext, please provide a detailed description of the **Problem Statement** or scope for this study. What baseline issues are we evaluating?`
        }
      ]);
      setStep(1);
    } else if (step === 2) {
      const userText = inputValue.trim() || "(Skipped villages)";
      setVillages(inputValue.trim());
      setInputValue("");

      setMessages(prev => [
        ...prev,
        { id: `user-villages`, sender: "user", text: userText },
        {
          id: `sys-docs`,
          sender: "system",
          text: "Excellent. Finally, would you like to attach any **Baseline Documents** or evidence files for this study? You can upload PDFs, spreadsheets, or images. Choose files below, then click **Proceed**."
        }
      ]);
      setStep(3);
    }
  };

  const handleSendTextarea = () => {
    if (step === 1) {
      if (!textareaValue.trim()) return;
      const userText = textareaValue.trim();
      setProblemStatement(userText);
      setTextareaValue("");

      setMessages(prev => [
        ...prev,
        { id: `user-problem`, sender: "user", text: userText },
        {
          id: `sys-villages`,
          sender: "system",
          text: "Understood. Description registered.\n\nWhat are the **Targeted Villages** or geographic areas for this study? (Separate multiple areas with commas, or send empty to skip)."
        }
      ]);
      setStep(2);
    }
  };

  // Files handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleFilesProceed = () => {
    const fileLabel = files.length > 0
      ? `Attached ${files.length} document(s): ` + files.map(f => f.name).join(", ")
      : "No documents attached";

    setMessages(prev => [
      ...prev,
      { id: `user-files`, sender: "user", text: fileLabel },
      {
        id: `sys-actions`,
        sender: "system",
        text: "Everything is set! How would you like to finalize this study blueprint? Choose an action below:"
      }
    ]);
    setStep(4);
  };

  const handleFinalize = async (mode: "create-survey" | "save-blank") => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // 1. Create the Study
      const study = await studiesService.create({
        title: title.trim(),
        problemStatement: problemStatement.trim(),
        villages: parseVillageInput(villages),
      });

      // 2. Upload any evidence files in queue
      if (files.length > 0) {
        for (const file of files) {
          try {
            await evidenceService.upload(study.id, file);
          } catch (uploadErr) {
            console.error(`Failed uploading file ${file.name}:`, uploadErr);
          }
        }
      }

      if (mode === "create-survey") {
        // Redirect directly to the builder where Step 1 AI classification gateway awaits
        router.push(`/studies/${study.id}/survey-builder`);
      } else {
        // Redirect to all surveys list
        router.push(`/studies/${study.id}/all-surveys`);
      }

    } catch (err: any) {
      setErrorMsg(err.message || "Failed creating study blueprint.");
      setIsSubmitting(false);
    }
  };

  return (
    <PermissionGuard module="studySurvey" action="create">
      <PageContainer>
        <div className="max-w-3xl mx-auto flex flex-col min-h-[80vh] border rounded-2xl bg-white shadow-md overflow-hidden">
          {/* Header Panel */}
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 text-indigo-400 p-2 rounded-xl">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base">Blueprint Assistant</h2>
                <p className="text-xs text-slate-400">Interactive Conversational Wizard</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
              onClick={() => router.push("/studies")}
            >
              Cancel
            </Button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/50">
            {messages.map((msg) => {
              const isSystem = msg.sender === "system";
              return (
                <div key={msg.id} className={`flex gap-3 max-w-[85%] ${isSystem ? "mr-auto" : "ml-auto flex-row-reverse"}`}>
                  {/* Avatar */}
                  <div className={`size-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    isSystem ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {isSystem ? <Sparkles className="size-4" /> : <User className="size-4" />}
                  </div>

                  {/* Message Bubble */}
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    isSystem
                      ? "bg-white text-slate-800 border shadow-sm rounded-tl-none whitespace-pre-wrap"
                      : "bg-indigo-600 text-white rounded-tr-none"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {/* Step 3 Widget: Dropzone files inside chat conversation */}
            {step === 3 && (
              <div className="max-w-[80%] ml-[44px] animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border border-dashed border-slate-350 bg-white p-5 rounded-2xl text-center space-y-4 shadow-sm">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]); }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed p-4 rounded-xl cursor-pointer ${
                      isDragging ? "border-indigo-500 bg-indigo-50/20" : "border-slate-200 bg-slate-50/30 hover:border-indigo-500"
                    }`}
                  >
                    <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <UploadCloud className="size-8 text-slate-400 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-700">Drag files here or click to browse</p>
                  </div>

                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {files.map((file, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-slate-100 border text-slate-700 text-[10px] pl-2 pr-1 py-0.5 rounded flex items-center gap-1">
                          <Paperclip className="size-2.5 text-slate-400" />
                          <span className="max-w-[120px] truncate">{file.name}</span>
                          <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500">
                            <X className="size-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={handleFilesProceed}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 rounded-xl"
                  >
                    Confirm &amp; Proceed
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4 Widget: Final Actions */}
            {step === 4 && (
              <div className="max-w-[80%] ml-[44px] space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => handleFinalize("create-survey")}
                    disabled={isSubmitting}
                    className="border border-indigo-100 bg-indigo-50/40 text-left p-4 rounded-2xl hover:bg-indigo-50 transition-all flex flex-col justify-between h-28 hover:shadow"
                  >
                    <Sparkles className="size-5 text-indigo-600" />
                    <div>
                      <h4 className="font-bold text-sm text-indigo-950">Create Survey</h4>
                      <p className="text-[10px] text-indigo-850 mt-0.5 leading-snug">Let AI suggest domain and design questions.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleFinalize("save-blank")}
                    disabled={isSubmitting}
                    className="border text-left p-4 rounded-2xl bg-white hover:bg-slate-50 transition-all flex flex-col justify-between h-28 hover:shadow"
                  >
                    <ClipboardList className="size-5 text-slate-500" />
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">Save Blueprint Blank</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Store blueprint details. Configure survey later.</p>
                    </div>
                  </button>
                </div>

                {isSubmitting && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 justify-center py-2">
                    <Loader2 className="size-4 animate-spin" /> Saving study metrics &amp; files...
                  </div>
                )}

                {errorMsg && (
                  <div className="bg-red-50 border border-red-150 text-red-700 rounded-xl p-3 text-xs flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    {errorMsg}
                  </div>
                )}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Footer Input Bar */}
          <div className="border-t px-6 py-4 shrink-0 bg-white flex items-end gap-3">
            {step === 0 || step === 2 ? (
              <>
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={step === 0 ? "Type study title and press Enter..." : "Type villages separated by commas, or press Enter to skip..."}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendText(); }}
                  disabled={isSubmitting}
                  className="flex-1 h-11 border-slate-200 focus:border-indigo-500 rounded-xl"
                  autoFocus
                />
                <Button
                  onClick={handleSendText}
                  disabled={!inputValue.trim() && step === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white size-11 p-0 shrink-0 rounded-xl flex items-center justify-center"
                >
                  <Send className="size-4" />
                </Button>
              </>
            ) : step === 1 ? (
              <>
                <textarea
                  value={textareaValue}
                  onChange={(e) => setTextareaValue(e.target.value)}
                  placeholder="Describe details of the problem statement and press Cmd+Enter to send..."
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendTextarea(); }}
                  disabled={isSubmitting}
                  className="border-slate-200 focus:ring-2 focus:ring-indigo-500 bg-background flex min-h-[44px] h-11 flex-1 rounded-xl border px-3 py-2.5 text-sm focus-visible:outline-none resize-none"
                  autoFocus
                />
                <Button
                  onClick={handleSendTextarea}
                  disabled={!textareaValue.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white size-11 p-0 shrink-0 rounded-xl flex items-center justify-center"
                >
                  <Send className="size-4" />
                </Button>
              </>
            ) : (
              <div className="text-center text-xs text-slate-400 font-medium py-3.5 w-full">
                Interactive chat input disabled. Select an action bubble above to continue.
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </PermissionGuard>
  );
}

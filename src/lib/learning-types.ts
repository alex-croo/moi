export type LearningSource = { id: string; title: string; url: string; note?: string };
export type LearningContent = {
  title: string; objective: string; body: string; action: string; question: string;
  sources: LearningSource[]; limits: string; adaptations: string; reviewedOn: string;
};
export type LearningDocument = {
  id: string; module_id: string; position: number; revision: number;
  status: "draft" | "review" | "published" | "archived";
  draft: LearningContent; published: LearningContent | null; published_revision: number | null;
};
export type LearningModule = { id: string; position: number; title: string; objective: string };
export type LearningQuestion = { id: string; text: string; source: "assistant"; createdAt: string; kind?: "recall" | "followup" };
export type LearningDay = {
  date: string; document_id: string; snapshot: LearningContent & { moduleTitle: string; version: number };
  revision: number; notes: Record<string, { text: string; revision: number }>;
  adaptation: { introduction: string; experiment: string; version?:number; teaching?:string; question?:string; bridge?:string; locale?:string; recall?: {sourceDate:string;sourceTitle:string;prompt:string;hint:string;questionId:string} | null } | null;
  questions: LearningQuestion[]; quiet: boolean; reflection_skipped: boolean;
};
export type LearningMemory = { id: string; text: string; source_date: string; status: "suggested" | "confirmed"; category: string };
export type LearningState = {
  today: string; timeZone: string; personalization: boolean; day: LearningDay | null;
  pages: {date:string;title:string;documentId:string;journalDone:boolean}[];
  dates: string[]; completed: { document_id: string; completed_on: string; title: string; moduleTitle: string }[];
  memories: LearningMemory[]; currentModule: { title: string; completed: number; total: number } | null;
  waiting: boolean; encrypted: boolean;
  ai: { ready: boolean; reason: string; provider: string };
};

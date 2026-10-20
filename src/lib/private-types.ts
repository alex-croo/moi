import type { WorkspaceData } from "./types";
export type ProgramProgress = {
  completed: Record<string, string>;
  reflections: Record<string, string>;
};
export type PersonalData = Omit<WorkspaceData, "recipes" | "ingredients"> & {
  program: ProgramProgress;
};
export type JournalPrompt = {
  id: string;
  title: string;
  question: string;
  lessonId?: string;
  date?: string;
};
export type PrivateActions = {
  protection: "standard" | "enhanced";
  privacyPanel: (locale: import("./locale").Locale) => import("react").ReactNode;
  mutate: (type: string, value: object) => Promise<WorkspaceData>;
  progress: ProgramProgress;
  saveProgress: (progress: ProgramProgress) => Promise<void>;
  admin: boolean;
  userId: string;
  lock: () => void;
  backup: () => void;
};

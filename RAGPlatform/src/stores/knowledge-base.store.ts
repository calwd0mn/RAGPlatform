import { create } from "zustand";
import { KNOWLEDGE_BASE_STORAGE_KEY } from "../constants/storage";

interface KnowledgeBaseState {
  currentKnowledgeBaseId: string;
  setCurrentKnowledgeBaseId: (knowledgeBaseId: string) => void;
  clearCurrentKnowledgeBaseId: () => void;
}

function readInitialKnowledgeBaseId(): string {
  return localStorage.getItem(KNOWLEDGE_BASE_STORAGE_KEY) ?? "";
}

export const useKnowledgeBaseStore = create<KnowledgeBaseState>((set) => ({
  currentKnowledgeBaseId: readInitialKnowledgeBaseId(),
  setCurrentKnowledgeBaseId: (knowledgeBaseId: string) => {
    localStorage.setItem(KNOWLEDGE_BASE_STORAGE_KEY, knowledgeBaseId);
    set({ currentKnowledgeBaseId: knowledgeBaseId });
  },
  clearCurrentKnowledgeBaseId: () => {
    localStorage.removeItem(KNOWLEDGE_BASE_STORAGE_KEY);
    set({ currentKnowledgeBaseId: "" });
  },
}));

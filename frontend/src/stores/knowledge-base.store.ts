import { create } from "zustand";
import {
  KNOWLEDGE_BASE_IS_DEFAULT_STORAGE_KEY,
  KNOWLEDGE_BASE_NAME_STORAGE_KEY,
  KNOWLEDGE_BASE_STORAGE_KEY,
} from "../constants/storage";

interface KnowledgeBaseState {
  currentKnowledgeBaseId: string;
  currentKnowledgeBaseIsDefault: boolean;
  currentKnowledgeBaseName: string;
  setCurrentKnowledgeBaseId: (
    knowledgeBaseId: string,
    knowledgeBaseName?: string,
    knowledgeBaseIsDefault?: boolean,
  ) => void;
  clearCurrentKnowledgeBaseId: () => void;
}

function readInitialKnowledgeBaseId(): string {
  return localStorage.getItem(KNOWLEDGE_BASE_STORAGE_KEY) ?? "";
}

function readInitialKnowledgeBaseName(): string {
  return localStorage.getItem(KNOWLEDGE_BASE_NAME_STORAGE_KEY) ?? "";
}

function readInitialKnowledgeBaseIsDefault(): boolean {
  return localStorage.getItem(KNOWLEDGE_BASE_IS_DEFAULT_STORAGE_KEY) === "true";
}

export const useKnowledgeBaseStore = create<KnowledgeBaseState>((set) => ({
  currentKnowledgeBaseId: readInitialKnowledgeBaseId(),
  currentKnowledgeBaseIsDefault: readInitialKnowledgeBaseIsDefault(),
  currentKnowledgeBaseName: readInitialKnowledgeBaseName(),
  setCurrentKnowledgeBaseId: (
    knowledgeBaseId: string,
    knowledgeBaseName = "",
    knowledgeBaseIsDefault = false,
  ) => {
    localStorage.setItem(KNOWLEDGE_BASE_STORAGE_KEY, knowledgeBaseId);
    localStorage.setItem(KNOWLEDGE_BASE_NAME_STORAGE_KEY, knowledgeBaseName);
    localStorage.setItem(
      KNOWLEDGE_BASE_IS_DEFAULT_STORAGE_KEY,
      String(knowledgeBaseIsDefault),
    );
    set({
      currentKnowledgeBaseId: knowledgeBaseId,
      currentKnowledgeBaseIsDefault: knowledgeBaseIsDefault,
      currentKnowledgeBaseName: knowledgeBaseName,
    });
  },
  clearCurrentKnowledgeBaseId: () => {
    localStorage.removeItem(KNOWLEDGE_BASE_STORAGE_KEY);
    localStorage.removeItem(KNOWLEDGE_BASE_NAME_STORAGE_KEY);
    localStorage.removeItem(KNOWLEDGE_BASE_IS_DEFAULT_STORAGE_KEY);
    set({
      currentKnowledgeBaseId: "",
      currentKnowledgeBaseIsDefault: false,
      currentKnowledgeBaseName: "",
    });
  },
}));

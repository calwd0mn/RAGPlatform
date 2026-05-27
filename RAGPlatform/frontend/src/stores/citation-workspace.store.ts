import { create } from "zustand";
import type { CitationWorkspaceSelection } from "../types/citation";

interface CitationWorkspaceStore {
  selectedCitation: CitationWorkspaceSelection | null;
  setSelectedCitation: (selectedCitation: CitationWorkspaceSelection) => void;
  clearSelectedCitation: () => void;
}

export const useCitationWorkspaceStore = create<CitationWorkspaceStore>((set) => ({
  selectedCitation: null,
  setSelectedCitation: (selectedCitation) => set({ selectedCitation }),
  clearSelectedCitation: () => set({ selectedCitation: null }),
}));


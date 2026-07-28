import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { ChunkProgress, MapChunk } from "../types";
import { calculateStars } from "../utils/stats";

export type GuestChunkProgress = Omit<ChunkProgress, "updatedAt">;

interface GuestProgressInput {
  chunkId: string;
  wpm: number;
  accuracy: number;
  currentSequence: number;
  isCompleted?: boolean;
}

export interface GuestProgressState {
  progressByChunk: Record<string, GuestChunkProgress>;
  reportProgress: (input: GuestProgressInput) => GuestChunkProgress;
}

function emptyProgress(): GuestChunkProgress {
  return {
    highestWpm: 0,
    highestAccuracy: 0,
    starsEarned: 0,
    lastNodeSequence: 1,
    isCompleted: false
  };
}

export function createGuestProgressStore() {
  return createStore<GuestProgressState>((set, get) => ({
    progressByChunk: {},
    reportProgress: (input) => {
      const current = get().progressByChunk[input.chunkId] ?? emptyProgress();
      const starsEarned = calculateStars(input.wpm, input.accuracy);
      const next: GuestChunkProgress = {
        highestWpm: Math.max(current.highestWpm, input.wpm),
        highestAccuracy: Math.max(current.highestAccuracy, input.accuracy),
        starsEarned: Math.max(current.starsEarned, starsEarned),
        lastNodeSequence: Math.max(current.lastNodeSequence, Math.max(1, input.currentSequence)),
        isCompleted: current.isCompleted || (input.isCompleted ?? starsEarned > 0)
      };
      set((state) => ({ progressByChunk: { ...state.progressByChunk, [input.chunkId]: next } }));
      return next;
    }
  }));
}

export function applyGuestProgress(chunks: MapChunk[], progressByChunk: Record<string, GuestChunkProgress>) {
  const completedChunkIds = new Set(
    Object.entries(progressByChunk)
      .filter(([, progress]) => progress.isCompleted)
      .map(([chunkId]) => chunkId)
  );

  return chunks.map((chunk) => ({
    ...chunk,
    progress: progressByChunk[chunk.id] ?? emptyProgress(),
    locked: chunk.dependencies.some((dependencyId) => !completedChunkIds.has(dependencyId))
  }));
}

export const guestProgressStore = createGuestProgressStore();

export function useGuestProgress<T>(selector: (state: GuestProgressState) => T) {
  return useStore(guestProgressStore, selector);
}

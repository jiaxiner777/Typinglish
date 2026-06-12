import { create } from "zustand";
import type { InputMode } from "../types";

interface Metrics {
  wpm: number;
  accuracy: number;
  elapsedSeconds: number;
}

interface TypingCoreState {
  sourceText: string;
  charArray: string[];
  userInput: string[];
  currentIndex: number;
  startTime: number | null;
  endTime: number | null;
  hasStarted: boolean;
  errorCount: number;
  wrongIndices: Set<number>;
  inputMode: InputMode;
  completed: boolean;
  completionId: number;
  shakeTick: number;
  reset: (sourceText: string, inputMode?: InputMode) => void;
  setInputMode: (inputMode: InputMode) => void;
  commitCharacter: (key: string) => void;
  metrics: () => Metrics;
}

function isIgnoredKey(key: string) {
  return ["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "Escape", "Enter"].includes(key);
}

function calculateMetrics(state: Pick<TypingCoreState, "charArray" | "startTime" | "endTime" | "errorCount">): Metrics {
  const start = state.startTime ?? Date.now();
  const end = state.endTime ?? Date.now();
  const elapsedSeconds = Math.max((end - start) / 1000, 1);
  const typedChars = state.charArray.length;
  const wpm = Math.round((typedChars / 5 / (elapsedSeconds / 60)) * 10) / 10;
  const accuracy = Math.max(0, Math.round(((typedChars - state.errorCount) / Math.max(typedChars, 1)) * 1000) / 10);
  return { wpm, accuracy, elapsedSeconds };
}

export const useTypingCore = create<TypingCoreState>((set, get) => ({
  sourceText: "",
  charArray: [],
  userInput: [],
  currentIndex: 0,
  startTime: null,
  endTime: null,
  hasStarted: false,
  errorCount: 0,
  wrongIndices: new Set<number>(),
  inputMode: "STRICT",
  completed: false,
  completionId: 0,
  shakeTick: 0,

  reset: (sourceText, inputMode) =>
    set((state) => ({
      sourceText,
      charArray: sourceText.split(""),
      userInput: [],
      currentIndex: 0,
      startTime: null,
      endTime: null,
      hasStarted: false,
      errorCount: 0,
      wrongIndices: new Set<number>(),
      inputMode: inputMode ?? state.inputMode,
      completed: false,
      shakeTick: 0
    })),

  setInputMode: (inputMode) => set({ inputMode }),

  commitCharacter: (key) => {
    if (isIgnoredKey(key)) return;

    set((state) => {
      if (state.completed || state.charArray.length === 0) return state;

      const nextState = {
        ...state,
        userInput: [...state.userInput],
        wrongIndices: new Set(state.wrongIndices),
        startTime: state.startTime ?? Date.now()
      };

      if (key === "Backspace") {
        if (nextState.currentIndex > 0) {
          nextState.currentIndex -= 1;
          nextState.userInput.pop();
          if (nextState.inputMode === "TOLERANT") {
            nextState.wrongIndices.delete(nextState.currentIndex);
          }
        }
        return nextState;
      }

      if (key.length !== 1) return nextState;

      const targetChar = nextState.charArray[nextState.currentIndex];
      nextState.hasStarted = true;

      if (nextState.inputMode === "STRICT") {
        if (key === targetChar) {
          nextState.userInput.push(key);
          nextState.currentIndex += 1;
        } else {
          nextState.errorCount += 1;
          nextState.shakeTick += 1;
        }
      } else {
        if (key !== targetChar) {
          nextState.wrongIndices.add(nextState.currentIndex);
          nextState.errorCount += 1;
        }
        nextState.userInput.push(key);
        nextState.currentIndex += 1;
      }

      if (nextState.currentIndex === nextState.charArray.length) {
        nextState.completed = true;
        nextState.endTime = Date.now();
        nextState.completionId += 1;
      }

      return nextState;
    });
  },

  metrics: () => calculateMetrics(get())
}));

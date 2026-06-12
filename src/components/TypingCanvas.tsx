import { useEffect, useLayoutEffect, useRef } from "react";
import { useTypingCore } from "../store/typingCore";
import type { InputMode } from "../types";

interface TypingCanvasProps {
  text: string;
  inputMode: InputMode;
  compact?: boolean;
  resetToken?: number;
  onComplete?: (event: { text: string; resetToken: number }) => void;
}

export function TypingCanvas({ text, inputMode, compact = false, resetToken = 0, onComplete }: TypingCanvasProps) {
  const completionNotified = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const handledCompletionId = useRef(useTypingCore.getState().completionId);
  const {
    sourceText,
    charArray,
    userInput,
    currentIndex,
    wrongIndices,
    completed,
    hasStarted,
    completionId,
    shakeTick,
    reset,
    setInputMode,
    commitCharacter
  } = useTypingCore();

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useLayoutEffect(() => {
    completionNotified.current = false;
    reset(text, inputMode);
    handledCompletionId.current = useTypingCore.getState().completionId;
  }, [inputMode, reset, resetToken, text]);

  useEffect(() => {
    setInputMode(inputMode);
  }, [inputMode, setInputMode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      commitCharacter(event.key);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commitCharacter]);

  useEffect(() => {
    const reallyFinished =
      completionId !== handledCompletionId.current &&
      sourceText === text &&
      hasStarted &&
      completed &&
      charArray.length > 0 &&
      charArray.length === text.length &&
      userInput.length === charArray.length &&
      currentIndex === charArray.length;
    if (reallyFinished && !completionNotified.current) {
      completionNotified.current = true;
      handledCompletionId.current = completionId;
      onCompleteRef.current?.({ text, resetToken });
    }
  }, [charArray.length, completed, completionId, currentIndex, hasStarted, resetToken, sourceText, text, userInput.length]);

  return (
    <div
      key={shakeTick}
      className={[
        "screen-shake relative outline-none",
        compact ? "font-mono text-[20px] leading-[2.25rem] sm:text-[24px]" : "font-mono text-2xl leading-10 sm:text-3xl sm:leading-[3.25rem]"
      ].join(" ")}
      tabIndex={0}
    >
      {charArray.map((char, index) => {
        const typed = index < currentIndex;
        const wrong = wrongIndices.has(index);
        const active = index === currentIndex && !completed;

        return (
          <span
            key={`${char}-${index}`}
            className={[
              "relative whitespace-pre-wrap border-l-2 border-transparent",
              typed && !wrong ? "text-emerald-300" : "",
              typed && wrong ? "text-rose-400" : "",
              !typed ? "text-stone-500" : "",
              active ? "cursor-blink border-emerald-300 bg-emerald-300/10" : ""
            ].join(" ")}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
}

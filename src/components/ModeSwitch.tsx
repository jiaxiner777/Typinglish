import { BookOpen, Map, RotateCcw } from "lucide-react";
import type { InputMode } from "../types";

interface ModeSwitchProps {
  view: "adventure" | "zen";
  inputMode: InputMode;
  onViewChange: (view: "adventure" | "zen") => void;
  onInputModeChange: (mode: InputMode) => void;
}

export function ModeSwitch({ view, inputMode, onViewChange, onInputModeChange }: ModeSwitchProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border border-white/10 bg-black/20 p-1">
        <button
          className={`flex h-9 items-center gap-2 rounded px-3 text-sm ${view === "adventure" ? "bg-emerald-400 text-stone-950" : "text-stone-300"}`}
          onClick={() => onViewChange("adventure")}
          type="button"
        >
          <Map size={16} />
          冒险
        </button>
        <button
          className={`flex h-9 items-center gap-2 rounded px-3 text-sm ${view === "zen" ? "bg-emerald-400 text-stone-950" : "text-stone-300"}`}
          onClick={() => onViewChange("zen")}
          type="button"
        >
          <BookOpen size={16} />
          纯净
        </button>
      </div>
      <div className="flex rounded-md border border-white/10 bg-black/20 p-1">
        <button
          className={`flex h-9 items-center gap-2 rounded px-3 text-sm ${inputMode === "STRICT" ? "bg-sky-300 text-stone-950" : "text-stone-300"}`}
          onClick={() => onInputModeChange("STRICT")}
          type="button"
          title="错字死锁"
        >
          <RotateCcw size={16} />
          退回
        </button>
        <button
          className={`h-9 rounded px-3 text-sm ${inputMode === "TOLERANT" ? "bg-sky-300 text-stone-950" : "text-stone-300"}`}
          onClick={() => onInputModeChange("TOLERANT")}
          type="button"
          title="错字前行"
        >
          容错
        </button>
      </div>
    </div>
  );
}

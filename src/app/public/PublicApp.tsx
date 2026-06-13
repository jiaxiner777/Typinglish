import { Keyboard, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchSources } from "../../api/public";
import { ModeSwitch } from "../../components/ModeSwitch";
import type { InputMode, Source } from "../../types";
import { AdventureView } from "../../views/AdventureView";
import { ZenView } from "../../views/ZenView";

export function PublicApp() {
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState<string>("");
  const [view, setView] = useState<"adventure" | "zen">("adventure");
  const [inputMode, setInputMode] = useState<InputMode>("STRICT");

  useEffect(() => {
    fetchSources()
      .then((items) => {
        const adventureSources = items.filter((source) => source.type !== "BOOK");
        setSources(adventureSources);
        setSourceId(adventureSources[0]?.id ?? "");
      })
      .catch(console.error);
  }, []);

  const selectedSource = useMemo(() => sources.find((source) => source.id === sourceId) ?? null, [sourceId, sources]);

  if (view === "zen") {
    return <ZenView inputMode={inputMode} onExit={() => setView("adventure")} />;
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-300 text-stone-950">
            <Keyboard size={24} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-stone-50">Typinglish 字里行间</h1>
            <p className="text-sm text-stone-400">English muscle memory trainer / PostgreSQL content flow</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-11 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-stone-100 outline-none"
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.title}
              </option>
            ))}
          </select>
          <ModeSwitch view={view} inputMode={inputMode} onViewChange={setView} onInputModeChange={setInputMode} />
          <a className="flex h-11 items-center gap-2 rounded-md border border-sky-300/30 bg-sky-300/10 px-3 text-sm text-sky-100" href="/admin">
            <Shield size={16} />
            内容后台
          </a>
        </div>
      </header>

      <AdventureView source={selectedSource} inputMode={inputMode} />
    </div>
  );
}

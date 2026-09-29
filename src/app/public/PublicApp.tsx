import { Keyboard, LogOut, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchCurrentUser, fetchSources, login, logout, register } from "../../api";
import { ModeSwitch } from "../../components/ModeSwitch";
import { ANONYMOUS_IDENTITY, type AuthUser, type Identity, type InputMode, type Source } from "../../types";
import { AdventureView } from "../../views/AdventureView";
import { ZenView } from "../../views/ZenView";

export function PublicApp() {
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState<string>("");
  const [view, setView] = useState<"adventure" | "zen">("adventure");
  const [inputMode, setInputMode] = useState<InputMode>("STRICT");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authView, setAuthView] = useState<null | "login" | "register">(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Fetch current user on mount
  useEffect(() => {
    fetchCurrentUser()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  // Fetch sources on mount
  useEffect(() => {
    fetchSources()
      .then((items) => {
        const adventureSources = items.filter((source) => source.type !== "BOOK");
        setSources(adventureSources);
        setSourceId(adventureSources[0]?.id ?? "");
      })
      .catch(console.error);
  }, []);

  const identity: Identity = useMemo(
    () =>
      user
        ? { kind: "authenticated", userId: user.id, email: user.email, displayName: user.displayName }
        : ANONYMOUS_IDENTITY,
    [user]
  );

  const selectedSource = useMemo(() => sources.find((source) => source.id === sourceId) ?? null, [sourceId, sources]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    try {
      if (authView === "register") {
        const res = await register(authEmail, authPassword);
        setUser(res.user);
      } else {
        const res = await login(authEmail, authPassword);
        setUser(res.user);
      }
      setAuthView(null);
      setAuthEmail("");
      setAuthPassword("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // ignore
    }
    setUser(null);
  }

  if (view === "zen") {
    return <ZenView identity={identity} inputMode={inputMode} onExit={() => setView("adventure")} />;
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
            <p className="text-sm text-stone-400">用短句和故事，练习英文输入</p>
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
          <ModeSwitch view={view} inputMode={inputMode} onViewChange={setView} onInputModeChange={setInputMode} showInputMode={false} />

          {/* Auth area */}
          {authLoading ? null : user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-stone-300">{user.email}</span>
              <button
                className="flex h-11 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-stone-200 hover:bg-black/50"
                onClick={() => void handleLogout()}
                type="button"
              >
                <LogOut size={16} />
                退出
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                className="flex h-11 items-center rounded-md border border-white/10 bg-black/30 px-3 text-sm text-stone-200 hover:bg-black/50"
                onClick={() => { setAuthView("login"); setAuthError(""); }}
                type="button"
              >
                登录
              </button>
              <button
                className="flex h-11 items-center rounded-md bg-emerald-300 px-3 text-sm font-semibold text-stone-950 hover:bg-emerald-200"
                onClick={() => { setAuthView("register"); setAuthError(""); }}
                type="button"
              >
                注册
              </button>
            </div>
          )}

        </div>
      </header>

      <AdventureView key={user?.id ?? "guest"} identity={identity} source={selectedSource} />

      {/* Auth modal */}
      {authView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setAuthView(null)}>
          <div
            className="w-[min(92vw,380px)] rounded-md border border-white/10 bg-stone-950 p-6 shadow-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-50">
                {authView === "register" ? "注册账号" : "登录"}
              </h2>
              <button onClick={() => setAuthView(null)} className="text-stone-400 hover:text-stone-200" type="button">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => void handleAuthSubmit(e)} className="space-y-4">
              <input
                type="email"
                placeholder="邮箱"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="h-11 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-stone-100 outline-none"
                required
              />
              <input
                type="password"
                placeholder="密码（至少 8 位）"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="h-11 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-stone-100 outline-none"
                required
                minLength={8}
              />
              {authError && <p className="text-sm text-rose-300">{authError}</p>}
              <button
                type="submit"
                className="h-11 w-full rounded-md bg-emerald-300 font-semibold text-stone-950 hover:bg-emerald-200"
              >
                {authView === "register" ? "注册" : "登录"}
              </button>
              <p className="text-center text-sm text-stone-400">
                {authView === "register" ? "已有账号？" : "没有账号？"}
                <button
                  type="button"
                  className="ml-1 text-emerald-300 hover:underline"
                  onClick={() => { setAuthView(authView === "register" ? "login" : "register"); setAuthError(""); }}
                >
                  {authView === "register" ? "去登录" : "去注册"}
                </button>
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

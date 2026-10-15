import { onUnmounted, reactive, ref } from "vue/dist/vue.esm-bundler.js";
import { client, explain } from "./api.ts";

// Old P2 tokens are no longer browser-readable credentials. Existing users sign in once again.
try { localStorage.removeItem("gamexplorer-session"); } catch { /* Storage may be disabled. */ }

export const account = reactive({
  user: null as { user: string; username: string } | null,
  ready: false,
});
export const notice = reactive({ text: "", kind: "ok" as "ok" | "error" });
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
export function notify(text: string, kind: "ok" | "error" = "ok") {
  clearTimeout(noticeTimer);
  notice.text = text;
  notice.kind = kind;
  if (kind === "ok") noticeTimer = setTimeout(() => { notice.text = ""; }, 8000);
}
let accountRevision = 0;
export function clearAccount() {
  accountRevision++;
  account.user = null;
}
export async function restoreSession() {
  const revision = ++accountRevision;
  try {
    const result = await client.auth.me({});
    if (accountRevision !== revision) return;
    if ("error" in result) {
      if (result.error === "UNAUTHORIZED") clearAccount();
      else notify(explain(result.error), "error");
    } else account.user = result.me;
  } catch {
    notify("Could not check your session. Check your connection and try signing in again.", "error");
  } finally { account.ready = true; }
}

/** Page requests stop updating the interface once that page/account is gone. */
export function useRequest() {
  const busy = ref(false);
  const error = ref("");
  let live = true;
  onUnmounted(() => { live = false; });
  async function run<T>(request: () => Promise<T>): Promise<T | undefined> {
    if (!live || busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      const result = await request();
      return live ? result : undefined;
    } catch {
      if (live) error.value = "Could not connect. Your input is still here; check your connection and try again.";
    } finally { if (live) busy.value = false; }
  }
  function fail(code: string, messages: Partial<Record<string, string>> = {}) {
    error.value = explain(code, messages);
    if (code === "UNAUTHORIZED") {
      clearAccount();
      notify("Your session has ended. Sign in again to continue.", "error");
    }
  }
  return { busy, error, run, fail };
}

export type Page =
  | { name: "catalog" | "discover" | "mine" | "commons" }
  | { name: "game"; game: string; aspect?: string };

export function readPage(): Page {
  if (window.location.pathname === "/auth/commons/callback") return { name: "commons" };
  const route = window.location.hash.slice(1);
  const [path = "", query = ""] = route.split("?");
  if (path.startsWith("/games/")) {
    const game = path.slice("/games/".length);
    if (game) return { name: "game", game, aspect: new URLSearchParams(query).get("aspect") ?? undefined };
  }
  if (path === "/discover") return { name: "discover" };
  if (path === "/mine") return { name: "mine" };
  return { name: "catalog" };
}
export function gameHref(game: string, aspect?: string) {
  return `#/games/${encodeURIComponent(game)}${aspect ? `?aspect=${encodeURIComponent(aspect)}` : ""}`;
}

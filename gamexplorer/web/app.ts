import { computed, createApp, nextTick, onMounted, onUnmounted, reactive, ref } from "vue/dist/vue.esm-bundler.js";
import { client, explain } from "./api.ts";
import CatalogPage from "./pages/CatalogPage.ts";
import GamePage from "./pages/GamePage.ts";
import DiscoverPage from "./pages/DiscoverPage.ts";
import MyRatingsPage from "./pages/MyRatingsPage.ts";
import CommonsCallback from "./pages/CommonsCallback.ts";
import { account, notice, notify, readPage, restoreSession, clearAccount } from "./state.ts";

const App = {
  components: { CatalogPage, GamePage, DiscoverPage, MyRatingsPage, CommonsCallback },
  setup() {
    const page = ref(readPage());
    const dialog = ref<HTMLDialogElement | null>(null);
    const auth = reactive({ username: "", password: "", mode: "login" as "login" | "register" });
    const authBusy = ref(false);
    const authError = ref("");
    const signingOut = ref(false);
    const pageKey = computed(() => page.value.name === "commons" ? "commons" : [page.value.name, account.user?.user ?? "public", page.value.name === "game" ? page.value.game + (page.value.aspect ?? "") : ""].join(":"));
    const currentComponent = computed(() => ({ catalog: "CatalogPage", game: "GamePage", discover: "DiscoverPage", mine: "MyRatingsPage", commons: "CommonsCallback" })[page.value.name]);
    function focusMain() { document.getElementById("main-content")?.focus(); }
    function onNavigation() {
      page.value = readPage();
      nextTick(() => {
        const heading = document.querySelector<HTMLElement>("main h1");
        heading?.setAttribute("tabindex", "-1");
        heading?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: "instant" });
      });
    }
    async function openAuth() {
      auth.mode = "login";
      authError.value = "";
      await nextTick();
      dialog.value?.showModal();
    }
    function closeAuth() {
      if (authBusy.value) return;
      dialog.value?.close();
      auth.password = "";
      authError.value = "";
    }
    function cancelAuth(event: Event) {
      if (authBusy.value) event.preventDefault();
      else { auth.password = ""; authError.value = ""; }
    }
    function toggleAuthMode() {
      auth.mode = auth.mode === "login" ? "register" : "login";
      authError.value = "";
    }
    async function submitAuth() {
      if (authBusy.value) return;
      if (!auth.username.trim() || !auth.password) { authError.value = "Enter your username and password."; return; }
      authBusy.value = true;
      authError.value = "";
      try {
        const input = { username: auth.username, password: auth.password };
        const result = auth.mode === "register" ? await client.auth.register(input) : await client.auth.login(input);
        if ("error" in result) {
          authError.value = explain(result.error, {
            CONFLICT: "That username is taken. Choose another, or sign in if it is yours.",
            UNAUTHORIZED: "The username or password did not match. Check both and try again.",
            INVALID_REQUEST: "Enter your username and password.",
          });
          return;
        }
        account.user = { user: result.user, username: input.username.trim() };
        account.ready = true;
        notify(`Signed in as ${account.user.username}.`);
        auth.password = "";
        dialog.value?.close();
      } catch { authError.value = "Could not connect. Check your connection and try again."; }
      finally { authBusy.value = false; }
    }
    async function logout() {
      if (!account.user || signingOut.value) return;
      signingOut.value = true;
      try {
        const result = await client.auth.logout({});
        if ("error" in result && result.error !== "UNAUTHORIZED") { notify(explain(result.error), "error"); return; }
        clearAccount();
        notify("Signed out.");
      } catch { notify("Could not sign out. Check your connection and try again.", "error"); }
      finally { signingOut.value = false; }
    }
    async function startCommons() {
      if (authBusy.value) return;
      authBusy.value = true;
      authError.value = "";
      try {
        const result = await client.auth.commons.start({});
        if ("error" in result) { authError.value = "Could not start Commons sign-in. Try again."; return; }
        window.location.assign(result.address);
      } catch { authError.value = "Could not connect. Try again."; }
      finally { authBusy.value = false; }
    }
    async function finishCommons() {
      await restoreSession();
      page.value = readPage();
    }
    onMounted(() => {
      window.addEventListener("hashchange", onNavigation);
      if (page.value.name === "commons") account.ready = true;
      else restoreSession();
    });
    onUnmounted(() => window.removeEventListener("hashchange", onNavigation));
    return {
      account, notice, page, pageKey, currentComponent, dialog, auth, authBusy, authError,
      signingOut, openAuth, closeAuth, cancelAuth, toggleAuthMode, submitAuth, logout, focusMain, startCommons, finishCommons,
    };
  },
  template: `
    <a class="skip-link" href="#main-content" @click.prevent="focusMain">Skip to content</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="wordmark" href="#/catalog" aria-label="Gamexplorer home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>game<span class="wordmark-accent">x</span>plorer<span class="brand-dot">.</span></span></a>
        <nav aria-label="Main navigation"><a href="#/catalog" :class="{ active: page.name === 'catalog' || page.name === 'game' }" :aria-current="page.name === 'catalog' ? 'page' : undefined">Catalog</a><a href="#/discover" :class="{ active: page.name === 'discover' }" :aria-current="page.name === 'discover' ? 'page' : undefined">Discover</a><a v-if="account.user" href="#/mine" :class="{ active: page.name === 'mine' }" :aria-current="page.name === 'mine' ? 'page' : undefined">My ratings</a></nav>
        <div class="account-controls"><template v-if="account.user"><span class="account-name"><span class="account-dot" aria-hidden="true"></span>{{ account.user.username }}</span><button class="text-button" @click="logout" :disabled="signingOut">{{ signingOut ? 'Signing out…' : 'Sign out' }}</button></template><button v-else class="button secondary" @click="openAuth" :disabled="!account.ready">{{ account.ready ? 'Sign in' : 'Checking session…' }} <span aria-hidden="true">↗</span></button></div>
      </div>
    </header>
    <main id="main-content" tabindex="-1">
      <div v-if="notice.text" class="feedback notice" :class="notice.kind" :role="notice.kind === 'error' ? 'alert' : 'status'"><span><span class="feedback-symbol" aria-hidden="true">{{ notice.kind === 'error' ? '!' : '✓' }}</span>{{ notice.text }}</span><button class="notice-close" @click="notice.text = ''" aria-label="Dismiss message">×</button></div>
      <div v-if="!account.ready" class="loading-state" role="status">Loading…</div>
      <component v-else :is="currentComponent" :key="pageKey" :game="page.name === 'game' ? page.game : undefined" :focus-aspect="page.name === 'game' ? page.aspect : undefined" @sign-in="openAuth" @done="finishCommons" />
    </main>
    <dialog ref="dialog" class="auth-dialog" aria-labelledby="auth-heading" @cancel="cancelAuth" @click="($event.target === dialog) && closeAuth()">
      <button class="dialog-close" @click="closeAuth" :disabled="authBusy" aria-label="Close sign-in dialog">×</button>
      <h2 id="auth-heading">{{ auth.mode === 'register' ? 'Create account' : 'Sign in' }}</h2>
      <button class="primary full-button commons-sign-in" type="button" @click="startCommons" :disabled="authBusy">{{ authBusy ? 'Opening…' : 'Sign in with Commons' }}</button>
      <p v-if="authError" class="feedback error" role="alert">{{ authError }}</p>
      <details class="password-sign-in"><summary>Use a local account</summary>
      <form @submit.prevent="submitAuth"><div class="field"><label for="auth-username">Username</label><input id="auth-username" v-model="auth.username" name="username" autocomplete="username" required autofocus :disabled="authBusy"></div><div class="field"><label for="auth-password">Password</label><input id="auth-password" v-model="auth.password" name="password" type="password" :autocomplete="auth.mode === 'register' ? 'new-password' : 'current-password'" required :disabled="authBusy"></div><button class="primary full-button" :disabled="authBusy">{{ authBusy ? 'Please wait…' : auth.mode === 'register' ? 'Create account' : 'Sign in' }} <span aria-hidden="true">↗</span></button></form>
      <p class="auth-switch"><button class="text-button" @click="toggleAuthMode" :disabled="authBusy">{{ auth.mode === 'register' ? 'Sign in' : 'Create an account' }}</button></p></details>
    </dialog>
  `,
};

createApp(App).mount("#app");

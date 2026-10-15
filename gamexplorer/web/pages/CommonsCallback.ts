import { defineComponent, onMounted, ref } from "vue/dist/vue.esm-bundler.js";
import { client } from "../api.ts";

/** ConceptBox's callback flow, adapted to Gamexplorer's hash navigation and error messages. */
export default defineComponent({
  emits: ["done"],
  setup(_props, { emit }) {
    const choosing = ref(false);
    const username = ref("");
    const error = ref("");
    const busy = ref(true);
    async function accept(result: { error?: string; user?: string }) {
      if (result.error) {
        if (result.error === "CONFLICT" || result.error === "INVALID_REQUEST") {
          choosing.value = true;
          error.value = result.error === "CONFLICT" ? "That username is taken here. Choose another." : "Choose a username with 3 to 32 letters, digits, underscores, or hyphens.";
        } else error.value = "Commons sign-in could not be completed. Start again from Sign in.";
      } else {
        emit("done");
      }
    }
    onMounted(async () => {
      const query = new URLSearchParams(window.location.search);
      window.history.replaceState(null, "", "/#/catalog");
      try {
        if (query.get("error") === "access_denied") error.value = "Commons sign-in was cancelled.";
        else if (!query.get("state") || !query.get("code")) error.value = "This sign-in link is incomplete. Start again from Sign in.";
        else await accept(await client.auth.commons.finish({ state: query.get("state")!, code: query.get("code")! }));
      } catch { error.value = "Could not connect. Start again from Sign in."; }
      finally { busy.value = false; }
    });
    async function choose() {
      if (busy.value) return;
      busy.value = true;
      error.value = "";
      try { await accept(await client.auth.commons.choose({ username: username.value.trim() })); }
      catch { error.value = "Could not connect. Your username is still here; try again."; }
      finally { busy.value = false; }
    }
    return { choosing, username, error, busy, choose };
  },
  template: `
    <section class="commons-callback" aria-labelledby="commons-heading">
      <h1 id="commons-heading">{{ choosing ? 'Choose a username' : 'Commons sign-in' }}</h1>
      <p v-if="busy" role="status">Signing in…</p>
      <p v-if="error" class="feedback error" role="alert">{{ error }}</p>
      <form v-if="choosing" @submit.prevent="choose">
        <div class="field"><label for="commons-username">Username</label><input id="commons-username" v-model="username" autocomplete="username" autocapitalize="off" spellcheck="false" minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]{3,32}" required :disabled="busy" aria-describedby="commons-username-rule"><span id="commons-username-rule" class="muted">3–32 letters, digits, underscores, or hyphens.</span></div>
        <button class="primary" :disabled="busy">Continue</button>
      </form>
      <button v-if="!busy" class="text-button" @click="$emit('done')">Back to catalog</button>
    </section>`,
});

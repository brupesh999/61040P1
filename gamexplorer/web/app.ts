import { computed, createApp, reactive, ref, watch } from "vue/dist/vue.esm-bundler.js";
import { client, explain } from "./api.ts";

type Page = { name: "discover" } | { name: "catalog" } | { name: "game"; game: string } | { name: "mine" };

const SESSION_KEY = "gamexplorer-session";

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(session: string | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, session);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: the session just won't survive a reload */
  }
}

const App = {
  setup() {
    const session = ref<string | null>(readSession());
    const username = ref<string | null>(null);
    const page = ref<Page>({ name: "catalog" });
    const flash = reactive({ text: "", kind: "ok" as "ok" | "error" });

    function say(text: string, kind: "ok" | "error" = "ok") {
      flash.text = text;
      flash.kind = kind;
    }

    /** A 401 anywhere means the stored session is dead; drop it so the UI asks to log in. */
    function handleError(error: string, messages: Partial<Record<string, string>> = {}) {
      if (error === "UNAUTHORIZED" && !messages.UNAUTHORIZED) {
        session.value = null;
        username.value = null;
        writeSession(null);
      }
      say(explain(error, messages), "error");
    }

    // ---------- accounts ----------
    const auth = reactive({ username: "", password: "", mode: "login" as "login" | "register" });

    async function refreshMe() {
      if (!session.value) return;
      const result = await client.auth.me({ session: session.value });
      if ("error" in result) handleError(result.error);
      else username.value = result.me.username;
    }

    async function submitAuth() {
      if (!auth.username.trim() || !auth.password) {
        say("Enter a username and a password.", "error");
        return;
      }
      const input = { username: auth.username, password: auth.password };
      const result =
        auth.mode === "register" ? await client.auth.register(input) : await client.auth.login(input);
      if ("error" in result) {
        handleError(result.error, {
          CONFLICT: "That username is already taken.",
          UNAUTHORIZED: "Invalid username or password.",
          INVALID_REQUEST: "Username and password must not be empty.",
        });
        return;
      }
      session.value = result.session;
      writeSession(result.session);
      auth.password = "";
      await refreshMe();
      say(auth.mode === "register" ? `Welcome, ${username.value}!` : `Logged in as ${username.value}.`);
      await reloadPage();
    }

    async function logout() {
      if (session.value) await client.auth.logout({ session: session.value });
      session.value = null;
      username.value = null;
      writeSession(null);
      say("Logged out.");
    }

    // ---------- catalog ----------
    const query = ref("");
    const games = ref<Array<{ game: string; title: string; developer: string; releaseYear: number }>>([]);
    const newGame = reactive({ title: "", developer: "", releaseYear: new Date().getFullYear() });

    async function search() {
      const result = await client.games.search({ query: query.value });
      if ("error" in result) handleError(result.error);
      else games.value = result.results.games;
    }

    async function addGame() {
      if (!session.value) return say("Log in to add a game.", "error");
      const result = await client.games.add({
        session: session.value,
        title: newGame.title,
        developer: newGame.developer,
        releaseYear: Number(newGame.releaseYear),
      });
      if ("error" in result) {
        return handleError(result.error, {
          CONFLICT: "A game with this title already exists.",
          INVALID_REQUEST: "A game needs a title, a developer, and a release year from 1950 to 2100.",
        });
      }
      say(`Added "${newGame.title}".`);
      newGame.title = "";
      newGame.developer = "";
      await search();
    }

    // ---------- game detail ----------
    type GamePage = Extract<Awaited<ReturnType<typeof client.games.detail>>, { page: unknown }>["page"];
    const detail = ref<GamePage | null>(null);
    const newAspect = reactive({ name: "", description: "" });
    const drafts = reactive<Record<string, { score: number; microNote: string }>>({});
    const expanded = reactive<Record<string, boolean>>({});

    function myRatingOf(aspect: GamePage["aspects"][number]) {
      return aspect.ratings.find((r) => r.reviewer?.username === username.value);
    }

    async function loadGame(game: string) {
      const result = await client.games.detail({ game });
      if ("error" in result) {
        detail.value = null;
        return handleError(result.error, { NOT_FOUND: "That game does not exist." });
      }
      detail.value = result.page;
      for (const aspect of result.page.aspects) {
        const mine = myRatingOf(aspect);
        drafts[aspect.aspect] ??= { score: mine?.score ?? 7, microNote: mine?.microNote ?? "" };
      }
    }

    async function createAspect() {
      if (!session.value || !detail.value) return say("Log in to add an aspect.", "error");
      const result = await client.aspects.create({
        session: session.value,
        game: detail.value.game,
        name: newAspect.name,
        description: newAspect.description,
      });
      if ("error" in result) {
        return handleError(result.error, {
          CONFLICT: "This aspect already exists for this game.",
          INVALID_REQUEST: "An aspect needs a name.",
        });
      }
      say(`Added aspect "${newAspect.name}".`);
      newAspect.name = "";
      newAspect.description = "";
      await loadGame(detail.value.game);
    }

    async function rate(aspect: string) {
      if (!session.value || !detail.value) return say("Log in to rate.", "error");
      const draft = drafts[aspect];
      const score = Number(draft.score);
      if (!Number.isInteger(score) || score < 1 || score > 10) {
        return say("Score must be an integer between 1 and 10.", "error");
      }
      if (draft.microNote.length > 280) return say("A tiny review must be at most 280 characters.", "error");
      const result = await client.ratings.rate({ session: session.value, aspect, score, microNote: draft.microNote });
      if ("error" in result) {
        return handleError(result.error, {
          INVALID_REQUEST: "Score must be an integer between 1 and 10, and a tiny review at most 280 characters.",
          NOT_FOUND: "That aspect no longer exists.",
        });
      }
      say("Rating saved.");
      await loadGame(detail.value.game);
    }

    async function unrate(aspect: string) {
      if (!session.value || !detail.value) return;
      const result = await client.ratings.remove({ session: session.value, aspect });
      if ("error" in result) return handleError(result.error, { NOT_FOUND: "You have not rated this aspect." });
      say("Rating removed.");
      delete drafts[aspect];
      await loadGame(detail.value.game);
    }

    // ---------- discovery ----------
    type Results = Extract<Awaited<ReturnType<typeof client.discover.results>>, { results: unknown }>["results"];
    const discovery = ref<Results | null>(null);
    const filterDraft = reactive({ aspectName: "", minScore: 8 });

    function applyResults(result: { results: Results } | { error: string }, messages = {}) {
      if ("error" in result) return handleError(result.error, messages);
      discovery.value = result.results;
    }

    async function loadDiscovery() {
      if (!session.value) return;
      applyResults(await client.discover.results({ session: session.value }));
    }

    async function setFilter() {
      if (!session.value) return say("Log in to save filters.", "error");
      const minScore = Number(filterDraft.minScore);
      if (!filterDraft.aspectName.trim()) return say("Choose an aspect to filter on.", "error");
      if (!(minScore >= 1 && minScore <= 10)) return say("Threshold score must be between 1 and 10.", "error");
      applyResults(
        await client.discover.set({ session: session.value, aspectName: filterDraft.aspectName, minScore }),
        { INVALID_REQUEST: "Threshold score must be between 1 and 10." },
      );
      filterDraft.aspectName = "";
    }

    async function removeFilter(aspectName: string) {
      if (!session.value) return;
      applyResults(await client.discover.remove({ session: session.value, aspectName }), {
        NOT_FOUND: "There is no filter on that aspect.",
      });
    }

    async function clearFilters() {
      if (!session.value) return;
      applyResults(await client.discover.clear({ session: session.value }));
    }

    // ---------- my ratings ----------
    type Mine = Extract<Awaited<ReturnType<typeof client.ratings.mine>>, { mine: unknown }>["mine"];
    const mine = ref<Mine | null>(null);

    async function loadMine() {
      if (!session.value) return;
      const result = await client.ratings.mine({ session: session.value });
      if ("error" in result) handleError(result.error);
      else mine.value = result.mine;
    }

    // ---------- navigation ----------
    async function reloadPage() {
      const current = page.value;
      if (current.name === "catalog") await search();
      if (current.name === "discover") await loadDiscovery();
      if (current.name === "game") await loadGame(current.game);
      if (current.name === "mine") await loadMine();
    }

    function go(next: Page) {
      flash.text = "";
      page.value = next;
    }

    watch(page, reloadPage, { immediate: true });
    refreshMe();

    const signedIn = computed(() => session.value !== null && username.value !== null);

    return {
      session, username, signedIn, page, flash, go,
      auth, submitAuth, logout,
      query, games, newGame, search, addGame,
      detail, newAspect, drafts, expanded, myRatingOf, createAspect, rate, unrate,
      discovery, filterDraft, setFilter, removeFilter, clearFilters,
      mine,
    };
  },

  template: /* html */ `
    <header>
      <h1 @click="go({ name: 'catalog' })">Gamexplorer</h1>
      <nav>
        <button :class="{ active: page.name === 'catalog' }" @click="go({ name: 'catalog' })">Catalog</button>
        <button :class="{ active: page.name === 'discover' }" @click="go({ name: 'discover' })">Discover</button>
        <button v-if="signedIn" :class="{ active: page.name === 'mine' }" @click="go({ name: 'mine' })">My ratings</button>
      </nav>
      <div class="account">
        <template v-if="signedIn">
          <span>Signed in as <strong>{{ username }}</strong></span>
          <button @click="logout">Log out</button>
        </template>
        <form v-else @submit.prevent="submitAuth" class="inline">
          <input v-model="auth.username" placeholder="username" autocomplete="username" />
          <input v-model="auth.password" type="password" placeholder="password"
                 :autocomplete="auth.mode === 'register' ? 'new-password' : 'current-password'" />
          <button>{{ auth.mode === 'register' ? 'Register' : 'Log in' }}</button>
          <a href="#" @click.prevent="auth.mode = auth.mode === 'register' ? 'login' : 'register'">
            {{ auth.mode === 'register' ? 'Have an account? Log in' : 'New? Register' }}
          </a>
        </form>
      </div>
    </header>

    <p v-if="flash.text" :class="['flash', flash.kind]" role="status">{{ flash.text }}</p>

    <main>
      <!-- Catalog -->
      <section v-if="page.name === 'catalog'">
        <h2>Catalog</h2>
        <form @submit.prevent="search" class="inline">
          <input v-model="query" placeholder="Search titles" />
          <button>Search</button>
        </form>
        <p v-if="games.length === 0" class="muted">No games yet{{ query ? ' match that search' : '' }}.</p>
        <ul class="cards">
          <li v-for="g in games" :key="g.game" @click="go({ name: 'game', game: g.game })">
            <strong>{{ g.title }}</strong>
            <span class="muted">{{ g.developer }} · {{ g.releaseYear }}</span>
          </li>
        </ul>

        <h3>Add a game</h3>
        <p v-if="!signedIn" class="muted">Log in to add games.</p>
        <form v-else @submit.prevent="addGame" class="stack">
          <input v-model="newGame.title" placeholder="Title" required />
          <input v-model="newGame.developer" placeholder="Developer" required />
          <input v-model.number="newGame.releaseYear" type="number" min="1950" max="2100" placeholder="Year" required />
          <button>Add game</button>
        </form>
      </section>

      <!-- Game detail -->
      <section v-if="page.name === 'game' && detail">
        <a href="#" @click.prevent="go({ name: 'catalog' })">← Catalog</a>
        <h2>{{ detail.title }}</h2>
        <p class="muted">{{ detail.developer }} · {{ detail.releaseYear }}</p>

        <p v-if="detail.aspects.length === 0" class="muted">No aspects yet. Add one below to start rating.</p>
        <div v-for="a in detail.aspects" :key="a.aspect" class="aspect">
          <div class="aspect-head" @click="expanded[a.aspect] = !expanded[a.aspect]">
            <span class="aspect-name">{{ expanded[a.aspect] ? '▾' : '▸' }} {{ a.name }}</span>
            <span v-if="a.summary.count > 0" class="score">
              {{ a.summary.average.toFixed(1) }}/10
              <span class="muted">({{ a.summary.count }} {{ a.summary.count === 1 ? 'rating' : 'ratings' }})</span>
            </span>
            <span v-else class="muted">Unrated</span>
          </div>
          <div class="bar"><div :style="{ width: (a.summary.average * 10) + '%' }"></div></div>
          <div v-if="expanded[a.aspect]" class="aspect-body">
            <p v-if="a.description" class="muted">{{ a.description }}</p>
            <ul class="notes">
              <li v-for="r in a.ratings" :key="r.user">
                <strong>{{ r.score }}/10</strong> · {{ r.reviewer?.username ?? 'unknown' }}
                <span v-if="r.microNote">: “{{ r.microNote }}”</span>
              </li>
              <li v-if="a.ratings.length === 0" class="muted">No reviews yet.</li>
            </ul>
            <form v-if="signedIn && drafts[a.aspect]" @submit.prevent="rate(a.aspect)" class="inline">
              <label>Your score
                <input type="range" min="1" max="10" step="1" v-model.number="drafts[a.aspect].score" />
                <strong>{{ drafts[a.aspect].score }}</strong>
              </label>
              <input v-model="drafts[a.aspect].microNote" maxlength="280" placeholder="Tiny review (optional)" class="grow" />
              <button>{{ myRatingOf(a) ? 'Update' : 'Rate' }}</button>
              <button v-if="myRatingOf(a)" type="button" class="secondary" @click="unrate(a.aspect)">Remove</button>
            </form>
            <p v-else-if="!signedIn" class="muted">Log in to rate this aspect.</p>
          </div>
        </div>

        <h3>Add an aspect</h3>
        <p v-if="!signedIn" class="muted">Log in to add aspects.</p>
        <form v-else @submit.prevent="createAspect" class="inline">
          <input v-model="newAspect.name" placeholder="e.g. Narrative Depth" required />
          <input v-model="newAspect.description" placeholder="Description (optional)" class="grow" />
          <button>Add aspect</button>
        </form>
      </section>

      <!-- Discovery -->
      <section v-if="page.name === 'discover'">
        <h2>Discover</h2>
        <p class="muted">Pick the dimensions you care about and set a minimum average score. Leave everything else unconstrained.</p>
        <p v-if="!signedIn" class="muted">Log in to build your filters.</p>
        <template v-else-if="discovery">
          <form @submit.prevent="setFilter" class="inline">
            <select v-model="filterDraft.aspectName">
              <option value="" disabled>Choose an aspect…</option>
              <option v-for="n in discovery.aspectNames" :key="n.aspectName" :value="n.aspectName">{{ n.aspectName }}</option>
            </select>
            <label>at least
              <input type="range" min="1" max="10" step="0.5" v-model.number="filterDraft.minScore" />
              <strong>{{ filterDraft.minScore }}</strong>/10
            </label>
            <button>Add filter</button>
          </form>
          <p v-if="discovery.aspectNames.length === 0" class="muted">No aspects have been rated yet, so there is nothing to filter on.</p>

          <div v-if="discovery.filters.length" class="chips">
            <span v-for="f in discovery.filters" :key="f.aspectName" class="chip">
              {{ f.aspectName }} ≥ {{ f.minScore }}
              <button class="link" @click="removeFilter(f.aspectName)" :aria-label="'Remove ' + f.aspectName">×</button>
            </span>
            <button class="secondary" @click="clearFilters">Clear all</button>
          </div>

          <h3 v-if="discovery.filters.length">{{ discovery.matches.length }} matching {{ discovery.matches.length === 1 ? 'game' : 'games' }}</h3>
          <p v-if="discovery.filters.length && discovery.matches.length === 0" class="muted">No games meet every threshold.</p>
          <ul class="cards">
            <li v-for="m in discovery.matches" :key="m.game" @click="go({ name: 'game', game: m.game })">
              <strong>{{ m.info?.title }}</strong>
              <span class="muted">{{ m.info?.developer }} · {{ m.info?.releaseYear }}</span>
              <span v-for="s in m.scores" :key="s.aspectName" class="score">
                {{ s.aspectName }}: {{ s.score?.average.toFixed(1) }}/10
                <span class="muted">across {{ s.score?.count }} {{ s.score?.count === 1 ? 'reviewer' : 'reviewers' }}</span>
              </span>
            </li>
          </ul>
        </template>
      </section>

      <!-- My ratings -->
      <section v-if="page.name === 'mine' && mine">
        <h2>My ratings</h2>
        <p v-if="mine.ratings.length === 0" class="muted">You have not rated anything yet.</p>
        <ul class="cards">
          <li v-for="r in mine.ratings" :key="r.aspect" @click="go({ name: 'game', game: r.game })">
            <strong>{{ r.gameInfo?.title }}</strong>
            <span>{{ r.aspectInfo?.name }}: <strong>{{ r.score }}/10</strong></span>
            <span v-if="r.microNote" class="muted">“{{ r.microNote }}”</span>
          </li>
        </ul>
      </section>
    </main>
  `,
};

createApp(App).mount("#app");

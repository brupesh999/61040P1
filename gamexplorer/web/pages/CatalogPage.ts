import { defineComponent, onMounted, reactive, ref } from "vue/dist/vue.esm-bundler.js";
import { client } from "../api.ts";
import { GameCard, type GameInfo } from "../components.ts";
import { account, gameHref, notify, useRequest } from "../state.ts";

export default defineComponent({
  components: { GameCard },
  emits: ["sign-in"],
  setup() {
    const query = ref("");
    const searched = ref("");
    const loaded = ref(false);
    const games = ref<Array<GameInfo & { game: string }>>([]);
    const draft = reactive({ title: "", developer: "", releaseYear: new Date().getFullYear() });
    const listing = useRequest();
    const adding = useRequest();
    async function search() {
      const term = query.value.trim();
      const result = await listing.run(() => client.games.search({ query: term }));
      if (!result) return;
      if ("error" in result) return listing.fail(result.error);
      games.value = result.results.games;
      searched.value = term;
      loaded.value = true;
    }
    async function clearSearch() { query.value = ""; await search(); }
    async function addGame() {
      if (!account.user) return;
      const title = draft.title.trim();
      const developer = draft.developer.trim();
      const releaseYear = Number(draft.releaseYear);
      if (!title || !developer || !Number.isInteger(releaseYear) || releaseYear < 1950 || releaseYear > 2100) {
        adding.error.value = "Enter a title, developer, and whole release year from 1950 to 2100.";
        return;
      }
      const result = await adding.run(() => client.games.add({ title, developer, releaseYear }));
      if (!result) return;
      if ("error" in result) return adding.fail(result.error, {
        CONFLICT: "That game is already in the catalog. Search for its title to open it.",
        INVALID_REQUEST: "Enter a title, developer, and whole release year from 1950 to 2100.",
      });
      notify(`Added ${title}.`);
      window.location.hash = gameHref(result.game);
    }
    onMounted(search);
    return {
      account, query, searched, loaded, games, draft, search, clearSearch, addGame,
      loading: listing.busy, loadError: listing.error, saving: adding.busy, saveError: adding.error,
    };
  },
  template: `
    <section aria-labelledby="catalog-heading">
      <div class="section-top catalog-top">
        <h1 id="catalog-heading" class="page-title">Catalog<span v-if="loaded && !loading" class="count">{{ games.length }}</span></h1>
        <form class="search-form" @submit.prevent="search" role="search">
          <label class="sr-only" for="catalog-search">Search game titles</label>
          <span class="search-symbol" aria-hidden="true">⌕</span>
          <input id="catalog-search" v-model="query" type="search" placeholder="Search game titles…" :disabled="loading">
          <button class="secondary" :disabled="loading">{{ loading ? 'Searching…' : 'Search' }}</button>
        </form>
      </div>
      <p v-if="searched && loaded" class="search-context">Results for “{{ searched }}” <button class="text-button" @click="clearSearch" :disabled="loading">Clear search</button></p>
      <div v-if="loadError" class="feedback error" role="alert"><span>{{ loadError }}</span><button class="text-button" @click="search" :disabled="loading">Try again</button></div>
      <div v-if="loading && !loaded" class="loading-state" role="status">Loading games…</div>
      <div v-else-if="loaded && games.length === 0 && !loadError" class="empty-state">
        <span class="empty-glyph" aria-hidden="true">⌕</span>
        <h3>{{ searched ? 'No games found' : 'No games yet' }}</h3>
        <p v-if="searched">Try another title or clear the search.</p>
        <button v-if="searched" class="secondary" @click="clearSearch">Browse all games</button>
        <button v-else-if="!account.user" class="primary" @click="$emit('sign-in')">Sign in to add a game</button>
      </div>
      <div v-else class="game-grid" :aria-busy="loading">
        <GameCard v-for="(game, index) in games" :key="game.game" :game="game.game" :info="game" :index="index" />
      </div>

      <details v-if="account.user" class="contribution-panel">
        <summary><strong>Add a game</strong><span class="summary-action" aria-hidden="true">+</span></summary>
        <form class="form-grid" @submit.prevent="addGame">
          <div class="field"><label for="new-title">Game title</label><input id="new-title" v-model="draft.title" placeholder="e.g. Devil May Cry 5" required :disabled="saving"></div>
          <div class="field"><label for="new-developer">Developer</label><input id="new-developer" v-model="draft.developer" placeholder="e.g. Capcom" required :disabled="saving"></div>
          <div class="field"><label for="new-year">Release year</label><input id="new-year" v-model.number="draft.releaseYear" type="number" min="1950" max="2100" step="1" required :disabled="saving"></div>
          <p v-if="saveError" class="feedback error full-width" role="alert">{{ saveError }}</p>
          <div class="form-actions full-width"><span class="muted">Games are shared with everyone.</span><button class="primary" :disabled="saving">{{ saving ? 'Adding…' : 'Add game' }}</button></div>
        </form>
      </details>
      <div v-else class="contribution-prompt"><button class="text-button" @click="$emit('sign-in')">Sign in to add a game</button></div>
    </section>`,
});

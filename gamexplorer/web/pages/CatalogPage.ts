import { defineComponent, onMounted, ref } from "vue/dist/vue.esm-bundler.js";
import { client } from "../api.ts";
import { GameCard, type GameInfo } from "../components.ts";
import { account, gameHref, useRequest } from "../state.ts";

interface SteamChoice {
  steamAppId: number;
  title: string;
  developer: string;
  releaseYear: number;
  coverUrl: string;
  existing?: { game: string } | null;
}

export default defineComponent({
  components: { GameCard },
  emits: ["sign-in"],
  setup() {
    const query = ref("");
    const searched = ref("");
    const loaded = ref(false);
    const games = ref<Array<GameInfo & { game: string }>>([]);
    const steamQuery = ref("");
    const steamGames = ref<SteamChoice[]>([]);
    const steamSearched = ref(false);
    const steamCoverFailures = ref<Record<number, boolean>>({});
    const importing = ref<number | null>(null);
    const steamListing = useRequest();
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
    async function searchSteam() {
      if (!account.user) return;
      const query = steamQuery.value.trim();
      if (query.length < 2 || query.length > 100) {
        steamListing.error.value = "Enter 2–100 characters to search Steam.";
        return;
      }
      const result = await steamListing.run(() => client.games.steam.search({ query }));
      if (!result) return;
      if ("error" in result) return steamListing.fail(result.error, {
        INTERNAL_ERROR: "Steam search is unavailable. Try again shortly.",
      });
      steamGames.value = result.results.games;
      steamCoverFailures.value = {};
      steamSearched.value = true;
      adding.error.value = "";
    }
    async function addGame(choice: SteamChoice) {
      if (!account.user || adding.busy.value) return;
      importing.value = choice.steamAppId;
      const result = await adding.run(() => client.games.add({ steamAppId: choice.steamAppId }));
      importing.value = null;
      if (!result) return;
      if ("error" in result) return adding.fail(result.error, {
        CONFLICT: "That game is already in the catalog. Search for its title to open it.",
        INVALID_REQUEST: "Steam no longer has complete game information for this selection. Try another result.",
        INTERNAL_ERROR: "Steam is unavailable. Try again shortly.",
      });
      window.location.hash = gameHref(result.game);
    }
    function checkSteamCover(event: Event, steamAppId: number) {
      const image = event.target as HTMLImageElement;
      steamCoverFailures.value[steamAppId] = image.naturalWidth >= image.naturalHeight;
    }
    onMounted(search);
    return {
      account, query, searched, loaded, games, search, clearSearch, addGame, gameHref,
      steamQuery, steamGames, steamSearched, importing, searchSteam, steamCoverFailures, checkSteamCover,
      searchingSteam: steamListing.busy, steamError: steamListing.error,
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
        <form class="steam-search-form" @submit.prevent="searchSteam">
          <div class="field"><label for="steam-search">Search Steam</label><input id="steam-search" v-model="steamQuery" type="search" minlength="2" maxlength="100" placeholder="Game title" required :disabled="searchingSteam || saving"></div>
          <button class="secondary" :disabled="searchingSteam || saving">{{ searchingSteam ? 'Searching Steam…' : 'Search Steam' }}</button>
        </form>
        <p v-if="steamError" class="feedback error" role="alert">{{ steamError }}</p>
        <p v-if="saveError" class="feedback error" role="alert">{{ saveError }}</p>
        <p v-if="searchingSteam" class="muted" role="status">Checking Steam game listings…</p>
        <p v-else-if="steamSearched && !steamGames.length && !steamError" class="muted" role="status">No games with complete release information found. Try another title.</p>
        <ul v-if="steamGames.length" class="steam-results" :aria-busy="searchingSteam || saving">
          <li v-for="choice in steamGames" :key="choice.steamAppId" class="steam-result">
            <span class="steam-result-cover" aria-hidden="true"><img v-if="!steamCoverFailures[choice.steamAppId]" :src="choice.coverUrl" alt="" width="60" height="90" loading="lazy" referrerpolicy="no-referrer" @load="checkSteamCover($event, choice.steamAppId)" @error="steamCoverFailures[choice.steamAppId] = true"><span v-else>{{ choice.title.slice(0, 1) }}</span></span>
            <div class="steam-result-copy"><strong>{{ choice.title }}</strong><span class="muted">{{ choice.developer }} · {{ choice.releaseYear }}</span></div>
            <a v-if="choice.existing?.game" class="button secondary" :href="gameHref(choice.existing.game)" :aria-label="'Open ' + choice.title">Open game</a>
            <button v-else class="primary" @click="addGame(choice)" :aria-label="'Add ' + choice.title + ' to catalog'" :disabled="saving || searchingSteam">{{ importing === choice.steamAppId ? 'Adding…' : 'Add to catalog' }}</button>
          </li>
        </ul>
      </details>
      <div v-else class="contribution-prompt"><button class="text-button" @click="$emit('sign-in')">Sign in to add a game</button></div>
    </section>`,
});

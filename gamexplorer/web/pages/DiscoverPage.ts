import { computed, defineComponent, nextTick, onMounted, reactive, ref } from "vue/dist/vue.esm-bundler.js";
import { client } from "../api.ts";
import { GameCard } from "../components.ts";
import { account, useRequest } from "../state.ts";

type Results = Extract<Awaited<ReturnType<typeof client.discover.results>>, { results: unknown }>["results"];

export default defineComponent({
  components: { GameCard },
  emits: ["sign-in"],
  setup() {
    const results = ref<Results | null>(null);
    const draft = reactive({ aspectName: "", minScore: 8 });
    const reading = useRequest();
    const changing = useRequest();
    const editing = computed(() => results.value?.filters.some(filter => filter.aspectName.toLowerCase() === draft.aspectName.trim().toLowerCase()) ?? false);
    const missingOption = computed(() => draft.aspectName && !results.value?.aspectNames.some(name => name.aspectName === draft.aspectName));
    async function load() {
      if (!account.user) return;
      const result = await reading.run(() => client.discover.results({}));
      if (!result) return;
      if ("error" in result) return reading.fail(result.error);
      results.value = result.results;
    }
    function apply(result: { results: Results } | { error: string } | undefined): boolean {
      if (!result) return false;
      if ("error" in result) {
        changing.fail(result.error, { INVALID_REQUEST: "Choose an aspect and a minimum score from 1 to 10.", NOT_FOUND: "That filter is no longer saved. Refresh your results to check." });
        return false;
      }
      reading.error.value = "";
      results.value = result.results;
      return true;
    }
    async function setFilter() {
      if (!account.user) return;
      if (!draft.aspectName.trim() || !(draft.minScore >= 1 && draft.minScore <= 10)) {
        changing.error.value = "Choose an aspect and a minimum score from 1 to 10.";
        return;
      }
      const { aspectName, minScore } = draft;
      if (apply(await changing.run(() => client.discover.set({ aspectName, minScore })))) draft.aspectName = "";
    }
    async function removeFilter(aspectName: string) {
      if (!account.user) return;
      if (apply(await changing.run(() => client.discover.remove({ aspectName }))) && draft.aspectName === aspectName) draft.aspectName = "";
    }
    async function clearFilters() {
      if (!account.user) return;
      if (apply(await changing.run(() => client.discover.clear({})))) draft.aspectName = "";
    }
    async function editFilter(filter: { aspectName: string; minScore: number }) {
      draft.aspectName = filter.aspectName;
      draft.minScore = filter.minScore;
      await nextTick();
      document.getElementById('minimum-score')?.focus();
    }
    async function cancelEditing() {
      draft.aspectName = "";
      await nextTick();
      document.getElementById('filter-aspect')?.focus();
    }
    onMounted(load);
    return {
      account, results, draft, editing, missingOption, load, setFilter, removeFilter, clearFilters, editFilter, cancelEditing,
      loading: reading.busy, loadError: reading.error, saving: changing.busy, saveError: changing.error,
    };
  },
  template: `
    <section aria-labelledby="discover-heading">
      <div class="page-heading"><h1 id="discover-heading">Discover</h1></div>
      <div v-if="!account.user" class="sign-in-panel"><p>Sign in to use discovery filters.</p><div class="button-row"><button class="primary" @click="$emit('sign-in')">Sign in to discover</button><a class="button secondary" href="#/catalog">Browse the catalog</a></div></div>
      <template v-else>
        <div v-if="loadError" class="feedback error" role="alert"><span>{{ loadError }}</span><button class="text-button" @click="load" :disabled="loading">Try again</button></div>
        <div v-if="loading && !results" class="loading-state" role="status">Loading your discovery filters…</div>
        <div v-if="results" class="discovery-layout">
          <aside class="criteria-panel" aria-labelledby="criteria-heading">
            <div class="panel-heading"><h2 id="criteria-heading">Filters</h2></div>
            <form @submit.prevent="setFilter">
              <p v-if="editing" class="criteria-help" role="status">Editing {{ draft.aspectName }} <button type="button" class="text-button" @click="cancelEditing" :disabled="saving || loading">Cancel editing</button></p>
              <div class="field"><label for="filter-aspect">Aspect</label><select id="filter-aspect" v-model="draft.aspectName" :disabled="saving || loading || (!results.aspectNames.length && !results.filters.length)"><option value="" disabled>Choose an aspect</option><option v-for="aspect in results.aspectNames" :key="aspect.aspectName" :value="aspect.aspectName">{{ aspect.aspectName }}</option><option v-if="missingOption" :value="draft.aspectName">{{ draft.aspectName }}</option></select></div>
              <div class="range-heading"><label for="minimum-score">Minimum community average</label><output for="minimum-score">{{ draft.minScore }}<small>/10</small></output></div><input id="minimum-score" type="range" min="1" max="10" step="0.5" v-model.number="draft.minScore" :disabled="saving || loading"><div class="range-labels" aria-hidden="true"><span>1</span><span>10</span></div>
              <button class="primary full-button" :disabled="saving || loading || !draft.aspectName">{{ saving ? 'Updating…' : editing ? 'Update criterion' : 'Add criterion' }} <span aria-hidden="true">{{ editing ? '↻' : '+' }}</span></button>
            </form>
            <p v-if="saveError" class="feedback error" role="alert">{{ saveError }}</p>
            <p v-if="!results.aspectNames.length" class="muted small-copy">No rated aspects are available.</p>
            <div class="saved-criteria"><div class="criteria-title"><h3>Active criteria <span class="count">{{ results.filters.length }}</span></h3><button v-if="results.filters.length" class="text-button" @click="clearFilters" :disabled="saving || loading">Clear all</button></div><p v-if="!results.filters.length" class="muted small-copy">No filters selected.</p><ul v-else class="criteria-list"><li v-for="filter in results.filters" :key="filter.aspectName"><button class="criterion-edit" @click="editFilter(filter)" :disabled="saving || loading" :aria-label="'Edit ' + filter.aspectName + ' criterion'"><span>{{ filter.aspectName }}</span><strong>≥ {{ filter.minScore }}<small>/10</small></strong><span class="criterion-edit-label">Edit threshold</span></button><button class="criterion-remove" @click="removeFilter(filter.aspectName)" :disabled="saving || loading" :aria-label="'Remove ' + filter.aspectName + ' criterion'">×</button></li></ul></div>

          </aside>
          <div class="discovery-results" :aria-busy="saving || loading">
            <div class="results-heading"><h2>Results</h2><span v-if="results.filters.length" class="result-total" role="status">{{ results.matches.length }} {{ results.matches.length === 1 ? 'match' : 'matches' }}</span></div>
            <div v-if="!results.filters.length" class="empty-state discovery-empty"><p>Select an aspect and add a minimum score to see results.</p></div>
            <div v-else-if="!results.matches.length" class="empty-state discovery-empty"><span class="empty-glyph" aria-hidden="true">⌕</span><h3>No matching games</h3><p>Lower a minimum score or remove a filter. Games without ratings for a selected aspect will not match.</p><a class="button secondary" href="#/catalog">Browse games to rate</a></div>
            <div v-else class="game-grid discovery-grid"><GameCard v-for="(match, index) in results.matches" :key="match.game" :game="match.game" :info="match.info" :index="index"><div class="match-scores"><div v-for="score in match.scores" :key="score.aspectName" class="match-score"><span>{{ score.aspectName }}<small>{{ score.score?.count }} {{ score.score?.count === 1 ? 'rating' : 'ratings' }}</small></span><strong>{{ score.score?.average.toFixed(1) }}<small>/10</small></strong></div></div></GameCard></div>
          </div>
        </div>
      </template>
    </section>`,
});

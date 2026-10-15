import { defineComponent, onMounted, reactive, ref } from "vue/dist/vue.esm-bundler.js";
import { client } from "../api.ts";
import { account, notify, useRequest } from "../state.ts";

type GameDetail = Extract<Awaited<ReturnType<typeof client.games.detail>>, { page: unknown }>["page"];

export default defineComponent({
  props: { game: { type: String, required: true }, focusAspect: String },
  emits: ["sign-in"],
  setup(props) {
    const detail = ref<GameDetail | null>(null);
    const coverFailed = ref(false);
    function checkCover(event: Event) {
      const image = event.target as HTMLImageElement;
      coverFailed.value = image.naturalWidth >= image.naturalHeight;
    }
    const drafts = reactive<Record<string, { score: number; microNote: string }>>({});
    const expanded = reactive<Record<string, boolean>>({});
    const newAspect = reactive({ name: "", description: "" });
    const removing = ref<string | null>(null);
    const activeEditor = ref("");
    const loadingRequest = useRequest();
    const ratingRequest = useRequest();
    const aspectRequest = useRequest();
    function myRating(aspect: GameDetail["aspects"][number]) {
      return aspect.ratings.find(rating => rating.user === account.user?.user);
    }
    async function load() {
      const result = await loadingRequest.run(() => client.games.detail({ game: props.game }));
      if (!result) return;
      if ("error" in result) return loadingRequest.fail(result.error, { NOT_FOUND: "This game could not be found. Return to the catalog to choose another." });
      if (detail.value?.cover?.coverUrl !== result.page.cover?.coverUrl) coverFailed.value = false;
      detail.value = result.page;
      for (const [index, aspect] of result.page.aspects.entries()) {
        const mine = myRating(aspect);
        drafts[aspect.aspect] ??= { score: mine?.score ?? 7, microNote: mine?.microNote ?? "" };
        expanded[aspect.aspect] ??= props.focusAspect ? props.focusAspect === aspect.aspect : index === 0;
      }
    }
    async function rate(aspect: string) {
      if (!account.user || !drafts[aspect]) return;
      activeEditor.value = aspect;
      const draft = drafts[aspect];
      const score = Number(draft.score);
      if (!Number.isInteger(score) || score < 1 || score > 10 || draft.microNote.length > 280) {
        ratingRequest.error.value = "Choose a whole score from 1 to 10 and keep your tiny review within 280 characters.";
        return;
      }
      const result = await ratingRequest.run(() => client.ratings.rate({ aspect, score, microNote: draft.microNote }));
      if (!result) return;
      if ("error" in result) return ratingRequest.fail(result.error, {
        NOT_FOUND: "This aspect could not be found. Refresh the game details and try again.",
        INVALID_REQUEST: "Choose a whole score from 1 to 10 and keep your tiny review within 280 characters.",
      });
      removing.value = null;
      notify("Rating saved.");
      await load();
    }
    async function removeRating(aspect: string) {
      if (!account.user) return;
      activeEditor.value = aspect;
      const result = await ratingRequest.run(() => client.ratings.remove({ aspect }));
      if (!result) return;
      if ("error" in result) return ratingRequest.fail(result.error, { NOT_FOUND: "You no longer have a rating for this aspect. Refresh the game details to check." });
      delete drafts[aspect];
      removing.value = null;
      notify("Rating removed.");
      await load();
    }
    async function createAspect() {
      if (!account.user) return;
      if (!newAspect.name.trim()) { aspectRequest.error.value = "Give the aspect a name."; return; }
      const result = await aspectRequest.run(() => client.aspects.create({
        game: props.game, name: newAspect.name, description: newAspect.description,
      }));
      if (!result) return;
      if ("error" in result) return aspectRequest.fail(result.error, {
        CONFLICT: "An aspect with that name already exists for this game. Use its rating form above.",
        INVALID_REQUEST: "Give the aspect a name.",
      });
      expanded[result.aspect] = true;
      notify(`Added ${newAspect.name.trim()}.`);
      newAspect.name = "";
      newAspect.description = "";
      await load();
    }
    onMounted(load);
    return {
      account, detail, coverFailed, checkCover, drafts, expanded, newAspect, removing, activeEditor, myRating,
      load, rate, removeRating, createAspect,
      loading: loadingRequest.busy, loadError: loadingRequest.error,
      saving: ratingRequest.busy, saveError: ratingRequest.error,
      creating: aspectRequest.busy, aspectError: aspectRequest.error,
    };
  },
  template: `
    <section aria-labelledby="game-heading">
      <a class="back-link" href="#/catalog"><span aria-hidden="true">←</span> Back to catalog</a>
      <div v-if="loading && !detail" class="loading-state" role="status">Loading game details…</div>
      <div v-if="loadError" class="feedback error" role="alert"><span>{{ loadError }}</span><button class="text-button" @click="load" :disabled="loading">Try again</button></div>
      <template v-if="detail">
        <div class="detail-heading">
          <div class="detail-tile" :class="{ 'has-cover': detail.cover?.coverUrl && !coverFailed }" aria-hidden="true"><img v-if="detail.cover?.coverUrl && !coverFailed" :src="detail.cover.coverUrl" alt="" width="600" height="900" referrerpolicy="no-referrer" @load="checkCover" @error="coverFailed = true"><template v-else><span>{{ detail.title.slice(0, 1) }}</span><small>{{ detail.releaseYear }}</small></template></div>
          <div><h1 id="game-heading">{{ detail.title }}</h1><p class="metadata">{{ detail.developer }} <span aria-hidden="true">/</span> {{ detail.releaseYear }}<a v-if="detail.cover?.steamAppId" class="store-source" :href="'https://store.steampowered.com/app/' + detail.cover.steamAppId + '/'" target="_blank" rel="noopener noreferrer">Steam ↗</a></p></div>
        </div>
        <div v-if="detail.aspects.length === 0" class="empty-state"><span class="empty-glyph" aria-hidden="true">+</span><h3>No aspects yet</h3><button v-if="!account.user" class="primary" @click="$emit('sign-in')">Sign in to add an aspect</button></div>
        <div class="aspect-list" :aria-busy="loading">
          <article v-for="aspect in detail.aspects" :key="aspect.aspect" class="aspect" :class="{ 'is-expanded': expanded[aspect.aspect] }" :id="'aspect-' + aspect.aspect">
            <h3 class="aspect-heading"><button class="aspect-toggle" @click="expanded[aspect.aspect] = !expanded[aspect.aspect]" :aria-expanded="!!expanded[aspect.aspect]" :aria-controls="'aspect-body-' + aspect.aspect">
              <span class="aspect-label"><span class="expand-icon" aria-hidden="true">{{ expanded[aspect.aspect] ? '−' : '+' }}</span>{{ aspect.name }}<span v-if="myRating(aspect)" class="your-rating">You: {{ myRating(aspect).score }}/10</span></span>
              <span v-if="aspect.summary.count" class="community-summary"><span class="score-value">{{ aspect.summary.average.toFixed(1) }}<small>/10</small></span><span class="muted">{{ aspect.summary.count }} {{ aspect.summary.count === 1 ? 'rating' : 'ratings' }}</span></span>
              <span v-else class="unrated">Not rated yet</span>
            </button></h3>
            <div class="score-track" aria-hidden="true"><span :style="{ width: aspect.summary.average * 10 + '%' }"></span></div>
            <div v-if="expanded[aspect.aspect]" :id="'aspect-body-' + aspect.aspect" class="aspect-body">
              <p v-if="aspect.description" class="aspect-description">{{ aspect.description }}</p>
              <div class="aspect-columns">
                <section class="review-section" :aria-label="aspect.name + ' community reviews'">
                  <h4 class="section-label">Reviews:</h4>
                  <p v-if="!aspect.ratings.length" class="muted">No reviews yet.</p>
                  <ul v-else class="review-list"><li v-for="rating in aspect.ratings" :key="rating.user"><div class="review-meta"><strong>{{ rating.reviewer?.username ?? 'Reviewer' }}</strong><span>{{ rating.score }}<small>/10</small></span></div><p v-if="rating.microNote">{{ rating.microNote }}</p></li></ul>
                </section>
                <section class="rating-editor" :aria-label="'Your ' + aspect.name + ' rating'">
                  <template v-if="account.user && drafts[aspect.aspect]">
                    <h4 class="section-label">Write a Review</h4>
                    <form @submit.prevent="rate(aspect.aspect)">
                      <div class="range-heading"><label :for="'score-' + aspect.aspect">Your score</label><output :for="'score-' + aspect.aspect">{{ drafts[aspect.aspect].score }}<small>/10</small></output></div>
                      <input :id="'score-' + aspect.aspect" type="range" min="1" max="10" step="1" v-model.number="drafts[aspect.aspect].score" :disabled="saving || loading">
                      <div class="range-labels" aria-hidden="true"><span>1 · Not for me</span><span>10 · Exceptional</span></div>
                      <div class="field review-field"><label :for="'note-' + aspect.aspect">Review <span class="muted">(optional)</span></label><textarea :id="'note-' + aspect.aspect" v-model="drafts[aspect.aspect].microNote" maxlength="280" rows="3" placeholder="Optional review" :disabled="saving || loading" :aria-describedby="'note-count-' + aspect.aspect"></textarea><span :id="'note-count-' + aspect.aspect" class="character-count">{{ drafts[aspect.aspect].microNote.length }} / 280 characters</span></div>
                      <p v-if="saveError && activeEditor === aspect.aspect" class="feedback error" role="alert">{{ saveError }}</p>
                      <div class="editor-actions"><button class="primary" :disabled="saving || loading">{{ saving && activeEditor === aspect.aspect ? 'Saving…' : myRating(aspect) ? 'Update rating' : 'Save rating' }}</button><button v-if="myRating(aspect) && removing !== aspect.aspect" type="button" class="text-button muted" @click="removing = aspect.aspect" :disabled="saving || loading">Remove rating</button></div>
                    </form>
                    <div v-if="removing === aspect.aspect" class="remove-confirm" role="group" aria-label="Confirm rating removal"><p>Remove your score and tiny review? They will stop contributing to the community average.</p><div class="button-row"><button class="danger" @click="removeRating(aspect.aspect)" :disabled="saving || loading">{{ saving ? 'Removing…' : 'Yes, remove rating' }}</button><button class="secondary" @click="removing = null" :disabled="saving">Keep rating</button></div></div>
                  </template>
                  <template v-else><h4 class="section-label">Write a Review</h4><button class="primary" @click="$emit('sign-in')">Sign in to rate</button></template>
                </section>
              </div>
            </div>
          </article>
        </div>
        <details v-if="account.user" class="contribution-panel">
          <summary><strong>Add an aspect</strong><span class="summary-action" aria-hidden="true">+</span></summary>
          <form class="aspect-form" @submit.prevent="createAspect"><div class="field"><label for="aspect-name">Aspect name</label><input id="aspect-name" v-model="newAspect.name" placeholder="e.g. Combat Depth" required :disabled="creating"></div><div class="field"><label for="aspect-description">Description <span class="muted">(optional)</span></label><input id="aspect-description" v-model="newAspect.description" placeholder="What should reviewers consider?" :disabled="creating"></div><p v-if="aspectError" class="feedback error full-width" role="alert">{{ aspectError }}</p><div class="form-actions full-width"><span class="muted">Aspects are shared with everyone reviewing this game.</span><button class="primary" :disabled="creating">{{ creating ? 'Adding…' : 'Add aspect' }}</button></div></form>
        </details>
      </template>
    </section>`,
});

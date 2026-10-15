import { computed, defineComponent, onMounted, ref } from "vue/dist/vue.esm-bundler.js";
import { client } from "../api.ts";
import { account, gameHref, useRequest } from "../state.ts";

type Mine = Extract<Awaited<ReturnType<typeof client.ratings.mine>>, { mine: unknown }>["mine"];

export default defineComponent({
  emits: ["sign-in"],
  setup() {
    const mine = ref<Mine | null>(null);
    const request = useRequest();
    const gameCount = computed(() => new Set(mine.value?.ratings.map(rating => rating.game)).size);
    async function load() {
      if (!account.user) return;
      const result = await request.run(() => client.ratings.mine({}));
      if (!result) return;
      if ("error" in result) return request.fail(result.error);
      mine.value = result.mine;
    }
    onMounted(load);
    return { account, mine, gameCount, load, gameHref, loading: request.busy, error: request.error };
  },
  template: `
    <section aria-labelledby="mine-heading">
      <div class="page-heading"><h1 id="mine-heading">My Ratings</h1></div>
      <div v-if="!account.user" class="sign-in-panel"><p>Sign in to see your ratings.</p><button class="primary" @click="$emit('sign-in')">Sign in</button></div>
      <template v-else>
        <div v-if="error" class="feedback error" role="alert"><span>{{ error }}</span><button class="text-button" @click="load" :disabled="loading">Try again</button></div>
        <div v-if="loading && !mine" class="loading-state" role="status">Loading your ratings…</div>
        <template v-if="mine"><div class="section-top"><span class="muted">{{ mine.ratings.length }} {{ mine.ratings.length === 1 ? 'aspect' : 'aspects' }} · {{ gameCount }} {{ gameCount === 1 ? 'game' : 'games' }}</span></div><div v-if="!mine.ratings.length" class="empty-state"><span class="empty-glyph" aria-hidden="true">✎</span><h3>No ratings yet</h3><a class="button primary" href="#/catalog">Browse games <span aria-hidden="true">↗</span></a></div><ul v-else class="personal-ratings"><li v-for="rating in mine.ratings" :key="rating.aspect"><div class="personal-score">{{ rating.score }}<small>/10</small></div><div class="personal-rating-copy"><span class="eyebrow">{{ rating.aspectInfo?.name }}</span><h3><a :href="gameHref(rating.game, rating.aspect)">{{ rating.gameInfo?.title }}</a></h3><p v-if="rating.microNote">{{ rating.microNote }}</p></div><a class="button secondary" :href="gameHref(rating.game, rating.aspect)">Edit rating <span aria-hidden="true">↗</span></a></li></ul></template>
      </template>
    </section>`,
});

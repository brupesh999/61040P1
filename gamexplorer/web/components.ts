import { defineComponent, ref, watch, type PropType } from "vue/dist/vue.esm-bundler.js";
import { gameHref } from "./state.ts";

export interface GameInfo {
  title: string;
  developer: string;
  releaseYear: number;
  cover?: { steamAppId: number; coverUrl: string } | null;
}

/** All game links share the same metadata hierarchy and keyboard behavior. */
export const GameCard = defineComponent({
  props: {
    game: { type: String, required: true },
    info: { type: Object as PropType<GameInfo | null>, default: null },
    index: { type: Number, default: 0 },
  },
  setup(props) {
    const imageFailed = ref(false);
    watch(() => props.info?.cover?.coverUrl, () => { imageFailed.value = false; });
    function checkCover(event: Event) {
      const image = event.target as HTMLImageElement;
      imageFailed.value = image.naturalWidth >= image.naturalHeight;
    }
    return { gameHref, imageFailed, checkCover };
  },
  template: `
    <article class="game-card" :style="{ '--tile-shift': (index % 4) * 18 + 'deg' }">
      <a class="game-card-link" :href="gameHref(game)">
        <span class="game-tile" :class="{ 'has-cover': info?.cover?.coverUrl && !imageFailed }" aria-hidden="true">
          <img v-if="info?.cover?.coverUrl && !imageFailed" :src="info.cover.coverUrl" alt="" width="600" height="900" loading="lazy" decoding="async" referrerpolicy="no-referrer" @load="checkCover" @error="imageFailed = true">
          <template v-else>
          <span class="tile-grid"></span>
          <span class="tile-initial">{{ (info?.title ?? '?').slice(0, 1) }}</span>
          <span class="tile-year">{{ info?.releaseYear }}</span>
          <span class="tile-corner">↗</span>
          </template>
        </span>
        <span class="game-card-copy">
          <span class="game-title">{{ info?.title ?? 'Untitled game' }}</span>
          <span class="muted">{{ info?.developer }}<template v-if="info"> · {{ info.releaseYear }}</template></span>
        </span>
      </a>
      <slot></slot>
    </article>`,
});

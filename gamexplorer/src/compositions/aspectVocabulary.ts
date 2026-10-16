/** Gamexplorer's vocabulary policy. These are suggested labels, not game/review fixtures. */
import type { Db } from "mongodb";
import { DimensionDefiningConcept } from "../concepts/DimensionDefining.ts";

export const aspectPresets = [
  { name: "Combat", description: "Moves, enemies, responsiveness, and depth of combat." },
  { name: "Narrative Depth", description: "The story and the ideas it develops." },
  { name: "Pacing", description: "How the game balances progression, repetition, and downtime." },
  { name: "Characters", description: "Character development and relationships." },
  { name: "Dialogue", description: "Writing and delivery of conversations." },
  { name: "Voice Acting", description: "The quality and delivery of spoken performances." },
  { name: "Worldbuilding", description: "The setting, history, and details of the world." },
  { name: "Exploration", description: "Places to discover and reasons to explore." },
  { name: "Level Design", description: "The layout and variety of playable spaces." },
  { name: "Puzzle Design", description: "The quality and variety of puzzles." },
  { name: "Platforming", description: "Movement challenges and precision." },
  { name: "Stealth", description: "Avoiding detection and responding to enemies." },
  { name: "Strategy", description: "Planning, trade-offs, and meaningful decisions." },
  { name: "Progression", description: "How abilities, equipment, and challenges develop." },
  { name: "Customization", description: "Options for builds, equipment, and appearance." },
  { name: "Replayability", description: "Reasons to return after a playthrough." },
  { name: "Difficulty", description: "The quality and fairness of the challenge." },
  { name: "Accessibility", description: "Options that make the game usable by more players." },
  { name: "Controls", description: "Input responsiveness and control options." },
  { name: "Camera", description: "Visibility, movement, and control of the camera." },
  { name: "Performance", description: "Frame rate, loading, and technical responsiveness." },
  { name: "Stability", description: "Bugs, crashes, and reliability." },
  { name: "Graphics", description: "Visual detail and rendering quality." },
  { name: "Art Direction", description: "The game's visual style and composition." },
  { name: "Animation", description: "Movement, expression, and readability of animations." },
  { name: "Sound Design", description: "Sound effects and their use during play." },
  { name: "Music", description: "The soundtrack and its use in the game." },
  { name: "Atmosphere", description: "The mood created by the game's presentation and spaces." },
  { name: "Multiplayer", description: "Playing with or against other players." },
  { name: "Co-op", description: "Cooperation between players." },
  { name: "User Interface", description: "Menus, information, and ease of navigation." },
  { name: "Tutorials", description: "How the game teaches its rules and controls." },
  { name: "Value for Money", description: "Whether the experience justifies its price." },
] as const;

export const aspectNaming = {
  aliases: { ...Object.fromEntries(aspectPresets.map(preset => [preset.name, preset.name])), "Combat Depth": "Combat" },
};
export const dimensionNaming = { ...aspectNaming, presets: aspectPresets };

/** Read-only preflight. Conflicting legacy identities require a deliberate review, not data loss. */
export async function checkAspectNames(db: Db) {
  const conflicts = await new DimensionDefiningConcept(db, dimensionNaming)._nameConflicts({});
  if (conflicts.length) throw new Error(`Aspect aliases would combine existing dimensions on ${conflicts.length} game(s). Review the conflicting dimensions before deployment.`);
}

/** Pure string configuration; no concept state or external identity properties. */
export interface NameOptions {
  aliases?: Readonly<Record<string, string>>;
}
export interface NameSuggestion { name: string; description: string }
export const nameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
export function nameRules(options: NameOptions = {}) {
  const aliases = new Map(Object.entries(options.aliases ?? {}).map(([alias, canonical]) =>
    [nameKey(alias), canonical.trim()]));
  const label = (name: string) => aliases.get(nameKey(name)) ?? name.trim();
  const key = (name: string) => nameKey(label(name));
  const keys = (name: string) => [...new Set([key(name), ...[...aliases].filter(([, canonical]) => nameKey(canonical) === key(name)).map(([alias]) => alias)])];
  const alternatives = (name: string) => keys(name).filter(alias => alias !== key(name)).join(" ");
  return { label, key, keys, alternatives };
}

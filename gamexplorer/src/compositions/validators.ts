/**
 * Runtime input validators shared by the composition modules.
 *
 * Generated wire types only constrain typed callers. A raw request can carry anything, and a
 * Mongo filter built from an object such as `{ "$ne": null }` would match records it should
 * not, so every endpoint checks that each field has its expected primitive type.
 */
import type { EndpointValidator } from "@mit-sdg/sync-engine/boundary";

type FieldKind = "string" | "number";

export function shape(fields: Record<string, FieldKind>): EndpointValidator {
  const names = Object.keys(fields);
  const detail = `expected ${names.map((name) => `${name}: ${fields[name]}`).join(", ")}`;
  return (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { ok: false, detail };
    }
    const record = value as Record<string, unknown>;
    const ok = names.every((name) => typeof record[name] === fields[name] ||
      ((name === "session" || name === "attempt") && record[name] === null));
    return ok ? { ok: true } : { ok: false, detail };
  };
}

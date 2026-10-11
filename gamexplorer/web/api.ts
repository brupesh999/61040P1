import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import type { GamexplorerWireHttp } from "../generated/wire.ts";

export const client = createHttpClient<GamexplorerWireHttp>({ baseUrl: "/api" });

/**
 * The HTTP edge only exposes a category (CONFLICT, UNAUTHORIZED, ...), so each call site
 * passes the messages that make sense for what the user was doing.
 */
export function explain(error: string, messages: Partial<Record<string, string>> = {}): string {
  const defaults: Record<string, string> = {
    UNAUTHORIZED: "You need to log in first (your session may have ended).",
    INVALID_REQUEST: "Some of the fields are missing or invalid.",
    CONFLICT: "That already exists.",
    NOT_FOUND: "That could not be found.",
    NETWORK_ERROR: "Could not reach the server. Is the backend running?",
    INTERNAL_ERROR: "Something went wrong on the server.",
  };
  return messages[error] ?? defaults[error] ?? `Unexpected error: ${error}`;
}

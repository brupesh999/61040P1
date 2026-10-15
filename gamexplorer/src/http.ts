import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";
import { commonsHttp } from "./compositions/Commons.ts";

export function gamexplorerPolicy(publicOrigin: string) { return httpPolicy({
  publicOrigin,
  basePath: "/api",
  publicErrors: {
    ...commonsHttp.publicErrors,
    INVALID_USERNAME: "INVALID_REQUEST",
    UNKNOWN_USER: "NOT_FOUND",
    EMPTY_CREDENTIALS: "INVALID_REQUEST",
    USERNAME_TAKEN: "CONFLICT",
    INVALID_CREDENTIALS: "UNAUTHORIZED",
    UNKNOWN_SESSION: "UNAUTHORIZED",
    INVALID_GAME: "INVALID_REQUEST",
    INVALID_COVER: "INVALID_REQUEST",
    GAME_EXISTS: "CONFLICT",
    GAME_NOT_FOUND: "NOT_FOUND",
    EMPTY_ASPECT_NAME: "INVALID_REQUEST",
    ASPECT_EXISTS: "CONFLICT",
    ASPECT_NOT_FOUND: "NOT_FOUND",
    INVALID_SCORE: "INVALID_REQUEST",
    NOTE_TOO_LONG: "INVALID_REQUEST",
    RATING_NOT_FOUND: "NOT_FOUND",
    EMPTY_FILTER_ASPECT: "INVALID_REQUEST",
    INVALID_THRESHOLD: "INVALID_REQUEST",
    FILTER_NOT_FOUND: "NOT_FOUND",
  },
  cookies: {
    session: {
      name: "gamexplorer-session",
      input: "session",
      issue: ["/auth/register", "/auth/login", ...commonsHttp.startingSessions].map(path => ({ path, value: "session", expires: "expiresAt" })),
      clear: ["/auth/logout"],
    },
    signIn: commonsHttp.signInCookie("gamexplorer-sign-in"),
  },
}); }

export const policy = gamexplorerPolicy(process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:8080");

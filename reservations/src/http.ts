import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";

export const policy = httpPolicy({
  basePath: "/api",
  publicErrors: { ALREADY_RESERVED: "CONFLICT", NO_SUCH_RESERVATION: "NOT_FOUND" },
});

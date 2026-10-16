import type { Db } from "mongodb";

type HealthResult = { status: "ok" } | { status: "unavailable"; error: string; code?: number };

// Driver messages can contain hosts or credentials. Only log a class and numeric code.
function failure(error: unknown): HealthResult {
  const name = error instanceof Error ? error.name : "UnknownError";
  const safeName = /^(Mongo[A-Za-z]+Error|Error|TypeError|RangeError|TimeoutError)$/.test(name) ? name : "UnknownError";
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return {
    status: "unavailable", error: safeName,
    ...(typeof code === "number" && Number.isFinite(code) ? { code } : {}),
  };
}

export function createHealthHandler(db: Db, report: (line: string) => void = console.info) {
  let pending: Promise<HealthResult> | undefined;
  let previous: string | undefined;
  let receivedProbe = false;

  async function check(): Promise<HealthResult> {
    let result: HealthResult;
    try {
      await db.collection("gameCatalog.games").findOne({}, {
        maxTimeMS: 2000, timeoutMS: 3000, signal: AbortSignal.timeout(3000),
      });
      result = { status: "ok" };
    } catch (error) {
      result = failure(error);
    }
    const diagnostic = JSON.stringify(result);
    if (diagnostic !== previous) {
      report(`Database health: ${diagnostic}`);
      previous = diagnostic;
    }
    return result;
  }

  return async (request?: Request): Promise<Response> => {
    if (request && !receivedProbe) {
      report("First HTTP health probe received.");
      receivedProbe = true;
    }
    pending ??= check().finally(() => { pending = undefined; });
    const result = await pending;
    return Response.json(
      { status: result.status },
      { status: result.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  };
}

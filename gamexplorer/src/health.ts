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

export function createHealthMonitor(
  db: Db,
  report: (line: string) => void = console.info,
  now: () => number = () => performance.now(),
) {
  let pending: Promise<HealthResult> | undefined;
  let previous: string | undefined;
  let available = false;
  let lastSuccess: number | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let responses = 0;
  let previousHttpStatus: number | undefined;

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
    available = result.status === "ok";
    if (available) lastSuccess = now();
    const diagnostic = JSON.stringify(result);
    if (diagnostic !== previous) {
      report(`Database health: ${diagnostic}`);
      previous = diagnostic;
    }
    return result;
  }

  async function refresh(): Promise<boolean> {
    pending ??= check().finally(() => { pending = undefined; });
    return (await pending).status === "ok";
  }

  function respond(request: Request): Response {
    const age = lastSuccess === undefined ? undefined : Math.max(0, now() - lastSuccess);
    const healthy = available && age !== undefined && age < 5000;
    const status = healthy ? 200 : 503;
    if (responses++ < 3 || status !== previousHttpStatus) {
      const method = request.method === "GET" || request.method === "HEAD" ? request.method : "OTHER";
      report(`HTTP health response: ${method} ${status}; database age ${age === undefined ? "unknown" : Math.round(age) + " ms"}.`);
      previousHttpStatus = status;
    }
    const body = healthy ? '{"status":"ok"}' : '{"status":"unavailable"}';
    return new Response(body, {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": String(Buffer.byteLength(body)),
        "Cache-Control": "no-store",
        "Connection": "close",
      },
    });
  }

  return {
    refresh, respond,
    start() {
      timer ??= setInterval(() => { void refresh(); }, 2000);
      timer.unref();
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
    },
  };
}

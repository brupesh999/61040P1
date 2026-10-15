/** Bundle once in memory so every HTML response, including Commons' callback, has privacy headers. */
export async function frontendHandler() {
  const built = await Bun.build({
    entrypoints: [new URL("./index.html", import.meta.url).pathname],
    target: "browser",
    publicPath: "/",
    minify: process.env.NODE_ENV === "production",
  });
  if (!built.success) throw new Error("Frontend bundle failed.", { cause: built.logs });
  const files = new Map(built.outputs.map(file => ["/" + file.path.replace(/^\.\//, ""), file]));
  const homepage = files.get("/index.html");
  if (!homepage) throw new Error("Frontend bundle has no index.html.");
  return (request: Request) => {
    const path = new URL(request.url).pathname;
    const file = path === "/" || path === "/auth/commons/callback" ? homepage : files.get(path);
    const headers = { "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers });
    if (!file) return new Response("Not found", { status: 404, headers });
    return new Response(request.method === "HEAD" ? null : file, {
      headers: { ...headers, "Content-Type": file.type, "Cache-Control": file === homepage ? "no-store" : "public, max-age=31536000, immutable" },
    });
  };
}

import { httpWire } from "@mit-sdg/sync-engine-http/tooling";
import { assembleApplication } from "./src/assembly.ts";
import { policy } from "./src/http.ts";

export default {
  assemble: assembleApplication,
  title: "Gamexplorer",
  wireName: "GamexplorerWire",
  design: {
    version: 1,
    documents: [
      new URL("./design/types.md", import.meta.url),
      new URL("./design/compositions/Accounts.md", import.meta.url),
      new URL("./design/compositions/Commons.md", import.meta.url),
      new URL("./design/compositions/Catalog.md", import.meta.url),
      new URL("./design/compositions/Rating.md", import.meta.url),
      new URL("./design/compositions/Discovery.md", import.meta.url),
    ],
  },
  projections: [httpWire({ policy, name: "GamexplorerWireHttp" })],
};

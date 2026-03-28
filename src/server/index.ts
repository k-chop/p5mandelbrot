import { serve } from "@hono/node-server";
import { createEvalExportApp } from "./eval-export";

const app = createEvalExportApp();
serve({ fetch: app.fetch, port: 8080 });

console.log("Server started on port 8080");

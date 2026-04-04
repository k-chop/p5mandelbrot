import { serve } from "@hono/node-server";
import { createEvalExportApp } from "./eval-export";
import { registerPresetPOIRoutes } from "./preset-poi";

const app = createEvalExportApp();
registerPresetPOIRoutes(app);
serve({ fetch: app.fetch, port: 8080 });

console.log("Server started on port 8080");

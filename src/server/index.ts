import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { registerPresetPOIRoutes } from "./preset-poi";

const app = new Hono();
app.use("/api/*", cors());
registerPresetPOIRoutes(app);
serve({ fetch: app.fetch, port: 8080 });

console.log("Server started on port 8080");

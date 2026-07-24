import { createApp } from "./app/createApp.js";
import { readEnv } from "./config/env.js";
import { createRepository } from "./repository.js";

const env = readEnv();
const repo = createRepository();
const app = createApp(env, repo);

app.listen(env.port, "0.0.0.0", () => {
  console.log(`Typinglish API listening on http://0.0.0.0:${env.port}`);
  console.log(`Frontend is expected to run separately with CORS origins: ${env.corsOrigins.length > 0 ? env.corsOrigins.join(", ") : "*"}`);
  console.log(`Admin API available at /api/admin/v1${env.adminToken ? " (token protected)" : ""}`);
});

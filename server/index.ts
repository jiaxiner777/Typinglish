import { createApp } from "./app/createApp.js";
import { readEnv } from "./config/env.js";
import { createRepository } from "./repository.js";

const env = readEnv();
const repo = createRepository();
const app = createApp(env, repo);

app.listen(env.port, "0.0.0.0", () => {
  console.log(`Typinglish listening on port ${env.port}`);
  console.log(env.nodeEnv === "production" ? "Web app and API share this origin." : "Start the Vite frontend separately for development.");
  console.log(env.adminToken ? "Content administration requires the owner key." : "Content administration is disabled until ADMIN_TOKEN is configured.");
});

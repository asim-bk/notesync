import { createApp } from "./app";
import { config } from "./config";

async function start() {
  const app = createApp();

  try {
    await app.store.healthcheck();
    await app.listen({
      port: config.port,
      host: config.host
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();

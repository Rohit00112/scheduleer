import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerAppModule } from "./worker-app.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  const logger = new Logger("Worker");
  logger.log("Schedule import worker started");

  const shutdown = async () => {
    logger.log("Shutting down worker");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap();

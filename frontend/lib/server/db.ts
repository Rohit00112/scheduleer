import "reflect-metadata";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DataSource, type DataSourceOptions } from "typeorm";

import { entities } from "./entities";

type GlobalWithDataSource = typeof globalThis & {
  __schedulerDataSourcePromise?: Promise<DataSource>;
};

function shouldUseSsl(databaseUrl: string): boolean {
  return !/(localhost|127\.0\.0\.1)/i.test(databaseUrl) && !/sslmode=disable/i.test(databaseUrl);
}

function getSqlitePath(): string {
  const dataDir = path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "scheduler.db");
}

function getDataSourceOptions(): DataSourceOptions {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return {
      type: "postgres",
      url: databaseUrl,
      entities,
      synchronize: true,
      ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
      extra: {
        max: Number(process.env.DB_MAX_CONNECTIONS || 5),
      },
    };
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("DATABASE_URL is required in production.");
  }

  return {
    type: "sqlite",
    database: getSqlitePath(),
    entities,
    synchronize: true,
  };
}

export async function getDataSource(): Promise<DataSource> {
  const globalForDb = globalThis as GlobalWithDataSource;

  if (!globalForDb.__schedulerDataSourcePromise) {
    const dataSource = new DataSource(getDataSourceOptions());
    globalForDb.__schedulerDataSourcePromise = dataSource.initialize().catch((error) => {
      globalForDb.__schedulerDataSourcePromise = undefined;
      throw error;
    });
  }

  return globalForDb.__schedulerDataSourcePromise;
}

export async function destroyDataSource(): Promise<void> {
  const globalForDb = globalThis as GlobalWithDataSource;
  const promise = globalForDb.__schedulerDataSourcePromise;

  if (!promise) {
    return;
  }

  const dataSource = await promise;
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  globalForDb.__schedulerDataSourcePromise = undefined;
}

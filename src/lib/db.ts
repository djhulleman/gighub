import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client";
import { getEnv } from "./env";

const globalDb = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalDb.prisma ?? new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: getEnv().DATABASE_URL }) });
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;

export async function ensureLocalUser() {
  return db.user.upsert({
    where: { id: "local-user" },
    update: {},
    create: {
      id: "local-user",
      displayName: "Lokale gebruiker",
      notificationSettings: { create: { enabled: false, minimumScore: 70 } },
    },
  });
}

export const LOCAL_USER_ID = "local-user";

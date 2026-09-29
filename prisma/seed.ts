import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  await prisma.user.upsert({
    where: { id: "local-user" }, update: {},
    create: { id: "local-user", displayName: "Lokale gebruiker", notificationSettings: { create: { enabled: false, minimumScore: 70 } } },
  });
  await prisma.$disconnect();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

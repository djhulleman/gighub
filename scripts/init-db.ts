import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const configured = process.env.DATABASE_URL ?? "file:./dev.db";
const filename = configured.replace(/^file:/, "");
const db = new DatabaseSync(resolve(process.cwd(), filename));
const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260929190000_init/migration.sql"), "utf8");
db.exec(migration);
const user = db.prepare('SELECT id FROM "User" WHERE id = ?').get("local-user");
if (!user) db.prepare('INSERT INTO "User" (id, displayName, createdAt, updatedAt) VALUES (?, ?, ?, ?)').run("local-user", "Lokale gebruiker", new Date().toISOString(), new Date().toISOString());
const settings = db.prepare('SELECT id FROM "NotificationSettings" WHERE userId = ?').get("local-user");
if (!settings) db.prepare('INSERT INTO "NotificationSettings" (id, userId, enabled, minimumScore) VALUES (?, ?, 0, 70)').run(randomUUID(), "local-user");
db.close();
console.log(`Database gereed: ${resolve(process.cwd(), filename)}`);

"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, LOCAL_USER_ID, ensureLocalUser } from "@/lib/db";
import { normalizeText } from "@/lib/normalize";
import { disconnectSpotify } from "@/services/spotify";

const nameSchema = z.string().trim().min(1).max(100);
const weightSchema = z.enum(["FAVORITE", "INTERESTING", "NEUTRAL"]);
function refresh() { revalidatePath("/"); revalidatePath("/instellingen"); revalidatePath("/opgeslagen"); }

export async function addPreference(form: FormData) {
  await ensureLocalUser(); const kind = String(form.get("kind")); const name = nameSchema.parse(form.get("name")); const normalizedName = normalizeText(name);
  if (kind === "genre") await db.genrePreference.upsert({ where: { userId_normalizedName: { userId: LOCAL_USER_ID, normalizedName } }, update: { name }, create: { userId: LOCAL_USER_ID, name, normalizedName } });
  else if (kind === "excludedGenre") await db.excludedGenre.upsert({ where: { userId_normalizedName: { userId: LOCAL_USER_ID, normalizedName } }, update: { name }, create: { userId: LOCAL_USER_ID, name, normalizedName } });
  else if (kind === "excludedArtist") await db.excludedArtist.upsert({ where: { userId_normalizedName: { userId: LOCAL_USER_ID, normalizedName } }, update: { name }, create: { userId: LOCAL_USER_ID, name, normalizedName } });
  else await db.artistPreference.upsert({ where: { userId_normalizedName: { userId: LOCAL_USER_ID, normalizedName } }, update: { name, weight: weightSchema.parse(form.get("weight") ?? "INTERESTING") }, create: { userId: LOCAL_USER_ID, name, normalizedName, weight: weightSchema.parse(form.get("weight") ?? "INTERESTING"), spotifyId: String(form.get("spotifyId") || "") || null, spotifyUrl: String(form.get("spotifyUrl") || "") || null, imageUrl: String(form.get("imageUrl") || "") || null } });
  refresh();
}
export async function removePreference(form: FormData) {
  const kind = String(form.get("kind")); const id = z.string().min(1).parse(form.get("id"));
  if (kind === "genre") await db.genrePreference.deleteMany({ where: { id, userId: LOCAL_USER_ID } });
  else if (kind === "excludedGenre") await db.excludedGenre.deleteMany({ where: { id, userId: LOCAL_USER_ID } });
  else if (kind === "excludedArtist") await db.excludedArtist.deleteMany({ where: { id, userId: LOCAL_USER_ID } });
  else await db.artistPreference.deleteMany({ where: { id, userId: LOCAL_USER_ID } }); refresh();
}
export async function togglePeriod(form: FormData) { const period = z.enum(["short_term", "medium_term", "long_term"]).parse(form.get("period")); const enabled = form.get("enabled") === "true"; await db.spotifyTopArtistPeriod.updateMany({ where: { userId: LOCAL_USER_ID, period }, data: { enabled } }); refresh(); }
export async function saveEvent(form: FormData) { const eventId = z.string().min(1).parse(form.get("eventId")); await ensureLocalUser(); await db.savedEvent.upsert({ where: { userId_eventId: { userId: LOCAL_USER_ID, eventId } }, update: {}, create: { userId: LOCAL_USER_ID, eventId } }); refresh(); }
export async function unsaveEvent(form: FormData) { const eventId = z.string().min(1).parse(form.get("eventId")); await db.savedEvent.deleteMany({ where: { userId: LOCAL_USER_ID, eventId } }); refresh(); }
export async function dismissEvent(form: FormData) { const eventId = z.string().min(1).parse(form.get("eventId")); await ensureLocalUser(); await db.dismissedEvent.upsert({ where: { userId_eventId: { userId: LOCAL_USER_ID, eventId } }, update: {}, create: { userId: LOCAL_USER_ID, eventId } }); refresh(); }
export async function updateNotifications(form: FormData) { await ensureLocalUser(); const enabled = form.get("enabled") === "true"; const minimumScore = z.coerce.number().int().min(0).max(100).parse(form.get("minimumScore")); await db.notificationSettings.upsert({ where: { userId: LOCAL_USER_ID }, update: { enabled, minimumScore }, create: { userId: LOCAL_USER_ID, enabled, minimumScore } }); refresh(); }
export async function disconnectSpotifyAction() { await disconnectSpotify(); refresh(); }

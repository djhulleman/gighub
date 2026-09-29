import { z } from "zod";
import { db, LOCAL_USER_ID, ensureLocalUser } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { getEnv } from "@/lib/env";

const tokenSchema = z.object({ access_token: z.string(), token_type: z.string(), expires_in: z.number(), refresh_token: z.string().optional(), scope: z.string().default("") });
const artistSchema = z.object({ id: z.string(), name: z.string(), external_urls: z.object({ spotify: z.string().url() }), images: z.array(z.object({ url: z.string().url(), width: z.number().optional() })).default([]), genres: z.array(z.string()).optional().default([]), popularity: z.number().optional(), followers: z.object({ total: z.number() }).optional() });
const artistPageSchema = z.object({ items: z.array(artistSchema) });
const searchSchema = z.object({ artists: artistPageSchema });

export class SpotifyError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryAfter?: number) { super(message); }
}

export function isSpotifySessionExpired(expiresAt: Date, now = Date.now()) { return expiresAt.getTime() <= now + 60_000; }

function basicAuth() {
  const env = getEnv();
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) throw new SpotifyError("Spotify is niet geconfigureerd");
  return Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
}

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", body: params, headers: { Authorization: `Basic ${basicAuth()}`, "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new SpotifyError(response.status === 400 ? "Spotify-sessie is verlopen of ingetrokken" : `Spotify-tokenfout (${response.status})`, response.status);
  const parsed = tokenSchema.safeParse(await response.json());
  if (!parsed.success) throw new SpotifyError("Spotify stuurde ongeldige tokengegevens");
  return parsed.data;
}

export async function exchangeSpotifyCode(code: string) {
  const env = getEnv();
  if (!env.APP_ENCRYPTION_KEY) throw new SpotifyError("APP_ENCRYPTION_KEY ontbreekt");
  const token = await tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: env.SPOTIFY_REDIRECT_URI }));
  if (!token.refresh_token) throw new SpotifyError("Spotify gaf geen refresh-token terug");
  await ensureLocalUser();
  await db.spotifyConnection.upsert({
    where: { userId: LOCAL_USER_ID },
    create: { userId: LOCAL_USER_ID, accessTokenEncrypted: encryptToken(token.access_token, env.APP_ENCRYPTION_KEY), refreshTokenEncrypted: encryptToken(token.refresh_token, env.APP_ENCRYPTION_KEY), expiresAt: new Date(Date.now() + token.expires_in * 1000), scope: token.scope },
    update: { accessTokenEncrypted: encryptToken(token.access_token, env.APP_ENCRYPTION_KEY), refreshTokenEncrypted: encryptToken(token.refresh_token, env.APP_ENCRYPTION_KEY), expiresAt: new Date(Date.now() + token.expires_in * 1000), scope: token.scope, invalidatedAt: null },
  });
}

export async function getSpotifyAccessToken() {
  const env = getEnv();
  if (!env.APP_ENCRYPTION_KEY) throw new SpotifyError("APP_ENCRYPTION_KEY ontbreekt");
  const connection = await db.spotifyConnection.findUnique({ where: { userId: LOCAL_USER_ID } });
  if (!connection || connection.invalidatedAt) throw new SpotifyError("Spotify is niet verbonden", 401);
  if (!isSpotifySessionExpired(connection.expiresAt)) return decryptToken(connection.accessTokenEncrypted, env.APP_ENCRYPTION_KEY);
  try {
    const token = await tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptToken(connection.refreshTokenEncrypted, env.APP_ENCRYPTION_KEY) }));
    await db.spotifyConnection.update({ where: { userId: LOCAL_USER_ID }, data: { accessTokenEncrypted: encryptToken(token.access_token, env.APP_ENCRYPTION_KEY), ...(token.refresh_token ? { refreshTokenEncrypted: encryptToken(token.refresh_token, env.APP_ENCRYPTION_KEY) } : {}), expiresAt: new Date(Date.now() + token.expires_in * 1000), scope: token.scope } });
    return token.access_token;
  } catch (error) {
    await db.spotifyConnection.update({ where: { userId: LOCAL_USER_ID }, data: { invalidatedAt: new Date() } });
    throw error;
  }
}

async function spotifyFetch(path: string) {
  const token = await getSpotifyAccessToken();
  let response: Response;
  try { response = await fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12_000) }); }
  catch { throw new SpotifyError("Spotify is niet bereikbaar (netwerkfout of time-out)"); }
  if (response.status === 401) { await db.spotifyConnection.updateMany({ where: { userId: LOCAL_USER_ID }, data: { invalidatedAt: new Date() } }); throw new SpotifyError("Spotify-sessie is verlopen; verbind opnieuw", 401); }
  if (response.status === 403) throw new SpotifyError("Spotify weigert toegang. Controleer Development Mode, Premium en de gebruikers-allowlist.", 403);
  if (response.status === 429) throw new SpotifyError("Spotify-limiet bereikt; probeer later opnieuw", 429, Number(response.headers.get("retry-after") ?? 0));
  if (!response.ok) throw new SpotifyError(`Spotify gaf status ${response.status}`, response.status);
  return response.json();
}

export async function syncSpotifyTopArtists() {
  await ensureLocalUser();
  const run = await db.syncRun.create({ data: { userId: LOCAL_USER_ID, kind: "SPOTIFY", provider: "spotify" } });
  let found = 0;
  try {
    for (const period of ["short_term", "medium_term", "long_term"] as const) {
      const parsed = artistPageSchema.safeParse(await spotifyFetch(`/me/top/artists?time_range=${period}&limit=50`));
      if (!parsed.success) throw new SpotifyError("Spotify stuurde ongeldige artiestgegevens");
      found += parsed.data.items.length;
      for (const [index, artist] of parsed.data.items.entries()) {
        const saved = await db.spotifyArtist.upsert({ where: { spotifyId: artist.id }, create: { spotifyId: artist.id, name: artist.name, spotifyUrl: artist.external_urls.spotify, imageUrl: artist.images[0]?.url, genresJson: JSON.stringify(artist.genres), metadataJson: JSON.stringify({ popularity: artist.popularity, followers: artist.followers?.total }), syncedAt: new Date() }, update: { name: artist.name, spotifyUrl: artist.external_urls.spotify, imageUrl: artist.images[0]?.url, genresJson: JSON.stringify(artist.genres), metadataJson: JSON.stringify({ popularity: artist.popularity, followers: artist.followers?.total }), syncedAt: new Date() } });
        await db.spotifyTopArtistPeriod.upsert({ where: { userId_artistId_period: { userId: LOCAL_USER_ID, artistId: saved.id, period } }, create: { userId: LOCAL_USER_ID, artistId: saved.id, period, rank: index + 1, syncedAt: new Date() }, update: { rank: index + 1, syncedAt: new Date() } });
      }
    }
    await db.spotifyConnection.update({ where: { userId: LOCAL_USER_ID }, data: { lastSyncedAt: new Date() } });
    await db.syncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", completedAt: new Date(), found, updated: found } });
    return { found };
  } catch (error) {
    await db.syncRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), found, failed: 1, errorMessage: error instanceof Error ? error.message : "Onbekende Spotify-fout" } });
    throw error;
  }
}

export async function searchSpotifyArtists(query: string) {
  if (query.trim().length < 2) return [];
  const parsed = searchSchema.safeParse(await spotifyFetch(`/search?type=artist&limit=10&q=${encodeURIComponent(query.trim())}`));
  if (!parsed.success) throw new SpotifyError("Spotify stuurde ongeldige zoekresultaten");
  return parsed.data.artists.items.map((a) => ({ id: a.id, name: a.name, url: a.external_urls.spotify, imageUrl: a.images[0]?.url }));
}

export async function disconnectSpotify() {
  await db.$transaction([db.spotifyTopArtistPeriod.deleteMany({ where: { userId: LOCAL_USER_ID } }), db.spotifyConnection.deleteMany({ where: { userId: LOCAL_USER_ID } })]);
}

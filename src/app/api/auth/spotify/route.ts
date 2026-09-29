import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export async function GET() {
  const env = getEnv();
  const canonicalOrigin = new URL(env.SPOTIFY_REDIRECT_URI).origin;
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.APP_ENCRYPTION_KEY) return NextResponse.redirect(new URL("/configuratie?error=spotify-config", canonicalOrigin));
  const state = randomBytes(24).toString("base64url");
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({ client_id: env.SPOTIFY_CLIENT_ID, response_type: "code", redirect_uri: env.SPOTIFY_REDIRECT_URI, scope: "user-top-read", state }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set("spotify_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 600 });
  return response;
}

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeSpotifyCode } from "@/services/spotify";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const storedState = (await cookies()).get("spotify_oauth_state")?.value;
  if (!storedState || query.get("state") !== storedState) return NextResponse.redirect(new URL("/instellingen?spotify=state_mismatch", request.url));
  if (query.get("error")) return NextResponse.redirect(new URL(`/instellingen?spotify=${encodeURIComponent(query.get("error")!)}`, request.url));
  const code = query.get("code");
  if (!code) return NextResponse.redirect(new URL("/instellingen?spotify=missing_code", request.url));
  try { await exchangeSpotifyCode(code); return NextResponse.redirect(new URL("/instellingen?spotify=connected", request.url)); }
  catch (error) { return NextResponse.redirect(new URL(`/instellingen?spotify=${encodeURIComponent(error instanceof Error ? error.message : "error")}`, request.url)); }
}

import { NextRequest, NextResponse } from "next/server";
import { syncSpotifyTopArtists } from "@/services/spotify";
export async function POST(request:NextRequest){try{await syncSpotifyTopArtists();return NextResponse.redirect(new URL("/instellingen?spotify=synced",request.url),303)}catch(error){return NextResponse.redirect(new URL(`/instellingen?spotify=${encodeURIComponent(error instanceof Error?error.message:"sync_error")}`,request.url),303)}}

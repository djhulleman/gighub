import { NextRequest,NextResponse } from "next/server";
import { searchSpotifyArtists } from "@/services/spotify";
export async function GET(request:NextRequest){try{return NextResponse.json({artists:await searchSpotifyArtists(request.nextUrl.searchParams.get("q")??"")})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Zoeken mislukt"},{status:500})}}

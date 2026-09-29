import { describe,expect,it } from "vitest";
import { configurationStatus } from "@/lib/env";
import { isSpotifySessionExpired } from "@/services/spotify";
describe("veilige configuratie",()=>{it("rapporteert ontbrekende keys zonder crash",()=>{const result=configurationStatus({} as NodeJS.ProcessEnv);expect(result.ticketmasterMissing).toContain("TICKETMASTER_API_KEY");expect(result.spotifyMissing).toContain("APP_ENCRYPTION_KEY")});it("herkent verlopen Spotify-sessies met veiligheidsmarge",()=>{const now=Date.now();expect(isSpotifySessionExpired(new Date(now-1),now)).toBe(true);expect(isSpotifySessionExpired(new Date(now+30_000),now)).toBe(true);expect(isSpotifySessionExpired(new Date(now+120_000),now)).toBe(false)})});

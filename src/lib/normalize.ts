const NOISE = /\b(live|tickets?|tour|world tour|eu tour|amsterdam|sold out|premium seats?|sky lounge|venue premium packages?|premium packages?|presenteert|presents)\b/gi;

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(NOISE, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export const venueCatalog = [
  { name: "Ziggo Dome", aliases: ["ziggo dome"] },
  { name: "AFAS Live", aliases: ["afas live", "heineken music hall", "hmh"] },
  { name: "Paradiso", aliases: ["paradiso amsterdam", "paradiso grote zaal"] },
  { name: "Paradiso Noord / Tolhuistuin", aliases: ["paradiso noord", "tolhuistuin", "bitterzoet tolhuistuin"] },
  { name: "Melkweg", aliases: ["melkweg amsterdam", "melkweg max", "melkweg oude zaal"] },
  { name: "Bimhuis", aliases: ["bimhuis amsterdam"] },
  { name: "Muziekgebouw aan 't IJ", aliases: ["muziekgebouw aan het ij", "muziekgebouw aan 't ij", "muziekgebouw"] },
  { name: "Garage Noord", aliases: ["garage noord"] },
  { name: "Lofi", aliases: ["lofi amsterdam"] },
  { name: "RADION", aliases: ["radion amsterdam"] },
  { name: "Shelter", aliases: ["shelter amsterdam"] },
  { name: "De School", aliases: ["de school amsterdam"] },
  { name: "Westergas", aliases: ["westergasfabriek", "gashouder", "westergasterrein"] },
  { name: "NDSM-werf", aliases: ["ndsm", "ndsm werf"] },
  { name: "Johan Cruijff ArenA", aliases: ["johan cruijff arena", "amsterdam arena"] },
] as const;

export function canonicalVenueName(value: string): string {
  const n = normalizeText(value);
  const found = venueCatalog.find((venue) => venue.aliases.some((a) => normalizeText(a) === n) || normalizeText(venue.name) === n);
  return found?.name ?? value.trim();
}

export function canonicalVenueKey(value: string): string { return normalizeText(canonicalVenueName(value)); }

export function encodeGeohash(latitude: number, longitude: number, precision = 7): string {
  const alphabet = "0123456789bcdefghjkmnpqrstuvwxyz";
  const lat: [number, number] = [-90, 90]; const lon: [number, number] = [-180, 180];
  let even = true; let bit = 0; let value = 0; let result = "";
  while (result.length < precision) {
    const range = even ? lon : lat; const coordinate = even ? longitude : latitude; const midpoint = (range[0] + range[1]) / 2;
    if (coordinate >= midpoint) { value = value * 2 + 1; range[0] = midpoint; } else { value *= 2; range[1] = midpoint; }
    even = !even; bit++;
    if (bit === 5) { result += alphabet[value]; bit = 0; value = 0; }
  }
  return result;
}

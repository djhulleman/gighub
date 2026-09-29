const NOISE = /\b(live|tickets?|tour|world tour|eu tour|amsterdam)\b/gi;

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

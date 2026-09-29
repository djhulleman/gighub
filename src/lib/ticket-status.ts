import type { TicketStatusValue } from "./types";

export function normalizeTicketStatus(status?: string | null): TicketStatusValue {
  if (!status) return "NOT_CHECKED";
  const value = status.toLowerCase();
  if (["onsale", "on_sale"].includes(value)) return "AVAILABLE";
  if (["soldout", "sold_out"].includes(value)) return "SOLD_OUT";
  return "UNKNOWN";
}

export function ticketStatusLabel(status: TicketStatusValue): string {
  return status === "AVAILABLE" ? "Beschikbaar" : status === "SOLD_OUT" ? "Uitverkocht" : "Controleer bij aanbieder";
}

import { z } from "zod";

const optionalSecret = z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined));

const schema = z.object({
  DATABASE_URL: z.string().default("file:./dev.db"),
  SPOTIFY_CLIENT_ID: optionalSecret,
  SPOTIFY_CLIENT_SECRET: optionalSecret,
  SPOTIFY_REDIRECT_URI: z.string().url().default("http://127.0.0.1:3000/api/auth/spotify/callback"),
  TICKETMASTER_API_KEY: optionalSecret,
  APP_ENCRYPTION_KEY: optionalSecret,
  EVENT_SEARCH_RADIUS_KM: z.coerce.number().min(1).max(100).default(35),
});

export type AppEnv = z.infer<typeof schema>;

export function getEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Ongeldige omgevingsconfiguratie: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}

export function configurationStatus(source: NodeJS.ProcessEnv = process.env) {
  const env = getEnv(source);
  const spotifyMissing = ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "APP_ENCRYPTION_KEY"].filter(
    (key) => !env[key as keyof AppEnv],
  );
  const ticketmasterMissing = env.TICKETMASTER_API_KEY ? [] : ["TICKETMASTER_API_KEY"];
  return { env, spotifyMissing, ticketmasterMissing, databaseReady: Boolean(env.DATABASE_URL) };
}

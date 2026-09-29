# Amsterdam Gig Scout

Amsterdam Gig Scout is een lokale, persoonlijke radar voor concerten, clubnachten en muziekfestivals in Amsterdam en de directe omgeving. De applicatie combineert Spotify-topartiesten, handmatige artiest- en genrevoorkeuren, uitsluitingen en officiële Ticketmaster-data tot een deterministische score van 0–100. Iedere score blijft controleerbaar: de detailpagina toont de componenten en Nederlandse matchredenen.

De app is bewust single-user. Alle persoonlijke tabellen bevatten wel een `userId`, zodat echte accounts later kunnen worden toegevoegd. Er worden buiten tests geen fictieve evenementen geladen.

## Techniek en architectuur

- Next.js 16 App Router, React 19 en strict TypeScript;
- SQLite met Prisma ORM 7 en de officiële better-sqlite3-driveradapter;
- Zod-validatie voor configuratie en externe responses;
- brononafhankelijke `EventProvider`, met een volledige `TicketmasterProvider`;
- lokale services voor normalisatie, conservatieve deduplicatie, scoring en ICS;
- Vitest en React Testing Library;
- servercomponenten en server actions, met kleine clientcomponenten voor synchronisatie, Spotify Search en browsermeldingen.

`EventProvider`, `CalendarProvider` en `NotificationProvider` vormen uitbreidingspunten. Een tweede eventprovider, externe kalender-OAuth en e-mail zijn bewust niet actief: die horen pas requests te doen nadat een officiële API, sleutel en toepasselijke voorwaarden zijn vastgesteld.

## Vereisten en installatie op Windows

Gebruik bij voorkeur Node.js 22 LTS (`>=22.12`) of Node.js 24 LTS. Prisma 7 ondersteunt officieel Node `^20.19`, `^22.12` en `^24`; deze app richt zich op de twee recente LTS-lijnen. PowerShell kan lokale scripts blokkeren; gebruik dan `npm.cmd` in plaats van `npm`.

```powershell
git clone <repository>
cd gighub
Copy-Item .env.example .env.local
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://127.0.0.1:3000`. `npm install` genereert de Prisma Client en initialiseert de lege database idempotent; `db:migrate` kan veilig nogmaals worden uitgevoerd. De initiële SQL-migratie staat in `prisma/migrations/20260929190000_init/migration.sql`. De lokale gebruiker heeft de vaste sleutel `local-user`; seeden voegt nooit evenementen toe.

Waarom een expliciete migratierunner? Prisma’s schema-engine ondersteunt alleen de genoemde LTS-versies. De meegeleverde runner gebruikt dezelfde gecontroleerde SQL-migratie en maakt installatie ook robuust wanneer een Windows-machine per ongeluk een niet-ondersteunde Node Current-versie gebruikt. Alle applicatiequeries lopen gewoon via Prisma Client.

## Omgevingsvariabelen

Secrets staan alleen in `.env.local`; dit bestand staat in `.gitignore`. `.env.example` bevat:

```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/spotify/callback
TICKETMASTER_API_KEY=
APP_ENCRYPTION_KEY=
DATABASE_URL=file:./dev.db
EVENT_SEARCH_RADIUS_KM=35
```

Gebruik een lange willekeurige `APP_ENCRYPTION_KEY` (minimaal 32 tekens aanbevolen). OAuth access- en refresh-tokens worden daarmee server-side met AES-256-GCM versleuteld; de sleutel zelf komt nooit in SQLite. Configuratie wordt server-side met Zod gevalideerd.

Ontbrekende providersleutels laten de app niet crashen. `/configuratie` noemt exact wat ontbreekt en toont installatie-instructies. Zonder Ticketmaster-sleutel blijft de evenementlijst leeg; er verschijnen geen mocks.

## Spotify instellen

1. Open het [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) en maak een Web API-app.
2. Voeg exact deze redirect URI toe: `http://127.0.0.1:3000/api/auth/spotify/callback`. `localhost` en `127.0.0.1` zijn voor OAuth verschillende hosts; verander de ene niet stilzwijgend in de andere.
3. Zet Client ID en Client Secret in `.env.local` en herstart de devserver.
4. Open **Smaakprofiel**, verbind Spotify en synchroniseer.

De app gebruikt Authorization Code Flow, een beveiligde en kortlevende `state`-cookie en uitsluitend scope `user-top-read`. De drie officiële perioden (`short_term`, `medium_term`, `long_term`) halen ieder maximaal 50 artiesten op. Access tokens worden automatisch vernieuwd. Een ingetrokken/verlopen sessie wordt ongeldig gemarkeerd; `401`, `403`, `429`, quota-antwoorden, time-outs en netwerkfouten krijgen een gerichte foutmelding. Verbreken verwijdert tokens en periodedata.

Actuele Spotify-aandachtspunten (gecontroleerd op 29 september 2026):

- [Get User's Top Items](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks) vereist `user-top-read`, ondersteunt de drie perioden en maximaal 50 resultaten.
- [Authorization Code Flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow) ondersteunt langdurige toegang via refresh tokens en adviseert `state` tegen CSRF.
- [Development Mode en quota](https://developer.spotify.com/documentation/web-api/concepts/quota-modes): de app-eigenaar heeft Premium nodig, maximaal vijf geautoriseerde gebruikers kunnen worden toegevoegd en iedere gebruiker moet op de allowlist staan. Sinds de [quota-update van juli 2026](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates) delen Development Mode-apps quota per developeraccount.
- [Rate limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits) gebruiken onder meer `429` en doorgaans `Retry-After`.
- Spotify-genres kunnen leeg, grofmazig of onvolledig zijn en het artiestgenreveld is deprecated. Daarom combineert de score Spotify-artiesten met gekozen genres en providerclassificaties. De genreselector wordt automatisch gevuld uit actuele eventdata plus een vaste muziektaxonomie; de gebruiker hoeft geen vrije genretekst toe te voegen. Verwijderde recommendations- en audio-features-endpoints worden niet gebruikt.
- Spotify-metadata en afbeeldingen worden met een teruglink naar Spotify gepresenteerd. Zie de attributienotitie in de [officiële Web API-reference](https://developer.spotify.com/documentation/web-api/reference/get-track). Spotify-content wordt niet aangepast, gedownload of voor ML gebruikt.

## Ticketmaster instellen

1. Registreer via de [Ticketmaster Developer Portal](https://developer.ticketmaster.com/).
2. Plaats de Consumer Key als `TICKETMASTER_API_KEY` in `.env.local`.
3. Herstart en kies **Evenementen verversen**.

De implementatie gebruikt alleen de officiële [Discovery API v2](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) en filtert op Nederland en `music`. De zoekstrategie combineert:

- Amsterdam als stad;
- de officiële `geoPoint`-zoekparameter rond Amsterdam met `EVENT_SEARCH_RADIUS_KM`;
- één gebundelde venue-ID-query voor officieel herkende catalogusvenues;
- aanvullende, regionaal begrensde zoekopdrachten voor maximaal vijf persoonlijke topartiesten;
- een gemeenschappelijk datumbereik van zes maanden.

Resultaten worden gevalideerd, genormaliseerd en in SQLite gecachet. Eén ongeldig evenement breekt de batch niet. Zoekresultaten worden eerst op provider/externe ID en vervolgens conservatief op artiest/titel, lokale datum en venue-alias gededupliceerd. Bronverwijzingen blijven apart opgeslagen. `SyncRun` registreert gevonden, toegevoegd, bijgewerkt, overgeslagen en mislukt.

Ticketmaster noemt standaard **5 requests per seconde en 5.000 per dag**, plus een deep-paginggrens; zie de [Discovery API-documentatie](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/). De app voert providerrequests sequentieel en getemporiseerd uit, bundelt venue-ID’s, gebruikt maximaal vijf persoonlijke artiestzoekopdrachten en leest daarna vijf minuten uit de lokale cache. De [Ticketmaster-gebruiksvoorwaarden](https://developer.ticketmaster.com/support/terms-of-use/) blijven van toepassing.

### Datadekking en ticketstatus

Ticketmaster bevat niet elk Amsterdams evenement. De pagina **Dekking** toont de actieve provider, laatste bruikbare sync, laatst gevonden event per bekende venue en ontbrekende koppelingen. “Geen resultaat” betekent nooit “geen evenement”. Kleinere clubs en evenementen met een andere ticketpartij zijn de voornaamste dekkingsgaten.

Intern bestaan alleen `AVAILABLE`, `SOLD_OUT`, `UNKNOWN` en `NOT_CHECKED`. Alleen expliciet `onsale` wordt beschikbaar; alleen expliciet `soldout` wordt uitverkocht. `offsale`, geannuleerd, uitgesteld, verplaatst of ontbrekend worden niet als uitverkocht geïnterpreteerd. Onzekerheid verschijnt als **Controleer bij aanbieder**. De provider, officiële link, ruwe status en controletijd blijven zichtbaar. Prijs of daadwerkelijke voorraad wordt nooit beloofd.

## Score en tabs

De centrale gewichten staan in `src/lib/scoring.ts`. Eerst worden uitgesloten artiesten/genres en eerder afgewezen events behandeld. Daarna tellen mee:

- exacte Spotify-artiestmatch en rang binnen een ingeschakelde periode;
- handmatige artiest (`favoriet`, `interessant`, `neutraal`);
- handmatige genre-overlap en providerclassificaties;
- een kleine discoveryboost voor een passende, nog niet getoonde artiest.

De som wordt begrensd op 0–100. **Jouw artiesten** vereist een exacte Spotify- of handmatige match; **Ontdek voor jou** heeft relevante score zonder zo’n exacte match; **Alles** toont alle gevonden muziekevenementen binnen het bereik.

## Kalender, ICS en meldingen

De agenda heeft week- en maandweergave. Een event of alle opgeslagen events kan als `.ics` worden geëxporteerd. De export gebruikt stabiele unieke UIDs, correcte escaping, UTC-tijd afgeleid van Amsterdamse eventdata, locatie, beschrijving en officiële URL. Ontbrekende eindtijd blijft gewoon afwezig.

Browsermeldingen vragen expliciete toestemming. Na een succesvolle handmatige synchronisatie vraagt de client nieuwe events binnen zeven dagen op die boven de ingestelde score vallen. `NotificationLog` voorkomt dubbele meldingen. Zonder open browser, lokale achtergrondservice of gehoste scheduler haalt deze lokale app **niet zelfstandig** data op en kan zij geen continue meldingen leveren. Er wordt geen e-mail verstuurd.

## Kwaliteitscommando's

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

De optionele live smoke-test draait alleen zinvol met een echte sleutel:

```powershell
$env:TICKETMASTER_API_KEY="..."
npm run test:live
```

Fixtures zijn uitsluitend testdata. De normale suite doet geen externe requests.

## Routekaart

- hosting met beheerde secrets en database;
- scheduler/cron voor periodieke synchronisatie;
- e-mailprovider achter `NotificationProvider`;
- echte authenticatie en meerdere gebruikers op de bestaande `userId`-relaties;
- extra officiële eventproviders achter `EventProvider`, na juridische en technische verificatie;
- Google Calendar- en Outlook-OAuth achter `CalendarProvider`; Apple Calendar blijft via ICS mogelijk;
- provider-ID’s en officiële coördinaten in de venuecatalogus verder aanvullen op basis van gevalideerde API-resultaten.

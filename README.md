# Hone

Hone förvandlar en vag idé ("jag borde fixa garaget", "jag vill komma i form")
till konkreta uppgifter i din egen Todoist. Appen generaliserar disciplinen
från teamets egna `/grilling`-skill — en ihärdig, grenande intervju som gräver
sig fram från en luddig känsla till en konkret plan — från kodprojekt till
vardagsliv.

Du loggar in, klistrar in din personliga Todoist-API-token i inställningarna
och startar en **intervju**: ett samtal, en fråga i taget, som drivs av en
enda språkmodells-systemprompt. Modellen ringar först in vad projektet
faktiskt är, drillar sedan ner i konkreta steg och föreslår till slut en
uppgiftslista. Du granskar och redigerar listan i en tabell och bekräftar —
då skapar appen ett dedikerat Todoist-projekt med uppgifterna i.

> Uppgiftsbeskrivning: `docs/assignment.md`. Full design/arkitekturplan:
> `docs/plan.md`. Arkitekturöversikt för kodgranskning: `ARCHITECTURE.md`.
> Domänordlista: `CONTEXT.md`. Så arbetar teamet: `docs/team-workflow.md`.

## Status

MVP med ett fungerande helt flöde: konton (registrering/inloggning),
Todoist-token i inställningarna, intervju → checkpoint → uppgiftsdrillning →
förslag, granska/redigera-tabell, bekräfta → riktiga uppgifter i användarens
Todoist, samt en läsbar historikvy över tidigare sessioner. Se **Kända
begränsningar** nedan för vad som medvetet lämnats utanför MVP och vilka kända
luckor som finns.

## Stack

| Lager | Val | Varför |
|---|---|---|
| Ramverk | TanStack Start (RC), React 19, TypeScript | "Stort språk" enligt uppgiftstipset; server functions håller API-nycklar borta från klienten |
| Hosting | Vercel | Lägsta friktionen till en publik demo-URL (kräver `nitro`-plugin, se Deployment) |
| Databas | Supabase (Postgres) + Drizzle ORM | Konton, Todoist-tokens och intervjuhistorik; en enda migrationshistorik |
| Auth | Better Auth (e-post + lösenord), tabeller i samma Postgres-schema som appens egna | Riktiga per-användarkonton; `docs/adr/0001` motiverar valet framför Supabase Auth |
| Språkmodell-gateway | OpenRouter, anropad via en handskriven `fetch`-klient (inget AI-SDK) | En integrationsyta, modellbyte via miljövariabel |
| Primär modell | `anthropic/claude-sonnet-4.6` | Intervjukvalitet är en uttalad prioritet; kostnaden är försumbar i vår skala |
| Dev-modell | `google/gemini-2.5-flash` | Billigt alternativ under utveckling, byts in via `OPENROUTER_MODEL` |
| Uppgiftsdestination | Todoist REST API v1, personlig API-token per användare, handskriven `fetch`-klient | Ingen OAuth-granskning; tokens lagras per konto, krypterade |

## Komma igång

Kräver Node 24.

```sh
npm install
cp .env.example .env.local  # fyll sedan i riktiga värden (en lokal Postgres duger för dev/test)
npm run dev        # dev-server på http://localhost:3000
npm run typecheck  # tsc --noEmit
npm test           # vitest, mot en riktig (test-)Postgres — se .env.example
npm run build      # produktionsbygge (det Vercel kör)
```

Intervjun kräver `OPENROUTER_API_KEY` i `.env.local`. Utan den startar
appen men själva intervjun returnerar ett felmeddelande.

## Databas

Schema och migrationer hanteras med Drizzle och täcker både Better Auths egna
tabeller och appens egna som **en enda linjär historik**
(`docs/adr/0001`).

```sh
npm run auth:generate  # regenerera src/lib/server/db/schema/auth.ts efter ändring i src/lib/auth.ts
npm run db:generate    # skapa en ny SQL-migration från schemafilerna under src/lib/server/db/schema/
npm run db:migrate     # applicera väntande migrationer mot MIGRATION_DATABASE_URL
```

**Förstagångsuppsättning av Supabase:** kör `scripts/supabase-setup.sh` — en
steg-för-steg-guide som skapar projektet, fångar anslutningssträngarna till
`.env.local`, kör första migrationen och (om Vercel redan är länkat) pushar
strängarna till Vercels miljöer.

Den körande appen ansluter via `DATABASE_URL` (Supabases transaction-pooler,
port 6543, `prepare: false`); migrationer körs mot `MIGRATION_DATABASE_URL`
(den direkta anslutningen, port 5432). Att blanda ihop de två är den mest
sannolika fällan — `docs/research.md` §4.3 beskriver den i detalj, inklusive
att den direkta värden är IPv6-only och att Supabases dashboard visar en
missvisande banner.

## Deployment

Appen deployas till Vercel, men **inte helt automatiskt**. TanStack Start
levererar inte längre en egen Vercel-adapter, så `vite.config.ts` måste ha
plugin-en `nitro({ preset: 'vercel' })` — annars lyckas klientbygget men varje
route ger 404 på Vercel (`x-vercel-error: NOT_FOUND`) eftersom det inte finns
någon server-funktion att routa till. Preset:en är hårt satt (inte
autodetekterad) eftersom autodetekteringen utgår från en gitignore:ad lokal
fil och tyst faller tillbaka på fel preset vid en ren checkout. CI vaktar mot
regression. Bakgrunden: issue #33.

`BETTER_AUTH_SECRET` måste vara satt för **varje** deployad miljö, även
Preview — Vercel sätter `NODE_ENV=production` även där, och Better Auth vägrar
starta på sin default-secret (`docs/adr/0004`).

**Förstagångsuppsättning:** kör `scripts/vercel-connect-deploy.sh`. Därefter,
dagligdags:

```sh
npx vercel         # deploya en preview
npx vercel --prod  # deploya till produktion
```

Produktionsdeploys kommer från `main`; `dev` och feature-brancher får previews
(`docs/team-workflow.md` §5).

## Arkitektur

`ARCHITECTURE.md` är ingången för en kodgranskare: en modulkarta och två
genomgångna flöden (en intervjutur; att bekräfta en uppgiftslista). Varje
modul har dessutom en filheader som förklarar sitt syfte, sitt ursprungs-issue
och var designbeslutet är dokumenterat. Domänbegreppen (Interview, Session,
Checkpoint, Phase, Task Breakdown) definieras i `CONTEXT.md` och används exakt
i koden.

Kort översikt: en `src/routes/`-route är tunn (en guard, lokalt state, anrop
till server functions); `src/lib/` är ren, miljöfri logik med test bredvid
varje fil; `src/lib/server/` är allt som rör omvärlden — databasen, språk-
modellen, Todoist. Kärnlogiken (intervjuslingan, skapa-och-rulla-tillbaka-
flödet) ligger i orkestrerare (`interview-turn.ts`, `todoist-creation.ts`)
bakom injicerade portar, så den testas helt utan databas och nätverk. **Phase
lagras aldrig** — den härleds alltid från vilka verktygsanrop som finns i
transkriptet plus `todoist_project_id`.

## Kända begränsningar

- **Ett enkelriktat flöde.** När en uppgiftslista väl har bekräftats till
  Todoist går den inte att redigera vidare från appen. Detta är ett medvetet
  MVP-val: hela konversationen och den föreslagna listan sparas i databasen,
  så flödet kan byggas ut med redigering/synk i efterhand utan att data går
  förlorad.
- **Intervjun är enkelsittning.** En session körs klart i ett svep — det finns
  ingen "återuppta"-ingång. En avbruten intervju startas om som en ny session
  (`docs/plan.md` §13).
- **Bar visuell design.** MVP-skärmarna är handskriven Tailwind utan
  designsystem; en omstylning pågår som eget spår (issues #63–#69).
- **Övriga kända tekniska skulder:** route-filer exporterar icke-Route-
  komponenter vilket försämrar code-splitting (issue #30); `account.issuer` i
  det genererade auth-schemat är legacy och behöver städas innan Better Auth
  uppgraderas förbi 1.7.2 (issue #71).

## Reflektion

_Krävs av uppgiftsbriefen (`docs/assignment.md`). Svaren nedan är skrivna
efter att appen byggts, utifrån vad teamet faktiskt stötte på._

### Vilken ny AI-teknik/bibliotek identifierade vi och hur tillämpade vi det?

Den bärande tekniken är **LLM tool-calling**. Modellen anropar själv två
strukturerade verktyg under intervjun — `mark_checkpoint` (när projektet är
tillräckligt definierat) och `propose_task_breakdown` (den färdiga
uppgiftslistan) — medan ett tredje, `create_todoist_tasks`, medvetet hålls
utanför modellens verktygslista och körs direkt av backend när användaren
bekräftar. Uppdelningen i "modellen föreslår" och "backend agerar" är själva
poängen: granskningssteget däremellan är där användaren fångar modellens
misstag.

Den andra tekniken är **avancerade system-instructions**. Intervjun drivs av
en enda genomtänkt systemprompt som spänner över hela samtalet, författad med
en dedikerad prompt-metodik (`writing-for-agents`-skillen) i stället för en
generisk chatbot-prompt: positiv formulering framför negation, ett skarpt
avslutskriterium per verktyg, och inget processjargon som kan läcka ut till
användaren. Vi lade dessutom in en **mekanisk spärr** i orkestreraren —
`propose_task_breakdown` erbjuds inte förrän `mark_checkpoint` har fyrats — så
att en för tidig uppgiftslista blockeras oavsett hur promptdisciplinen håller.

Ett medvetet val värt att nämna: vi använde **inget AI-SDK**.
OpenRouter-klienten är ~90 rader handskriven `fetch` (och Todoist-klienten
likaså). För ett projekt som ska visa förståelse för koden vägde kontroll och
läsbarhet över abstraktionslagrets bekvämlighet — hela mappningen från
verktygsanrop till HTTP-anrop är synlig i en fil.

På processidan identifierade vi våra egna **Claude Code-skills** som verktyg:
ett litet skills-repo med en process vi själva definierade. `/grilling`
användes som planeringsmetod (se avsnittet längre ner) och `/wizard` för att
generera en infrastrukturuppsättning redo för produktion.

### Motivera varför vi valde den AI-tekniken/det biblioteket

Tool-calling valdes för att det ger ett verkligt, verifierbart gränssnitt
mellan att modellen tänker och att modellen agerar. Att dela upp förslag och
skapande i två separata steg gör att vi kan lägga in en granskning emellan
utan att offra att AI:n faktiskt utför handlingen — och granskningstabellen är
produktens egentliga mekanism för att fånga AI-misstag, inte ett
gummistämpel-godkännande.

OpenRouter valdes som gateway för att kunna byta modell utan att skriva om
integrationskoden. Det värdet var inte hypotetiskt: vi körde `gemini-2.5-flash`
under utvecklingen och `claude-sonnet-4.6` för den riktiga intervjun, och
kunde växla mellan dem med en miljövariabel.

Claude Sonnet 4.6 valdes som primär modell eftersom intervjuns kvalitet —
förmågan att ställa relevanta följdfrågor och att inte konvergera för tidigt —
var en uttalad prioritet över kostnad, som ändå landar på ensiffriga
dollarbelopp i vår skala.

### Varför behövdes AI-komponenten? Skulle vi kunna löst det på ett annat sätt?

Kärnan i produkten är den adaptiva, grävande intervjun. Ett statiskt formulär
eller en regelbaserad lösning kan inte ställa relevanta följdfrågor utifrån
vad användaren faktiskt svarar, och kan inte ta en vag känsla ("jag borde göra
något åt garaget") till ett konkret, väldefinierat projekt. Todoist-delen i
sig — skapa ett projekt, skapa uppgifter — kräver ingen AI alls; värdet ligger
uteslutande i frågeprocessen som gör grovjobbet med att omvandla en oklar idé
till görbara steg.

Vi testade detta empiriskt genom att köra riktiga intervjuer mot flera
modeller. Skillnaden i följdfrågornas kvalitet var tydlig: Gemini 2.5 Flash
var märkbart underlägsen Sonnet 4.6 — den nöjde sig oftare med vaga svar och
konvergerade för tidigt. En del av det gick att kompensera med tydligare
system-instructions, men inte allt. Det bekräftade både att komponenten
behövde en LLM och att modellvalet inom den faktiskt spelade roll.

### Vad som var svårt och vad vi skulle gjort annorlunda

Det som förvånade oss mest var att **AI-komponenten i sig var relativt
smärtfri** — tool-calling-formatet betedde sig som förväntat och gav inga
otäcka överraskningar. Tiden gick i stället åt till infrastrukturen runt
omkring: TanStack Start (RC) drog tillbaka sin Vercel-adapter mitt i
projektet, vilket gav previews som byggde grönt men gav 404 på varje route;
Better Auth tappade tyst inloggnings-cookies om plugin-ordningen var fel;
`drizzle-kit` svalde felmeddelanden och skrev bara ut en spinner; Supabases
direktanslutning visade sig vara IPv6-only. `docs/research.md` §4 är i
praktiken en logg över det vi lärde oss den hårda vägen. `/wizard`-skillen
gjorde den annars tröga infrastrukturuppsättningen (Supabase-poolers,
Vercel-miljövariabler, Better Auth-secrets) genomförbar utan att vi behövde
sätta oss in i Vercels dokumentation på djupet.

Det vi skulle gjort annorlunda är att **ta fram ett UI tidigare i processen**,
frånkopplat från domänmodellen, för att bestämma en grundläggande
stilkänsla i ett tidigt skede. Vi lät MVP:n bli visuellt bar och började
iterera på utseendet först i efterhand, vilket blev ett eget spår i stället
för en integrerad del av bygget.

### AI i utvecklingsprocessen

Appen utvecklades genomgående med AI-stöd (Claude Code). `/grilling` som
planeringsmetod var väl värt det: genom att först grilla fram tydliga,
grenade instruktioner kunde modellen sedan bygga appen med få initiala buggar,
och det gick snabbt att nå ett resultat som ser genomarbetat ut. Den
avvägningen — mycket planering upp front, snabb och stabil implementation
efteråt — skulle vi göra igen.

All implementation skedde som mob. Ett fåtal tidiga processbeslut — pitch-valet
(issue #2) och en docs-branch som pushades direkt i stället för via PR (issue
#61) — togs solo under tidspressen mot den 11 september. Vi loggade varje
sådant tillfälle öppet i issue-spåret när det hände; transparensen kring dem
är en del av vad vi vill visa, snarare än något vi städat bort i efterhand.

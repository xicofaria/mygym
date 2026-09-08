# Contratos das funcionalidades

Regras de implementação por área, extraídas do AGENTS.md para consulta seletiva.
Ler as secções relevantes antes de alterar a funcionalidade; as regras gerais
estão em [AGENTS.md](../AGENTS.md).

## Workout input

- Weights are decimal kg (`real` in SQLite). Accept both `2.8` and `2,8` using
  `parseWeight` in `src/lib/decimal.ts`; do not round or restrict to 0.5 steps.
- Keep decimal input as text with `inputMode="decimal"` so comma entry works
  consistently. Empty weight is invalid; explicitly entered 0 is valid.
- Validate every row; never filter away incomplete/invalid sets during save.
  Keep server limits (1–1000 integer reps, 0–2000 kg, max 500 sets).
- Local drafts are namespaced by authenticated user and form scope. Clear
  only after confirmed persistence; images must never enter local drafts.
- Group only consecutive sets of the same exercise; never reorder supersets.
  A group selector updates that block; duplication preserves decimal strings.
- Rest timer uses a user-scoped absolute deadline in localStorage and never
  saves or mutates workout sets. Use elapsed wall time, not interval counts.
- Catalogue search includes aliases, equipment and translated muscle groups.
  Built-in metadata is seeded/migrated once; respect explicitly cleared fields.

## Machine photo recognition

- Entry UI: `src/components/machine-photo-picker.tsx`, used by `WorkoutForm`.
  Camera/file selection → local JPEG preparation → preview → explicit send →
  suggestions → user confirmation. Keep the manual catalogue usable.
- `POST /api/exercises/recognize` authenticates, checks same Origin, limits
  requests and actual streamed bytes, and fetches the catalogue server-side.
- `src/lib/machine-recognition.ts` implements OpenAI Responses and OpenRouter
  Chat Completions adapters; it
  must only be called from the server. Shared client schemas belong in
  `recognition-contract.ts`. Never import the adapter into client components.
- `AI_PROVIDER` selects openai (default) or openrouter. Both API keys are
  server-only; never add `NEXT_PUBLIC_`, log keys/images or return provider
  error bodies. OpenRouter defaults to qwen/qwen3-vl-30b-a3b-instruct; its
  configured model must support images and strict JSON Schema, except the explicit
  `z-ai/glm-5.3-flash` adapter which uses JSON mode plus server schema validation.
- Use `store: false` for OpenAI; OpenRouter requests `require_parameters: true`
  and `data_collection: "deny"`. Keep provider-specific privacy copy accurate.
  The app persists neither images nor recognition results.
  Browser canvas re-encoding removes original EXIF and reduces upload size.
  This does not promise zero retention by the API provider.
- Treat photo text and catalogue labels as untrusted data, not instructions.
  Validate model output and IDs against the server catalogue. Accept no match.
  Never create exercises without the user's explicit confirmation of a reviewed
  AI proposal, and never infer loads. Confidence labels are estimates.
- Limits: source photo 20 MB, JPEG upload 1 MiB, longest side 1280 px,
  catalogue 500 exercises, 25-second provider timeout (GLM 5.3 Flash: 120 seconds
  with max effort; browser 130 seconds, route maxDuration 150), 10 attempts/min/user
  per instance. Additionally, reserve an atomic DB quota before provider calls:
  `AI_DAILY_LIMIT` (default 20, 1–1000) per account/Lisbon calendar day.
  Failures also consume attempts. This is not a monetary budget; configure
  provider credit limits. Retain edge protection for request floods.
- See [AI_RECOGNITION.md](AI_RECOGNITION.md) for configuration, privacy and validation.

## Calorie tracker

- `/calories` is a private diary/catalogue/settings surface; do not enable the
  viewed-user switcher or accept a caller-supplied owner ID.
- Nutrition is per 100 g OR per 100 ml; the consumed quantity uses that exact
  unit. Never treat one ml as one gram, kJ as kcal, or missing nutrients as zero.
- Store immutable validated product snapshots on consumption entries. Editing a
  quantity with the same product retains its snapshot; product metadata edits
  must not rewrite history. Archive removes the product photo but keeps history.
- Goals are user-defined, effective from the current Lisbon day. Past days retain
  their goal. A day counts towards milestones only when explicitly completed
  and inside the user-configured range; missing days are not successes. Edits and
  deletions reopen the affected day. No calorie recommendations or deficit rewards.
- New tables: food_products, food_entries, calorie_goals, food_days (migration
  0003). Keep published 0000–0002 immutable.
- Product photos are an explicit exception to transient workout photos: private
  JPEG thumbnails, up to 160 KB decoded, served via authenticated no-store
  `/api/calories/photos/[id]`. Never send all photo blobs in page props, cache
  them in the service worker, or expose them to the partner account.
- Food AI uses the existing server-only provider configuration and shared daily
  quota. Separate strict label reading from explicitly labelled estimates.
  Require review before saving and manual quantity confirmation in the diary.
- Migration 0004 adds private product `details` JSON: package size, single edible
  unit size and estimation flags/keys. Legacy products/snapshots use empty defaults.
  These sizes never replace the per-100 nutrition base. Quantity conversions must
  be positive, finite and <=10000 g/ml. History keeps the original details too.
- Show recognized package weight and its estimate flag as read-only context in
  the product form; explicitly show unknown AI package weight. Never extract
  grams from free-text explanations or confuse a serving with a whole package.
  Selecting/saving a product with known package weight prepares one whole package
  in the diary; users can change it and must explicitly save consumption.
- Product forms do not ask for package/unit weights. Resolve those in the diary;
  unit/package modes are never disabled for missing metadata. Show conversion
  details there; explicit AI unit estimation sends only server-owned product
  name/brand/nutrition, not photos or diary, to the configured provider.
- `/api/calories/products/[id]/unit` authenticates, checks origin/ownership, shares
  the daily quota and preserves unknown sizes. Suggestions do not write to DB.
  Saving consumption computes grams server-side from the validated count/factor,
  snapshots that factor and remembers it for future new entries in one transaction.
  Editing history never updates catalogue conversion metadata or nutrition.
- Food photo input is one OS file picker (camera/gallery choices vary by device).
  Default analysis permits estimates; label-only mode rejects any estimated fields.
  Mark estimates per nutrient and for package/unit sizes. No package weight without
  sufficient cues, no inferred consumed count, no solving unknown macros from kcal.
- OFF store filters cover Continente, Lidl, Pingo Doce, Mercadona and Aldi. These
  are collaborative samples, not complete retailer catalogues.
- AI waiting UI shows elapsed time, reduced-motion-safe animation and cancellation,
  never invented percentage progress or hidden reasoning. Food cancellation preserves
  the photo/fields and ignores late responses; already-dispatched calls may be billed.
- GLM may return unknown brand as null: normalize only that optional metadata to
  empty string. Nutrition validation stays strict. Explanations are bounded at 1000.
- Open Food Facts is a collaborative, non-official retailer source. Keep ODbL
  data / CC BY-SA photo attribution and source URLs. Only its fixed API host and
  images.openfoodfacts.org image host are allowed. No retailer scraping, no
  automatic public uploads of private photos. Handle unavailable/incomplete data.
- See [CALORIES.md](CALORIES.md) for research, privacy, assumptions and validation.

# Arquitetura

Contexto técnico de referência. As regras gerais estão em [AGENTS.md](../AGENTS.md)
e os contratos detalhados em [DOMAIN_RULES.md](DOMAIN_RULES.md).

**Auth (`src/lib/auth.ts`).** A signed JWT (`jose`, HS256) in an httpOnly cookie;
passwords hashed with `bcryptjs`. `requireUser()` is the security boundary: it is
called by the protected layout and independently by private actions and routes.
Public login, registration and recovery validate input without requiring a session. `login`/`logout` are server actions
(`src/app/login/actions.ts`, `src/app/(app)/actions.ts`).

**Routing.** `src/app/(app)/` is the protected area — its `layout.tsx` calls
`requireUser()` and renders the app shell (header, account link, `BottomNav`).
`/` and `/login` are public. `src/app/page.tsx` redirects based on session.

**Reads vs. writes.** Reads live in `src/lib/queries.ts` (`import "server-only"`;
aggregation like est-1RM and per-session grouping is done
in plain JS). Writes are **server actions colocated in each feature's
`actions.ts`** — they `requireUser()`, validate with Zod, mutate via Drizzle,
`revalidatePath(...)`, then `redirect(...)`. Client components call actions
directly with **typed objects** for structured data (e.g. `createWorkout({ date,
entries })`); public account forms also use `FormData`; inspect their current submit handlers.
Multi-step writes must use a database transaction. Update and delete actions
must re-read ownership from the signed-in user instead of trusting client data.

**Contas privadas.** Cada página privada obtém a conta autenticada com `requireUser()`.
O seletor de parceiro e `getPageContext` foram removidos; `?user=` é ignorado.
Passar apenas o ID da sessão às leituras privadas e às verificações de propriedade.

**Database (`src/db/`).** A single libSQL client (`index.ts`); schema in
`schema.ts`. Local dev uses `file:./dev.db`; production uses a Turso
`libsql://…` URL + `DATABASE_AUTH_TOKEN` (same driver, no code change).
Timestamps are stored as unix seconds and surfaced as JS `Date`s; foreign keys
cascade on delete (libSQL enforces FKs). `next.config.ts` lists
`@libsql/client` in `serverExternalPackages` so its native binding isn't bundled.

**Entrada de IA.** `src/components/ai-photo-prompt.tsx` (`'use client'`) é o
único cartão que inicia um fluxo de IA por fotografia. Rende o ícone, a pergunta,
a explicação de quem confirma o resultado e os dois inputs de ficheiro (câmara
traseira e galeria), e entrega o `File` já escolhido via `onFile`; a preparação
da imagem, a chamada e os estados ficam em quem o usa —
`machine-photo-picker.tsx` e `food-product-form.tsx`. Um terceiro fluxo de IA
deve reutilizar este cartão em vez de repetir a marcação, para que a IA se leia
sempre como o mesmo atalho opcional. O indicador de espera partilhado é
`ai-thinking.tsx`.

**Charts.** `src/components/progress-chart.tsx` is the only Recharts surface
(`'use client'`); server pages pass plain `{ date, … }[]` arrays into it. Its
`unit` prop is just the chart's display suffix (e.g. `"kg"`, `" cm"`) — not
related to the (removed) per-exercise unit field. For a trend line with no axes
or interaction, prefer `src/components/sparkline.tsx`: plain SVG, renders on the
server, ships no JS.

**Body progress.** `src/lib/body-progress.ts` is a pure, unit-tested module that
turns body-metric rows into per-measure progress over a range (`?range=`, one of
`30d|3m|1y|all`, default `3m`; `?measure=` selects the expanded chart — both
strictly validated). Two conventions matter. **The baseline for a range is the
last reading *before* the window** (falling back to the first inside it), so a
range shows real change over it even when you measure rarely. **Each measure
carries a `goal`** (`down` for waist and body fat, `up` for chest/arm/thigh,
`neutral` for weight and hips, since those depend on cutting vs. bulking);
`deltaTone()` maps a change plus its goal to good/bad/neutral colouring, so
green never means "the number went down" by itself.

**Workout templates.** `workoutTemplates` + `workoutTemplateExercises` (schema)
are per-user, ordered lists of exercises with no reps/weight (e.g. "Treino de
Pernas" → Squat, Leg Press). `getWorkoutTemplates`/`getWorkoutTemplate` in
`queries.ts` read them; `src/app/(app)/workouts/templates/` has the manage
page + actions (`createTemplate`, `deleteTemplate`). `/workouts/new` accepts
`?template=<id>`, fetches it server-side, and passes `initialRows` into
`WorkoutForm` — the form is keyed on the template id
(`key={activeTemplate?.id ?? "blank"}`) so switching templates remounts it and
actually resets state (a plain prop change would not, since `useState`'s
initial value only applies on first mount).

**Calendar & planned workouts.** All calendar date math uses the UTC-midnight
convention (workout dates are stored as `new Date("YYYY-MM-DD")`, i.e. UTC
midnight, so ISO `YYYY-MM-DD` keys and exact-equality date filters line up).
`src/lib/workout-calendar.ts` (52-week dashboard heatmap + `readDateKey`
query-param validation) and `src/lib/month-calendar.ts` (month grid for
`/workouts` + `readMonthKey`) are pure, unit-tested modules. `plannedWorkouts`
(schema) schedules a workout on a date, optionally tied to one of the user's
templates; completion uses an **explicit `workoutId` link**, written atomically
when its planned session is logged. Other sessions on the date do not complete
it. Deleting that workout clears the link via the foreign key; moving it to
another date clears the link in the update action. `/workouts` accepts
`?month=YYYY-MM` and `?date=YYYY-MM-DD`
(both strictly validated); a selected future day offers `PlanWorkoutForm`, and
"Registar" links to `/workouts/new?date=…&template=…`, which prefills both.

**Muscle groups & the weekly routine.** A plan says *what* it trains
(`plannedWorkoutGroups`) independently of *which exercises* it starts from (the
optional template). Groups are plain labels, not an entity — `MUSCLE_GROUP_SUGGESTIONS`
in `src/lib/muscle-groups.ts` is only a shortcut, and any text the user types is
equally valid, so never validate against the suggestion list.
`normalizeGroupNames()` (trim, collapse spaces, drop case-insensitive
duplicates, cap at 8) is the single funnel every write goes through.
`routineGroups` stores the recurring weekly split — one row per group per ISO
weekday (1 = Monday … 7 = Sunday), and a weekday with no rows is a rest day.
`applyRoutineToMonth` materializes it into planned workouts via the pure
`planRoutineApplication()` in `src/lib/routine.ts`: **only days from today
onward that have no plan yet**, so re-running it never duplicates or destroys
anything. Editing `/workouts/routine` saves per weekday as you toggle chips
(last write wins); there is no save button.

## Contas e relatórios

O registo público está em `/registo`; nome, email, palavra-passe, eliminação RGPD
e preferência de relatório semanal estão em `/conta`. A verificação de email e
recuperação de palavra-passe ativam-se com `RESEND_API_KEY`, `EMAIL_FROM` e `APP_URL`.
Com email ativo, a alteração de endereço só é aplicada após confirmação em
`/verificar`; sem esse serviço, é imediata após validar a palavra-passe.
O email semanal é opt-in: `weekly_report_enabled` começa a `false` (migração 0007).
O relatório no ecrã continua disponível sem subscrição de email.

## Convenções técnicas

- Alias `@/*` corresponde a `src/*`.
- `src/proxy.ts` gera o nonce CSP por pedido; autenticação fica nas entradas privadas.
  A renderização dinâmica e os limites da cache estão em [DEVSECOPS.md](DEVSECOPS.md).
- Tailwind 4: `@apply` referencia utilities reais, não classes de componentes próprias.
- Scripts fora de Next carregam `.env.local` antes dos imports que leem o ambiente;
  nesses casos, o módulo da base de dados é importado dinamicamente.
- Ao alterar o schema, gerar e rever a migração e testá-la numa base descartável.
- `suppressHydrationWarning` no layout raiz acomoda atributos injetados por extensões.
- Calorias têm consultas especializadas em `src/lib/calorie-queries.ts`;
  ver [CALORIES.md](CALORIES.md) e os contratos para snapshots e conversões.

## Catálogo e medidas decimais

A migração 0008 acrescenta `exercises.user_id` e índices de nome por âmbito.
Exercícios base e legados (`user_id = null`) são comuns e só de leitura; adições
manuais/IA são privadas. `exercise-access.ts` concentra o filtro de visibilidade
usado nas leituras, no catálogo enviado à IA e nas validações de IDs recebidos.
A migração garante os exercícios base sem exigir contas de seed.

`body-metric-input.ts` partilha a validação entre formulário e ação: ponto/vírgula,
limites originais, vazio opcional e rejeição de qualquer campo inválido. Os
rascunhos mantêm-se durante o pedido e só são limpos após confirmação de gravação.

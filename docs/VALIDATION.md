# Validação — 2026-09-05

Base: `f4c0496b7e3367c4a8831d04ffdbe335543a9bef` (main).
Histórico Git recuperado e confirmado contra o commit do ZIP inicial.

| Verificação | Resultado |
| --- | --- |
| `npm run check` | Passou em Linux: lint, tipos, 86 testes e build Next 16.3.4 |
| `npm run lint` / `npm run typecheck` | Também passaram no Windows |
| `npm run test:e2e` | 17/17 em Chromium/Windows, com base descartável e ambas as chaves vazias |
| `npm run db:generate` | Gerador atualizado funciona; depois de 0002 não há diferenças de schema |
| `npm audit` | Zero vulnerabilidades, incluindo dependências de desenvolvimento |
| `git diff --check` | Sem erros |

Os testes SQLite são executados numa cópia isolada em Linux devido ao bloqueio
EBUSY do driver na limpeza de ficheiros temporários no Windows. Não foram
suprimidas asserções. O build Linux utiliza apenas DATABASE_URL/SESSION_SECRET
de teste; a primeira tentativa sem essas variáveis foi corretamente recusada.

Cobertura adicionada:

- Pesos com ponto/vírgula, zero explícito e rejeição de vazio/valores inválidos.
- Guardar/editar/repetir sem arredondar ou eliminar séries incompletas.
- Preparação real da imagem no browser, envio explícito, confirmação e fallback.
- Sessão, Origin, chave em falta, stream/MIME/assinatura e respostas estruturadas.
- Payloads OpenAI/OpenRouter, IDs inválidos, recusas, truncação e erros sem segredos.
- Quota diária atómica entre dois clientes, isolamento por conta e mudança de dia.
- Migração desde a versão anterior, com/sem ledger, preservando séries de 2.8 kg.
- Pesquisa de sinónimos/equipamento/músculos, edição e favoritos privados persistidos.
- Séries agrupadas, preservação dos valores, descanso/pausa/reposição e navegação.
- Layout mobile de 390 px sem overflow horizontal.

A revisão visual usa captura do teste mobile. Os mocks não medem precisão visual:
a validação com chave e fotografias reais continua pendente. A captura nativa em
iPhone/Android/PWA requer ainda teste nos dispositivos usados no ginásio.

Nenhum merge, deploy ou alteração à base de produção faz parte desta entrega.
Gestão de conta/palavra-passe foi explicitamente excluída.

## Calorias — 2026-09-06

Base: `66b3ded` (main, após merge do PR #27). Branch: `codex/calorie-tracker`.

- `npm run check`: passou em Linux, incluindo lint, tipos, 93 testes unitários e build de produção.
- `npm run test:e2e`: 20/20 em Chromium/Windows, com base descartável e chaves de IA vazias.
- Revisão visual das capturas mobile de Diário e Evolução, incluindo barras de progresso e navegação.
- Migração aditiva `0003_dark_beyonder.sql`, sem alterar as tabelas de treino existentes.
- Cobertura: porções decimais, nutrientes desconhecidos, histórico imutável, metas por data, conclusão/reabertura, períodos, isolamento entre contas e fotografias privadas.
- Importação e IA: preparação real da fotografia no browser, envio explícito, revisão obrigatória, falhas, contratos OpenAI/OpenRouter e dados Open Food Facts simulados.

Os testes simulados não medem a precisão da IA. A consulta real ao Open Food Facts
devolveu HTTP 503; a integração dispõe de fallback manual, mas a consulta real
com sucesso continua por validar. Não foram utilizados valores fictícios como
se fossem produtos reais de lojas. Ver [Calorias](CALORIES.md) para fontes,
licenças, configuração e limitações. Nenhum deploy ou migração de produção foi executado.

## Nutrição, porções e GLM — 2026-09-06

Branch `codex/nutrition-portions`, base `fcb0a09` (main).

- 99/99 testes unitários: acrescentados contratos GLM nos dois adaptadores,
  rejeição de estimativas no modo rótulo, conversões unidades/embalagens, filtros
  das cinco lojas e preservação de produtos/consumos na migração 0004.
- 22/22 E2E em Chromium/Windows: seletor único, análise simulada preenche a tabela,
  avisos por campo, recolha da área da foto, confirmação, 20 unidades e meia
  embalagem persistidos, espera/cancelamento e movimento reduzido; regressões de
  treino e isolamento também passam.
- Lint, tipos e build validados na cópia Linux isolada, sem chaves reais.
- `db:generate` confirma ausência de diferenças após gerar a migração 0004.
- Revisão visual mobile em modo escuro, 390 px, sem overflow horizontal.

Os produtos e valores das capturas são fixtures de teste, não análise real de um
produto Continente. Os testes automáticos não fazem inferência paga.
As limitações do peso inferido e da cobertura Open Food Facts estão na UI e na
documentação. Nenhum merge ou deploy executado nesta tarefa.

### Teste real autorizado de GLM 5.3 Flash

Foi usada uma chave temporária, recebida por stdin sem eco, nunca escrita em
ficheiros, no repositório ou em variáveis Vercel. Foram enviadas apenas duas
imagens sintéticas (rótulo com valores conhecidos e frente genérica sem peso),
em várias tentativas de diagnóstico. Não foi enviada a captura privada do utilizador.

- O limite inicial de 25 s provocou timeouts. O modo low foi testado durante o
  diagnóstico e abandonado a pedido do utilizador. A versão final usa max e 120 s.
- O modelo devolveu marca null e uma explicação acima de 400 caracteres. Corrigida
  normalização da marca desconhecida e limite textual de 1000; nutrientes continuam
  validados sem coerção de valores desconhecidos para zero.
- **Rótulo final:** HTTP 200, 4,078 s, JSON válido. Valores da porção de 30 g
  convertidos corretamente para 100 g: 600 kcal, proteína 25 g, hidratos 12 g,
  gorduras 50 g, saturados 7 g, açúcares 4 g, fibra 8 g, sal 0,2 g. Embalagem 200 g.
- **Estimativa com max:** HTTP 200, 35,539 s, JSON válido. Todos os nutrientes
  sugeridos marcados como estimados; embalagem sem peso permaneceu null e peso
  médio por unidade sugerido foi marcado como estimado.
- Estes ensaios validam integração e o rótulo de referência, não exatidão geral
  nem estabilidade de latência entre fornecedores. Chamada abortada pode ser cobrada.
- Foi pedido ao utilizador que revogasse a chave após os testes; não se afirma
  que a revogação tenha sido executada pela aplicação.

## Unidades no diário — 2026-09-06

Branch `codex/diary-unit-flow`, base `c364e4c` após merge do PR #29.

- 101 testes unitários: conversão calculada no servidor sem alterar nutrientes
  históricos, rejeição de quantidades inválidas e envio de contexto textual sem foto.
- 23 E2E: produto sem pesos, unidades sempre disponíveis, sugestão simulada,
  ajuste no diário, reutilização só após registar e autenticação/Origin/privacidade.
- Lint, tipos e build na cópia Linux isolada; revisão mobile dos dois formulários.
- Sem migração adicional. Mantém snapshots e dados anteriores.
- Não houve novas chamadas pagas. Não foi reutilizada a chave temporária anterior.

## Embalagem inteira — 2026-09-07

Branch `codex/package-weight-visibility`, base `e50f447` após PR #30.

- 102 testes unitários: peso estruturado distinto da base por 100, desconhecido
  preservado mesmo quando a explicação menciona uma porção de 280 g.
- 24 E2E: peso visível no produto, seleção automática de 1 embalagem após guardar
  e selecionar, 280 g persistidos, ajuste para 300 g, meia embalagem e persistência.
- Com 50,4 kcal/100 g: 280 g mostram 141,1 kcal; 300 g mostram 151,2 kcal;
  meia embalagem de 280 g mostra 70,6 kcal. Não cria consumo ao guardar produto.
- Build de produção usado pelos E2E; revisão visual mobile dos dois formulários.
- IA simulada, sem chamadas pagas; não comprova leitura real da fotografia.
- Sem migração ou alterações aos consumos históricos.

## Correspondência Open Food Facts na análise — 2026-09-07

Branch `feat/food-photo-off-match`, base `ae1a3b2` (main). Chave temporária
fornecida pelo utilizador para experiências fora do repositório, em `/tmp`, só
via variável de ambiente, nunca escrita em ficheiros; a revogação ficou a cargo
do utilizador. Modelos: `qwen/qwen3-vl-30b-a3b-instruct` (ronda 1) e
`z-ai/glm-5.3-flash` (restantes), com o payload do adaptador do repositório
(`require_parameters`, `data_collection: deny`, JSON mode para GLM).

Cinco fotografias reais de produtos Lidl/Alesto obtidas do próprio Open Food
Facts (ground truth conhecido: código, nome, kcal por 100 g). Os scripts e
relatórios ficaram fora do repositório.

- **Barcode:** com prompt fraco, a identificação inventou EAN em 4/5 fotos
  frontais; com o prompt final (dígitos só se impressos e legíveis, `null` por
  defeito) e normalização no servidor (formato 8–14), zero alucinações em 12
  chamadas concluídas. Fotos frontais não mostram o código: `null` é o correto.
- **Chamada combinada (identificação + rótulo), modo estimativa:** 8/8 limpas,
  marca correta em todas, kcal estimada com desvio 0–7% entre chamadas e todos
  os nutrientes marcados como estimativas. Modo rótulo: 2/5 JSON malformado
  (recuperou em repetição — transitório) e 1/5 timeout de 120 s.
- **Open Food Facts real:** `/api/v2/search` (filtro por loja) devolveu 503 em
  quase todas as tentativas; a pesquisa textual `cgi/search.pl` funcionou com
  falhas intermitentes (~metade das consultas), com ordenações instáveis entre
  chamadas iguais e entradas duplicadas do mesmo produto com kcal ligeiramente
  distinta. A busca por código (`/api/v2/product/{code}.json`) esteve sempre
  disponível.
- **Re-rank por IA testado e rejeitado:** com os mesmos candidatos, GLM
  `effort: medium` empatou na qualidade com `max`, custou ~20% menos, mas
  acrescentou um modo de falha próprio (escolha errada confiante). A ordenação
  difusa no servidor + lista de 3 confirmada pela pessoa é a solução escolhida.

Implementação: barra opcional no schema das duas análises, repetição única de
JSON malformado do fornecedor, pesquisa textual com tentativas curtas que falha
em silêncio, ordenação/deduplicação determinística e secção «Encontrado no Open
Food Facts?» com ação explícita Usar/Nenhum destes. Custos das experiências:
abaixo de 0,01 USD no total. Os testes automáticos continuam sem chaves e sem
inferência paga; a cobertura PT do catálogo e a latência em produção continuam
por validar em uso contínuo.

Revisão pré-merge: a resolução no catálogo limita a pesquisa ao orçamento
restante da análise (alvo de ~125 s; prazo único da IA entre tentativas e
sub-orçamentos para código/texto), «Remover fotografia» já não apaga a origem
importada, a deduplicação é por código de produto (embalagens 200 g e 300 g do
mesmo nome permanecem distintas) e a lista mostra fotografia e peso de
embalagem. A expressão «valores oficiais» foi removida: uma correspondência no
catálogo não comprova o rótulo atual. A lógica do orçamento (`resolveFoodCandidates`)
tem testes próprios com orçamentos curtos reais — orçamento esgotado não chama
o catálogo, código lento consome o restante e salta a pesquisa textual, falha
exata recai na pesquisa textual, sucesso exato não pesquisa texto; a rota
completa com fornecedor de IA lentíssimo continua sem ensaio de integração.

## Exercícios criados a partir da foto — 2026-09-07

Branch `feat/food-photo-camera` (sobre o merge do #35). Experiência real com a
mesma chave temporária autorizada (só env, nunca ficheiros): sete fotografias
públicas de máquinas (Wikimedia Commons), catálogo seedado real, chamada
combinada com proposta de criação em OpenRouter. GLM 5.3 Flash: 7/7 utilizáveis
(2 criações corretas, 3/3 correspondências, JSON 7/7, ~2,3 s, 0,0027 USD);
qwen3-vl: três identificações erradas com confiança alta. Detalhes em
AI_RECOGNITION.md.

Implementação: contrato com `suggestion` opcional (limites do
`exerciseInputSchema`; equipamento inválido degrada; proposta sem nome é
descartada), prompt testado, anti-duplicado server-side (proposta ≥0.8 contra
nomes/aliases vira candidato do exercício existente), `createExercise` devolve o
id e a UI oferece «Criar «…»» com formulário pré-preenchido, confirmação
explícita e entrada direta na série (lista local de extras no formulário de
treino até ao refresh). Correção de bug apanha em E2E: o formulário de criação
não pode estar aninhado no formulário do treino (o submit borbulhava e o action
nunca era chamado) — substituído por contentor simples com botão `type="button"`.
Testes unitários (118) e E2E mocked cobrem contrato, conversão, saneamento,
prompt, criação real na base descartável e rejeição de duplicado exato. Fotos
de internet, não do ginásio; precisão visual real continua por validar.

## Contas públicas — 2026-09-07

Branch `feat/public-accounts`. Migração 0005: `users` ganha `email_verified_at`,
`token_version` e `weekly_report_enabled`; nova tabela `email_tokens` (hash
SHA-256, uso único, expiração). Registo público em `/registo` com auto-login e
rate limit; recuperação e verificação construídas mas dormentes até existir
provider de email (`RESEND_API_KEY`/`EMAIL_FROM`) — sem ele, a recuperação
indica indisponibilidade. JWT passa a incluir `tokenVersion`: mudar
palavra-passe/email ou eliminar a conta revoga todas as sessões.
`/conta` com nome, email, palavra-passe e eliminação RGPD (transação, cascata
total). Seletor `?user=` removido: cada conta vê apenas os seus dados
(`?user=` é ignorado). Formulários convertidos de `useActionState` para
submissão direta — descoberta crítica em E2E: a repetição de submissão era
engolida (utilizador não conseguia repetir credenciais erradas). 116
unitários + 31 E2E verdes; `npm run check` OK.

### Revisão das contas públicas (5 correções) — 2026-09-07

1. Tokens ficam vinculados ao endereço concreto (coluna `email`) e são
   revogados em alterações de email/palavra-passe; links antigos deixam de
   autorizar após a mudança.
2. Com email ativo, o registo já não cria sessão: exige confirmação do
   endereço (e `getCurrentUser` devolve nulo para contas não verificadas).
3. `consumeLoginAttempt(...).allowed` na recuperação (o objeto era sempre
   verdadeiro e o limite nunca bloqueava).
4. Contas existentes migram no primeiro login com email ativo: o login envia
   o link de verificação; a reposição por link marca o email como verificado.
5. `tokenVersion` incrementa atomicamente (SQL) com optimistic lock; corridas
   são rejeitadas em vez de deixarem sessões por revogar.

### HEIC — decisão

heic2any exige `unsafe-eval` (incompatível com a CSP da app) e o sharp
prebuilt não decodifica HEVC-HEIC. Solução: HEIC é aceite onde o browser o
descodifica nativamente (Safari/iOS 17+, a origem real de ficheiros HEIC);
noutros browsers, mensagem acionável (Safari ou mudar o formato da câmara).
E2E cobre a orientação; decoder WASM compatível com CSP fica como follow-up.

## Relatório semanal — 2026-09-07

Branch `feat/public-accounts` (mesmo PR das contas). `calculateWeeklyReport`
puro e testado (treinos/volume/séries, PRs só quando a semana supera o
histórico anterior por exercício, kcal/dia com a regra «conta quando
concluído», variação de peso vs última anterior). Página `/relatorios` com
seletor semana atual/anterior. Email de segunda 08:00 UTC via `vercel.json`
cron → `/api/cron/weekly-report` protegido por `CRON_SECRET` (401 sem
segredo); sem provider de email o cron é um no-op explícito; destinos:
contas verificadas que **ativaram** o envio em `/conta` (opt-in: a coluna
`weekly_report_enabled` nasce a `false`, migração 0007).

### Segunda ronda da revisão (4 correções) — 2026-09-07

1. Reset e verificação passaram a ser transacionais: consumo do token e
   atualização da conta na mesma transação, com binding ao email atual — se o
   endereço mudou entretanto, o link morre sem consumir nada.
2. O relatório agrega calorias por dia civil (duas entradas de 1000 kcal no
   mesmo dia contam como 1 dia, média 2000, dia na meta com meta 2000) —
   `caloriesPerDay` puro e testado.
3. Treinos contam IDs distintos (duas sessões no mesmo dia = 2), ecrã e email.
4. Preferência do relatório semanal em `/conta` com persistência verificada
   em E2E. É **opt-in**: por indicação do utilizador (2026-09-07) o default
   passou a desativado na migração 0007, que também desliga as contas
   existentes — a 0005 tinha criado a coluna com `DEFAULT true` no mesmo PR
   ainda não lançado, portanto ninguém chegou a consentir o envio.

### Terceira ronda da revisão — 2026-09-07

- A agregação por dia civil passou para dentro de `calculateWeeklyReport`:
  `getWeeklyReportData` entrega uma linha por consumo e deixa de aplicar
  `caloriesPerDay` duas vezes. Um dia só com produtos de 0 kcal volta a não
  contar como dia registado (antes inflava `kcalRecordedDays` e baixava a
  média).
- `performReset` calcula o hash bcrypt **antes** de abrir a transação, para não
  segurar o lock de escrita (nem esgotar uma transação interativa remota).
- `TransactionRollback`/`ignoreRollback` vivem em `src/lib/transaction.ts`, em
  vez de duplicados em `/repor` e `/verificar` (onde a classe estava declarada
  acima dos imports).
- `getWeeklyReportData` usa `dateKey()` para as datas-só lidas da base de dados
  (convenção documentada) e corre as quatro leituras em `Promise.all`; o cron
  semanal repete-as por conta.
- `withinGoal()` em `nutrition.ts` é a única definição da margem da meta,
  partilhada por `dayResult` e pelo relatório semanal.
- `setWeeklyReport` revalida `/conta` depois de gravar.

### Relatório semanal: opt-in — 2026-09-07

Por indicação do utilizador, o email semanal passou a **opt-in**. Migração 0007:
`users.weekly_report_enabled` muda de `DEFAULT true` para `DEFAULT false` (via
`ALTER COLUMN`, suportado pelo libSQL) e um `UPDATE` desliga as contas
existentes — a coluna tinha nascido a `true` na 0005, do mesmo PR ainda não
lançado, portanto nenhuma conta chegou a consentir o envio. O cron continua a
filtrar `weekly_report_enabled = true`, logo passa a não enviar nada até alguém
ativar em `/conta`. A página `/relatorios` não é afetada: o resumo no ecrã está
sempre disponível. E2E cobre o ciclo completo (nasce desligado → ativar →
persistir → desativar).

### CodeQL `js/insufficient-password-hash` — falso positivo

O alerta aponta `src/lib/email-tokens.ts` (`createHash("sha256")`) com origem
declarada numa chamada de teste que passa o literal `"password_reset"` como
`purpose`. Não há palavra-passe nenhuma nesse caminho: o valor com hash é o
token de 32 bytes gerado por `randomBytes` no próprio `createEmailToken`, e as
palavras-passe reais usam bcrypt em `src/lib/auth.ts`.

A remediação sugerida pela regra (bcrypt/scrypt/argon2) é inaplicável por duas
razões: um token de 256 bits não tem entropia baixa que justifique hashing
lento, e esses algoritmos salgam cada digest, o que tornaria impossível a
pesquisa por hash (`eq(emailTokens.tokenHash, …)`) de que o consumo do token
depende. SHA-256 sobre um token aleatório de alta entropia é a prática
recomendada. A justificação está também em comentário no próprio módulo.

### Bloqueadores da revisão do PR #38 — 2026-09-07

Corrigidos os achados que a ronda automática do `--fix` não cobriu (fez uma
revisão nova, de qualidade, em vez de retomar a lista da primeira):

1. **`APP_URL` entra em `isEmailConfigured()`.** As três variáveis são um só
   interruptor. Meio configurado armava a barreira de verificação em
   `getCurrentUser` **e** enviava links sem host — lockout de todas as contas
   sem via de recuperação. Documentado também no `.env.example`.
2. **`console.log("[LOGIN-DEBUG]", email)` removido** de `login/actions.ts`.
   Escrevia o email de cada tentativa nos logs do servidor, antes até do rate
   limit.
3. **A página de login mostra todos os desfechos**: `?ok=repor`, `?verificar=1`
   (registo com email ativo), `?verificar=0` (conta criada mas envio falhou),
   `?verificado=1` e `?verificado=0` (link expirado, em tom de aviso). Antes o
   `flag()` só aceitava `=== "1"` e desconhecia `verificar`, portanto reset e
   registo acabavam num ecrã de login mudo.
4. **Mudar de email já não tranca a conta.** Com provider configurado o
   endereço **não** muda no `/conta`: cria-se um token ligado ao novo endereço
   e a troca acontece em `/verificar`, ao consumir o token. O email atual
   continua válido entretanto, e um erro de escrita deixa de ser irrecuperável.
   `/verificar` recusa a troca se outra conta tiver entretanto reclamado o
   endereço. Sem provider mantém-se a troca imediata.
5. **`sendEmail` deixou de ser ignorado.** Login, registo e mudança de email
   distinguem entregue de não entregue em vez de prometerem um email que a
   Resend recusou.
6. **Login em conta não verificada revoga os tokens anteriores** antes de criar
   o novo, em transação: uma tentativa deixa de acumular uma linha e um envio.
7. **Registo tem balde próprio, só por IP** (`registo:<ip>`). Com `ip:email` não
   limitava nada (bastava variar o email) e o caminho "email duplicado" queimava
   o balde de *login* da conta visada. Um registo bem-sucedido também conta.
8. **HEIC:** a deteção passa a olhar para a extensão antes do gate de MIME
   (Chrome devolve `type` vazio para `.heic`), e só uma falha de *descodificação*
   produz a mensagem do Safari — um ficheiro grande demais mantém a sua própria
   mensagem. Erros de decode passam a pt-PT, portanto nenhum `DOMException` em
   inglês chega à UI.
9. **`/relatorios` colore o peso com `deltaTone`** e o `goal` de `BODY_FIELDS`
   (`neutral`), em vez de pintar qualquer perda de verde.
10. **Email semanal com URL absoluto** (`appUrl()`), `maxDuration` no cron, e
    `<main>` aninhado removido de `/conta` e `/relatorios` (o layout já fornece um).

E2E novo: mudança de email com palavra-passe errada recusada, troca aplicada, o
email antigo deixa de autenticar e o novo passa a autenticar. 35 E2E e 122
unitários verdes.

**Por corrigir** (reportado, fora deste âmbito): o rollback de `/repor`
des-consome o token, que fica replayable até expirar; e `getCalorieData` carrega
o catálogo inteiro de produtos que o relatório nunca lê.

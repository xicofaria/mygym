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

Revisão pré-merge: a resolução no catálogo passou a partilhar um orçamento
total de ~125 s com a análise (prazo único da IA entre tentativas, pesquisa de
código/texto limitada ao tempo restante), «Remover fotografia» já não apaga a
origem importada, a deduplicação é por código de produto (embalagens 200 g e
300 g do mesmo nome permanecem distintas) e a lista mostra fotografia e peso de
embalagem. A expressão «valores oficiais» foi removida: uma correspondência no
catálogo não comprova o rótulo atual.

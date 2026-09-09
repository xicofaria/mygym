# Melhorias pendentes

Revisto em 2026-09-09 contra o código atual. Esta lista orienta trabalho futuro;
não significa que as melhorias estejam implementadas ou que tenham sido medidas
em produção. O comportamento disponível está no [README](../README.md).

Medidas decimais e catálogo base só de leitura com adições privadas foram
implementados; contratos e migração estão em [DOMAIN_RULES.md](DOMAIN_RULES.md).
A entrada dos dois fluxos de IA passou a ser o cartão partilhado `AIPhotoPrompt`
([arquitetura](ARCHITECTURE.md)); cancelar deixou de apagar a fotografia e uma
fotografia nova passou a descartar a análise anterior.

## Próximas alterações

Revisto contra o código em 2026-09-09. Prioridade 1 a 3 é trabalho pequeno e
independente; 4 a 6 exigem decisão de desenho ou migração antes de começar.

| Prioridade | Melhoria e evidência atual | Critério de conclusão |
| --- | --- | --- |
| 1 | **Relatórios com consultas específicas.** `getWeeklyReportData()` (`src/lib/queries.ts:693`) chama `getCalorieData()`, que carrega todo o catálogo ativo sem filtro de data e corre `productSchema.parse` por produto (`src/lib/calorie-queries.ts:17-78`); o relatório só usa `entries`/`goals`/`days` (`queries.ts:715-727`). A leitura traz também o blob `snapshot` só para chegar a `kcal`. | Leitura dedicada que devolve `{dateKey, kcal}`, metas e dias; `/relatorios` e o cron produzem valores idênticos e deixam de ler produtos. Corrigir de passagem o limite: `lte(foodEntries.date, end)` (`calorie-queries.ts:46`) é inclusivo mas o relatório trata `toKey` como exclusivo (`weekly-report.ts:56-57`). |
| 2 | **Mensagens de falha da IA em pt-PT.** Os dois clientes fazem `await response.json()` antes de `response.ok` e mostram `e.message` cru: um 502 HTML da plataforma dá `SyntaxError` inglês, um `ZodError` dá um blob JSON, e o formulário de alimentos não pré-verifica `navigator.onLine` nem distingue timeout de falha de rede. | Corpo lido com tolerância a resposta não-JSON, `safeParse` com texto próprio, pré-verificação de ligação nos dois fluxos, e só mensagens vindas de `body.error` propagadas ao utilizador. |
| 3 | **Custo de IA visível antes de gastar.** `src/lib/ai-quota.ts:21-30` já obtém `attempts` no `.returning()` mas devolve `boolean`; nenhuma rota o expõe. As 20 tentativas diárias são partilhadas entre máquinas, alimentos e peso por unidade, e nenhuma das três UIs o diz — o limite só aparece depois de gasta a chamada (`api/exercises/recognize/route.ts:82-90`, `api/calories/recognize/route.ts:38-44`). | As rotas devolvem as tentativas restantes e o cartão de IA mostra-as antes do botão de analisar, dizendo que a quota é partilhada. Sem expor contagens de outra conta. |
| 4 | **Limitar o cálculo de `previousBests`.** `src/lib/queries.ts:664-681` lê todas as séries históricas da conta (`lt(workouts.date, from)`, sem janela) com dois joins e agrega em JS (`:698-707`), em cada render de `/relatorios` e por conta no cron. | Máximo de 1RM por exercício resolvido em SQL, ou janela histórica explícita documentada em `DOMAIN_RULES.md`. Exige decidir onde vive a regra de Epley, hoje em `weekly-report.ts:77`. |
| 5 | **Envio semanal recuperável.** `src/app/api/cron/weekly-report/route.ts:43-56` envia sequencialmente, com `catch {}` vazio e sem registo por conta/semana; `sendEmail` (`src/lib/email.ts:38-51`) devolve `false` tanto em timeout como em erro, indistinguível de «talvez enviado». | Registar estado de envio, coordenar execuções concorrentes e retomar falhas; decidir antes do código o que fazer perante resposta incerta do fornecedor. Migração aditiva; testar repetição/interrupção sem emails reais. |
| 6 | **Exportação pessoal.** `src/app/privacidade/page.tsx:26-31` promete-a ao utilizador; `conta/actions.ts` não a tem e não existe `Content-Disposition` em `src/`. | Exportar treinos, medidas e diário em JSON/CSV a partir de `/conta`, apenas da sessão autenticada, com unidades/datas explícitas e snapshots preservados. Definir primeiro o formato, se as fotografias entram, e o limite para históricos extensos. Depende do item 1, cuja leitura vai reutilizar. |

Pequenas correções para agregar a um destes PR, todas verificadas no código:

- `src/lib/ai-quota.ts` nunca apaga linhas de `ai_usage` (`src/db/schema.ts:114-128`):
  falta a política de limpeza que esta lista já pedia.
- `src/app/api/calories/products/route.ts:5-12` é o único route handler
  autenticado sem `hasSameOrigin()`. Não é vulnerabilidade — GET idempotente,
  cookie `sameSite: "lax"` — mas é uma inconsistência barata de fechar.
- `food-product-form.tsx` e `diary-portion.tsx` usam `AbortSignal.any`, que exige
  Safari/iOS 17.4+; abaixo disso a análise falha com texto inglês. O fluxo de
  máquinas usa `setTimeout` manual, compatível em todo o lado.
- `food-product-form.tsx` chama `preparePhoto(file)` duas vezes (análise e
  miniatura): dois `decode()` do original, até 20 MB, no telemóvel.
- Nenhum fluxo sabe se existe chave de IA configurada: o cartão aparece sempre e
  o 503 só chega depois de escolher e analisar, apesar de o servidor já conhecer
  `getAIConfig().apiKey` e já passar `provider` às páginas.
- Sem qualquer registo no runtime (`grep console.* src` não devolve nada): erros
  são engolidos em `cron/weekly-report/route.ts:53-55`, `email.ts:49-51` e
  `calories/recognize/route.ts:61-70`. É pré-requisito prático do item 5.
- `src/lib/text-match.ts`, `openrouter-format.ts` e `weekly-report-email.ts` não
  têm testes unitários apesar de decidirem emparelhamento e formatação do email.

## Validação da experiência e operação

- **PWA e acessibilidade em dispositivos reais:** verificar iPhone/Android,
  instalação, VoiceOver/TalkBack, teclado decimal, captura de fotografias,
  rascunhos com pouca rede e comportamento ao bloquear o ecrã. Concluir com uma
  matriz de dispositivos/resultados e correções dos problemas reproduzidos.
- **IA no ginásio:** usar fotografias representativas e revistas, medir acertos,
  ambiguidades, recusas, latência e custo. Os ensaios anteriores com imagens
  públicas não estabelecem precisão no ginásio. Chamadas pagas e fotografias
  privadas exigem autorização para esse ensaio.
- **Timeout e cancelamento de calorias:** testar a rota completa com fornecedor
  lento simulado e resolução Open Food Facts, incluindo orçamento esgotado,
  cancelamento e respostas tardias. Confirmar que o formulário preserva a foto
  e os campos e que o catálogo não prolonga o prazo total indevidamente.
- **Observabilidade e retenção:** definir métricas de falhas/latência sem imagens,
  chaves ou texto pessoal; política de limpeza dos contadores de IA e alertas de
  despesa. A quota diária de tentativas não substitui limites de crédito.
- **Fotografias grandes e HEIC:** avaliar recorte e uso de memória em dispositivos
  reais. Investigar descodificação compatível com CSP nos browsers sem suporte
  nativo; conservar a alternativa manual e mensagens acionáveis.

## Limites a preservar

- O catálogo representa exercícios, não inventário de máquinas físicas.
- IA pode falhar ou estimar incorretamente; sugestões exigem revisão e confirmação.
- Open Food Facts é colaborativo e pode estar incompleto ou indisponível.
- O temporizador não promete som ou notificações com a PWA fechada.
- Cache offline não inclui dados autenticados nem fotografias privadas.

## Manutenção da lista

Cada alteração deve retirar daqui o trabalho concluído e atualizar o guia da
funcionalidade. Resultados correntes acompanham o PR/CI, conforme
[TESTING.md](TESTING.md). O [arquivo de setembro de 2026](archive/VALIDATION_2026-09.md)
conserva as experiências anteriores; pendências nesse arquivo precisam de nova
verificação antes de serem tratadas como defeitos atuais.

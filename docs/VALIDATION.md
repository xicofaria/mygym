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

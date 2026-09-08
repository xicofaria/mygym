# Instruções para agentes

## Execução e autonomia

- Concluir o pedido, incluindo implementação, documentação e validação aplicável.
  Resolver escolhas locais reversíveis com base no contexto e explicitar suposições relevantes.
- Pedir esclarecimentos quando faltar uma decisão que altere materialmente o resultado;
  continuar entretanto o trabalho independente já autorizado.
- Reutilizar autorizações da conversa. Para ações destrutivas, publicação ou alterações
  em produção sem autorização, preparar primeiro um resultado concreto para revisão.
- Respeitar instruções de sistema e do ambiente; pedidos explícitos do utilizador
  prevalecem sobre orientações de skills. Se uma skill bloquear o trabalho, identificar
  o ficheiro e a regra exata, distinguindo a regra da sua interpretação.
- Usar subagentes apenas quando pedidos pelo utilizador; atribuir tarefas independentes
  e delimitadas, com responsabilidade clara pelos ficheiros e pela revisão final.
- Comunicar em português europeu, de forma breve: resultado, validação e limitações.
  Preservar trabalho existente do utilizador e manter o objetivo ao receber correções.

## Regras gerais do projeto

- PWA para telemóvel: Next.js 16 App Router, React 19, Tailwind 4, Drizzle e libSQL.
  Texto da interface em pt-PT; pesos/medidas em kg/cm, alimentação em g/ml e kcal.
- Antes de escrever código, ler o guia relevante em `node_modules/next/dist/docs/`.
  Esta versão tem alterações incompatíveis; respeitar os avisos de descontinuação.
- Tratar Server Actions e API routes como entradas não fiáveis: validar dados,
  autenticar operações privadas, autorizar propriedade e minimizar os valores devolvidos.
  O layout protegido não protege Route Handlers. Fluxos públicos de autenticação
  validam entradas e aplicam as respetivas proteções sem exigir uma sessão prévia.
- Cada conta lê e altera os seus dados, identificada pela sessão. `?user=` é ignorado;
  não existe seletor de parceiro. Exercícios base/legados são comuns e só de leitura;
  novos exercícios (manuais ou IA) são privados. Filtrar catálogo, IA, favoritos,
  detalhes e IDs usados em treinos/modelos por base ou dono da sessão. Favoritos,
  quotas de IA, treinos, planos, rotinas, modelos, medidas e calorias são privados.
- Leituras em `src/lib/queries.ts` e módulos especializados como `calorie-queries.ts`;
  escritas nos `actions.ts` da funcionalidade. Usar transações nas escritas em vários passos.
- Datas de calendário representam meia-noite UTC; calcular o dia civil atual com
  os helpers Europe/Lisbon em `src/lib/format.ts`.
- Migrações publicadas em `drizzle/` são imutáveis e autoritativas.
  Não usar `db:push` em dados persistentes.
- Nunca versionar `.env`, bases SQLite, tokens ou credenciais reais. Manter workflows
  com permissões mínimas e actions externas fixadas a SHAs de commits.

## Consultar conforme a tarefa

Ler apenas as referências aplicáveis; os contratos da área alterada são obrigatórios.

| Área | Referência |
| --- | --- |
| Estrutura, contas, calendário, rotinas, UI | [Arquitetura](docs/ARCHITECTURE.md) |
| Treinos, decimais, séries, rascunhos, temporizador | [Contratos: Workout input](docs/DOMAIN_RULES.md#workout-input) |
| Fotografias de máquinas, fornecedores, limites e privacidade | [Contratos: Machine photo recognition](docs/DOMAIN_RULES.md#machine-photo-recognition) e [guia de IA](docs/AI_RECOGNITION.md) |
| Calorias, snapshots, conversões, fotografias e Open Food Facts | [Contratos: Calorie tracker](docs/DOMAIN_RULES.md#calorie-tracker) e [guia de calorias](docs/CALORIES.md) |
| Testes, migrações e dependências | [Regras de validação](docs/TESTING.md) |
| Entrega, segurança e recuperação | [DevSecOps](docs/DEVSECOPS.md), [segurança](SECURITY.md), [backups](docs/BACKUP_RESTORE.md) |

## Validação e entrega

- Executar `npm run check` para alterações de código e antes de commits.
  Executar `npm run test:e2e` ao alterar autenticação, treinos ou fluxos de calorias.
- E2E usa `e2e.db` descartável, sem credenciais de produção nem chaves de IA faturáveis.
- Para documentação, verificar links, comandos e `git diff --check`.
  Não criar testes redundantes; repetir verificações só se novas evidências o justificarem.
- Atualizar README, arquitetura e guias afetados quando o comportamento mudar.
  Relatar o que foi validado e qualquer bloqueio real, sem apresentar mocks como prova real.
- [Manutenção destas instruções](docs/AGENT_GUIDANCE.md) explica a adaptação ao GPT-6 Astra.

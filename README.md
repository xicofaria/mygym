# Gym Tracker

Aplicação para registar treinos, acompanhar medidas corporais e manter um diário
alimentar. Foi concebida para telemóvel e pode ser instalada como PWA.
A interface está em português europeu: pesos em kg, medidas em cm e quantidades
alimentares em g ou ml.

O registo é público. Cada conta acede apenas aos seus dados. O catálogo base de
exercícios é comum e só de leitura; exercícios adicionados manualmente ou por IA
ficam privados da conta que os cria. Não existe seletor de parceiro.

## Funcionalidades

- **Treinos:** registar, editar e repetir sessões, duplicar séries, consultar a
  última prestação e usar modelos reutilizáveis. Aceita pesos como `2,8` ou
  `2.8` kg, sem arredondar para incrementos fixos.
- **Planeamento:** calendário mensal, mapa de atividade, planos por dia e rotina
  semanal. Um plano fica concluído quando é associado explicitamente a um treino.
- **Exercícios:** pesquisa por nome, sinónimos, equipamento e grupo muscular;
  favoritos privados, histórico, volume e estimativa de 1RM.
- **Fotografias de máquinas:** análise opcional por IA, sugestões do catálogo e
  propostas de novos exercícios, sempre revistas e confirmadas pela pessoa.
- **Descanso:** temporizador com pausa e estado conservado no dispositivo ao navegar.
- **Evolução corporal:** peso, gordura corporal, IMC e perímetros, com gráficos
  e comparação por período. Aceita ponto ou vírgula nas medidas decimais, sem
  descartar campos inválidos.
- **Calorias:** diário privado, metas definidas pela pessoa, porções em g/ml,
  unidades ou frações de embalagem. O histórico conserva os dados nutricionais
  do produto e as conversões usados no momento do registo.
- **Produtos alimentares:** criação manual, fotografias privadas, leitura de
  rótulos ou estimativas identificadas por IA e pesquisa no Open Food Facts.
  A quantidade consumida exige confirmação manual.
- **Relatórios:** resumo semanal em `/relatorios`; envio por email opcional,
  ativado pela pessoa em `/conta`.
- **Contas:** registo, edição de nome/email/palavra-passe, eliminação da conta e
  recuperação/verificação por email quando o serviço está configurado.
- **Rede instável:** página offline e rascunhos locais de treinos e medidas.
  Os rascunhos só contam como registos depois de guardados no servidor;
  páginas privadas e fotografias não são colocadas na cache do service worker.

## Tecnologias

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM e
libSQL/SQLite. Desenvolvimento com base local; produção preparada para Turso
e Vercel. Gráficos com Recharts, sessões JWT com `jose` e palavras-passe com
`bcryptjs`. As versões instaláveis estão fixadas no `package-lock.json`.

## Preparação local

Usa Node.js 22 e npm, como no [workflow de CI](.github/workflows/ci.yml).
Os scripts de base de dados usam `process.loadEnvFile` para carregar o ambiente.

```bash
npm ci
cp .env.example .env.local
```

Em `.env.local`, mantém `DATABASE_URL="file:./dev.db"` para a base local e define
um `SESSION_SECRET` aleatório com pelo menos 32 caracteres. Podes gerar um com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Aplica as migrações e inicia a aplicação:

```bash
npm run db:migrate
npm run dev
```

Abre `http://localhost:3000` e cria uma conta em `/registo`.

A migração 0008 garante o catálogo base mesmo sem seed. Para criar duas contas
de desenvolvimento e repor exercícios base em falta, configura
`SEED_USER1_*` e `SEED_USER2_*` em `.env.local` e executa `npm run db:seed`.
Este passo é opcional: o seed também atualiza o nome e a palavra-passe das contas
com os mesmos emails. Não o uses como mecanismo habitual de gestão de contas;
essa gestão está em `/conta`. Substitui as credenciais de exemplo antes de usar o seed.

## Configuração

Usa [.env.example](.env.example) como referência. Guarda segredos em `.env.local`
ou no ambiente do servidor, nunca no repositório nem em variáveis `NEXT_PUBLIC_`.

### Email e contas

Configura as três variáveis em conjunto:

| Variável | Finalidade |
| --- | --- |
| `RESEND_API_KEY` | Chave do serviço de email |
| `EMAIL_FROM` | Remetente configurado no serviço |
| `APP_URL` | URL pública da aplicação, usada nos links dos emails |

Sem esta configuração completa, o registo funciona sem verificação, a recuperação
indica indisponibilidade e o cron não envia relatórios. Com email ativo, o acesso
exige verificação; uma alteração de endereço só é aplicada depois de confirmar o
novo email. Sem email ativo, a alteração é imediata após validação da palavra-passe.

O email semanal exige também `CRON_SECRET` e uma conta verificada que tenha
ativado a preferência em `/conta`; começa desativado. O [vercel.json](vercel.json)
agenda `/api/cron/weekly-report` para segunda-feira às 08:00 UTC. O relatório
no ecrã está disponível independentemente do envio de email.

`REGISTRATION_MAX_ATTEMPTS` permite ajustar o limite de registos por IP em
15 minutos: omissão 10, intervalo permitido 1–1000.

### IA opcional

O projeto utiliza **GLM 5.3 Flash através do OpenRouter** para fotografias de
máquinas e alimentos. Treinos e calorias partilham o fornecedor e a quota diária.
Para reproduzir esta configuração, define no ambiente do servidor:

```dotenv
AI_PROVIDER="openrouter"
OPENROUTER_VISION_MODEL="z-ai/glm-5.3-flash"
AI_DAILY_LIMIT="20"
```

Define também `OPENROUTER_API_KEY` como segredo do servidor. O adaptador GLM usa
modo JSON, validação no servidor e esforço `max`, com timeout de 120 segundos
no fornecedor.

Os valores de fallback em `src/lib/ai-config.ts` são distintos desta configuração:
sem `AI_PROVIDER`, o código seleciona OpenAI; sem modelo explícito, usa
`gpt-4.1-mini` para OpenAI ou `qwen/qwen3-vl-30b-a3b-instruct` para OpenRouter.
Por isso, define explicitamente as variáveis acima para usar GLM. O
`.env.example` ainda contém os exemplos genéricos desses fallbacks.
Outros modelos configurados têm de suportar visão e JSON Schema estrito.

`AI_DAILY_LIMIT` define tentativas por conta e dia de Lisboa: omissão 20,
intervalo 1–1000. Falhas também consomem tentativas; a quota não é um teto monetário.
Sem chave, a introdução manual continua disponível.

Fotografias de máquinas não são guardadas pela aplicação. Produtos alimentares
podem conservar miniaturas JPEG privadas. As estimativas exigem revisão e os
fornecedores têm as suas próprias políticas de retenção.

Consulta [fotografias de máquinas](docs/AI_RECOGNITION.md) e
[calorias](docs/CALORIES.md) para limites, privacidade e comportamento dos modelos.
Open Food Facts é uma fonte colaborativa, com atribuição, que pode estar
incompleta ou indisponível; os filtros por loja não são catálogos completos.

## Comandos e testes

| Comando | Função |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção e execução de `postbuild` |
| `npm run start` | Servir o build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificação TypeScript |
| `npm test` | Testes unitários |
| `npm run check` | Lint, tipos, testes unitários e build |
| `npm run test:e2e` | Testes de browser Playwright |
| `npm run db:migrate` | Verificar o histórico e aplicar migrações pendentes |
| `npm run db:generate` | Gerar uma migração após alterar o schema |
| `npm run db:seed` | Carregar exercícios e criar/atualizar duas contas configuradas |
| `npm run db:studio` | Explorar a base com Drizzle Studio |
| `npm run db:push` | Sincronizar apenas uma base descartável de prototipagem |
| `npm run db:reset` | Apagar `dev.db`, migrar e executar o seed; apenas para desenvolvimento local |
| `npm run backup:verify -- backup.sql` | Restaurar e verificar um dump numa base temporária |

Antes do primeiro E2E, instala Chromium com `npx playwright install chromium`.
O Playwright recria `e2e.db`, limpa as credenciais de base remota e as chaves de IA,
e constrói a aplicação para os testes. Não valida a precisão real dos modelos.

As verificações exigidas por tipo de alteração estão em
[CONTRIBUTING.md](CONTRIBUTING.md) e [TESTING.md](docs/TESTING.md).
Resultados correntes ficam no PR/CI; não é necessário manter um diário de testes.

## Publicação e base de dados

A configuração do repositório prepara a aplicação para Vercel e Turso:

1. Define `DATABASE_URL` com o URL `libsql://` de produção,
   `DATABASE_AUTH_TOKEN` e um `SESSION_SECRET` próprio de produção.
2. Configura email, cron e IA conforme as funcionalidades pretendidas.
3. Mantém `npm run build` como comando de build e disponibiliza os marcadores
   de ambiente Vercel ao processo.
4. O `postbuild` aplica migrações verificadas apenas quando `VERCEL=1` e
   `VERCEL_ENV=production`. Builds locais normais e de preview saltam esse passo.

Executa `npm run db:migrate` ao atualizar instalações geridas fora deste processo.
A migração 0008 preserva os exercícios antigos como comuns e só de leitura, pois
não existe registo do seu autor; os novos recebem o dono da sessão. IDs, séries
e ligações históricas mantêm-se.

Todas as migrações publicadas em `drizzle/` são imutáveis; `db:push` não substitui
migrações em bases persistentes. O seed não é necessário para abrir o registo público.

Um build local com marcadores e credenciais de produção pode alterar essa base.
Consulta [DevSecOps](docs/DEVSECOPS.md) para o processo de entrega e o workflow de
recuperação, e [backup/restauro](docs/BACKUP_RESTORE.md) antes de intervir em dados reais.

## Documentação

- [Contribuir](CONTRIBUTING.md) e [segurança](SECURITY.md).
- [Arquitetura](docs/ARCHITECTURE.md) e [contratos das funcionalidades](docs/DOMAIN_RULES.md).
- [Calorias](docs/CALORIES.md) e [reconhecimento de máquinas](docs/AI_RECOGNITION.md).
- [Regras dos agentes](AGENTS.md) e [manutenção das instruções](docs/AGENT_GUIDANCE.md).
- [Melhorias pendentes](docs/IMPROVEMENTS.md), com prioridades e critérios de conclusão.

As experiências e validações de setembro de 2026 estão no
[arquivo histórico](docs/archive/VALIDATION_2026-09.md); não representam o estado
atual do CI nem instruções para executar testes.

# Identificar máquinas por fotografia

## Configuração

As chaves ficam apenas no servidor: `.env.local` em desenvolvimento ou
variáveis secretas do alojamento em produção. Nunca usar `NEXT_PUBLIC_`.
Reiniciar/redeploy após alterações. Sem chave, a seleção manual continua disponível.

### OpenRouter com GLM 5.3 Flash (configuração utilizada)

```dotenv
AI_PROVIDER="openrouter"
OPENROUTER_API_KEY="a-chave-fica-apenas-no-servidor"
OPENROUTER_VISION_MODEL="z-ai/glm-5.3-flash"
AI_DAILY_LIMIT="20"
```

O projeto utiliza GLM explicitamente através destas variáveis. O fallback do
código para OpenRouter, quando `OPENROUTER_VISION_MODEL` está vazio, continua a
ser `qwen/qwen3-vl-30b-a3b-instruct`; não seleciona GLM automaticamente.

`z-ai/glm-5.3-flash` usa `json_object`, com schema incluído nas instruções e
validação dos resultados no servidor, tanto para máquinas como para alimentos.
Outros modelos são configuráveis, mas têm de aceitar imagens e JSON Schema.
Testes simulados não garantem latência ou precisão com fotografias reais.
O GLM usa esforço `max` solicitado pelo utilizador: timeout servidor 120 s,
browser 130 s, `maxDuration=150`, saída até 4000 tokens para máquinas / 8000 para
alimentos. Outros modelos mantêm 25 s no fornecedor. O estado de espera mostra
tempo real decorrido, sem percentagens fictícias; cancelar não garante estorno.
Confirmar [duração suportada pela Vercel](https://vercel.com/docs/functions/configuring-functions/duration)
no projeto (Fluid Compute ou plano compatível).

A integração usa [imagens em Chat Completions](https://openrouter.ai/docs/guides/overview/multimodal/image-understanding)
e [Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs).
Pede `require_parameters: true` e `data_collection: "deny"` no
[routing do fornecedor](https://openrouter.ai/docs/guides/routing/provider-selection).
Se não existir endpoint compatível com estas condições, apresenta erro e mantém
a seleção manual. Não relaxa silenciosamente os requisitos nem muda de modelo.

### OpenAI (alternativa; fallback sem AI_PROVIDER)

```dotenv
AI_PROVIDER="openai"
OPENAI_API_KEY="a-chave-fica-apenas-no-servidor"
OPENAI_VISION_MODEL="gpt-4.1-mini"
AI_DAILY_LIMIT="20"
```

Usa [Responses com imagens](https://developers.openai.com/api/docs/guides/images-vision)
e [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
com `store: false`. Só a chave do fornecedor selecionado é usada.

### Base de dados e orçamento

Aplicar `npm run db:migrate` antes de iniciar esta versão. Fazer backup antes
de migrar dados reais. A migração 0002 acrescenta sinónimos/equipamento,
favoritos e `ai_usage`, preservando IDs, séries, pesos e ligações dos planos.
A execução em produção deve seguir o fluxo de migração já documentado no README;
não correr seed sobre produção para obter estes campos.

`AI_DAILY_LIMIT` aceita 1–1000, por defeito 20 tentativas por conta/dia em Lisboa.
Uma reserva atómica na base partilhada ocorre antes da chamada à IA, incluindo
pedidos concorrentes entre instâncias. Falhas/timeouts também consomem tentativas;
uploads inválidos e falta de chave não. Uma configuração inválida impede a análise,
mas não bloqueia o formulário manual. Os contadores antigos não são apagados
automaticamente.

A quota limita tentativas, não euros. Configurar também um teto de créditos no
fornecedor e acompanhar despesa/latência. Existe ainda um limite em memória de
10 pedidos/minuto/conta/instância; manter proteção de tráfego no alojamento.

## Experiência

A análise recebe apenas o catálogo base e os exercícios privados da conta.
Exercícios criados após confirmação ficam privados e só o dono pode editá-los.

1. Em Novo treino ou Editar treino, escolher Tirar fotografia ou Escolher imagem.
2. Enquadrar a máquina completa e, se possível, a placa. Evitar pessoas.
3. Rever a imagem. Só Analisar fotografia envia a imagem ao servidor/fornecedor.
4. Rever até três exercícios existentes, ou uma indicação de ausência de correspondência.
5. Confirmar: preenche a primeira série totalmente vazia ou acrescenta uma nova.
   As séries preenchidas são preservadas.
6. Preencher peso/repetições manualmente e guardar normalmente.

Uma máquina multifunções pode corresponder a vários exercícios. A confiança é uma
estimativa, não uma probabilidade medida. A IA nunca estima cargas.

### Proposta de exercício novo

Quando o equipamento não corresponde a nada do catálogo, a mesma análise devolve
uma proposta (nome, grupo muscular, aliases, equipamento) que aparece como
«Criar «…»». Confirmar abre um formulário pré-preenchido e editável; só
«Criar e adicionar à série» escreve no catálogo privado da conta autenticada e o
exercício entra logo na primeira série vazia. Se a proposta coincidir
fortemente (≥0.8) com um nome/alias existente, o servidor converte-a num
candidato do exercício existente em vez de oferecer criação. Equipamento
inválido degrada para desconhecido; propostas sem nome são descartadas. A IA
nunca cria nada sem o clique do utilizador e nunca estima cargas.

## Experiência real (2026-09-07)

Sete fotografias públicas (Wikimedia Commons): quatro máquinas ausentes do
catálogo e três correspondentes. Uma chamada combinada (identificação +
proposta) em OpenRouter:

- `z-ai/glm-5.3-flash`: 7/7 utilizáveis — 2 propostas de criação corretas
  («Hiperextensão lombar»/Lombar/Máquina, «Abertura de peito na máquina
  (Pec Deck)»/Peito/Máquina), máquinas multiuso com candidatos plausíveis e
  3/3 correspondências certas; JSON 7/7; ~2,3 s; 0,0027 USD no total.
- `qwen/qwen3-vl-30b-a3b-instruct`: 3 identificações erradas (pec deck como
  «Lat Pulldown» com confiança high; máquina de press de peito como prensa de
  pernas) e propostas em falta; custo +35%.

A experiência usou fotos de internet, não máquinas do ginásio; continua por
validar com equipamento real. Os testes automáticos continuam sem chaves.

## Privacidade e limites

- Originais JPEG/PNG/WebP até 20 MB; HEIC ainda não suportado.
- Re-encode no navegador: JPEG até 1 MiB, lado máximo 1280 px, sem EXIF original.
- Verificação de MIME, assinatura e tamanho real do stream no servidor.
- Sessão e Origin obrigatórios; catálogo server-side limitado a 500 exercícios.
  IDs inventados/duplicados e respostas truncadas, recusadas ou inválidas são rejeitados.
- Timeout de 25 s no fornecedor (GLM: 120 s) e 130 s no cliente, sem retries
  automáticos da app.
- A app não guarda fotos/resultados em disco, DB, logs ou rascunhos; guarda apenas
  contagem por conta/dia. Object URLs são revogados e respostas usam no-store.
- Envia apenas fotografia e catálogo (ID/nome/grupo/sinónimos/equipamento), não
  histórico de treino, preferências ou dados da conta.
- O texto antes do envio identifica OpenAI ou OpenRouter + fornecedor executor.
  Estas opções de API não garantem, por si só, ausência de retenção operacional.
  Rever as políticas da conta OpenRouter/fornecedor e de
  [dados da API OpenAI](https://developers.openai.com/api/docs/guides/your-data).
- A captura nativa depende do telemóvel/browser; o seletor de ficheiros é a alternativa.

## Validação

Testes offline cobrem ambos os adaptadores, uploads, JSON Schema/IDs, erros,
configuração e concorrência da quota. E2E limpa ambas as chaves e simula a IA,
mas descodifica/re-encode imagens no browser e verifica confirmação e fallback.

Antes de ativar, testar fotografias reais de Leg Press, Lat Pulldown, uma polia
multifunções, uma foto desfocada e equipamento ausente do catálogo. Confirmar
captura no iPhone/Android/PWA, correspondências, custo e latência.
A precisão visual real ainda não foi medida: falta uma chave e fotografias do ginásio.

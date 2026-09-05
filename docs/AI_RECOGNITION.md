# Identificar máquinas por fotografia

## Configuração

As chaves ficam apenas no servidor: `.env.local` em desenvolvimento ou
variáveis secretas do alojamento em produção. Nunca usar `NEXT_PUBLIC_`.
Reiniciar/redeploy após alterações. Sem chave, a seleção manual continua disponível.

### OpenRouter com Qwen (modelo chinês com visão)

```dotenv
AI_PROVIDER="openrouter"
OPENROUTER_API_KEY="a-chave-fica-apenas-no-servidor"
OPENROUTER_VISION_MODEL="qwen/qwen3-vl-30b-a3b-instruct"
AI_DAILY_LIMIT="20"
```

O modelo predefinido tem entrada de imagem e endpoints com respostas estruturadas
no catálogo OpenRouter verificado em 2026-09-05. A disponibilidade depende do
fornecedor/conta. Outros modelos são configuráveis, mas têm de aceitar imagens
e JSON Schema; um modelo exclusivamente textual não serve.

A integração usa [imagens em Chat Completions](https://openrouter.ai/docs/guides/overview/multimodal/image-understanding)
e [Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs).
Pede `require_parameters: true` e `data_collection: "deny"` no
[routing do fornecedor](https://openrouter.ai/docs/guides/routing/provider-selection).
Se não existir endpoint compatível com estas condições, apresenta erro e mantém
a seleção manual. Não relaxa silenciosamente os requisitos nem muda de modelo.

### OpenAI (alternativa/predefinição)

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

1. Em Novo treino ou Editar treino, escolher Tirar fotografia ou Escolher imagem.
2. Enquadrar a máquina completa e, se possível, a placa. Evitar pessoas.
3. Rever a imagem. Só Analisar fotografia envia a imagem ao servidor/fornecedor.
4. Rever até três exercícios existentes, ou uma indicação de ausência de correspondência.
5. Confirmar: preenche a primeira série totalmente vazia ou acrescenta uma nova.
   As séries preenchidas são preservadas.
6. Preencher peso/repetições manualmente e guardar normalmente.

Uma máquina multifunções pode corresponder a vários exercícios. A confiança é uma
estimativa, não uma probabilidade medida. A IA nunca cria exercícios ou estima cargas.

## Privacidade e limites

- Originais JPEG/PNG/WebP até 20 MB; HEIC ainda não suportado.
- Re-encode no navegador: JPEG até 1 MiB, lado máximo 1280 px, sem EXIF original.
- Verificação de MIME, assinatura e tamanho real do stream no servidor.
- Sessão e Origin obrigatórios; catálogo server-side limitado a 500 exercícios.
  IDs inventados/duplicados e respostas truncadas, recusadas ou inválidas são rejeitados.
- Timeout de 25 s no fornecedor e 30 s no cliente, sem retries automáticos da app.
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

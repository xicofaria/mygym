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
Cancelar aborta o pedido mas conserva a fotografia e diz que uma chamada já
enviada pode ser cobrada; só «Remover fotografia» descarta a imagem.
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

1. Em Novo treino ou Editar treino, o cartão **Não sabes o nome da máquina?**
   oferece Tirar fotografia ou Escolher imagem. O cartão é o componente
   partilhado `AIPhotoPrompt` (`src/components/ai-photo-prompt.tsx`), também
   usado na criação de produtos alimentares.
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

## Base nutricional estruturada (2026-09-18)

Duas etiquetas geradas localmente, em modo «só rótulo», com `z-ai/glm-5.3-flash`
e a chave do utilizador, autorizada e revogada a seguir:

- Tabela com colunas por 100 g e por porção de 125 g: devolveu
  `standard`/100 g/`label` e transcreveu só a coluna por 100 g (76 kcal,
  6 g de proteína, 0,1 g de sal). Não misturou colunas; ~10 s.
- Tabela só com a porção de 125 g: devolveu `serving`/125 g/`label` com os
  números dessa coluna (95 kcal), que o servidor normalizou para 76 kcal/100 g;
  ~13 s.

As duas etiquetas descrevem o mesmo produto, e ambas chegaram a 76 kcal/100 g
por caminhos diferentes. Em ambas, `packageQuantity` ficou 125 g, separado da
base nutricional, e a fibra ausente ficou `null`, não zero.

### Rótulos reais de supermercados portugueses

Seis produtos, dois por loja (Continente, Pingo Doce, Mercadona), com a
fotografia da tabela nutricional do Open Food Facts reduzida a 1280 px como o
cliente faz antes de enviar. Os valores estruturados do OFF servem de referência
independente.

| Produto | Loja | `reference` lida | Resultado |
| --- | --- | --- | --- |
| Mini Bolachas Chocolate e Cacau | Continente | `standard` 100 g | Macros iguais ao OFF; energia 422 kcal contra 415 no OFF |
| Leite Meio-Gordo AGROS | Continente | `standard` 100 **ml** | Igual ao OFF; embalagem 1000 ml |
| Tortitas de grão-de-bico | Pingo Doce | — | Recusou: a foto era a frente da embalagem, sem tabela |
| Leite UHT Meio Gordo | Pingo Doce | `standard` 100 **ml** | Igual ao OFF; embalagem 1000 ml |
| Trigo Espelta Crackers | Mercadona | `standard` 100 g | Igual ao OFF; embalagem 240 g |
| Barritas de cereais manga | Mercadona | `standard` 100 g | Diferenças de arredondamento: 347/345 kcal, 59/60 g de hidratos |

O que isto confirma: a referência estruturada chega preenchida e coerente com o
rótulo; gramas e mililitros não se confundem, com os dois leites em `ml`; o
conteúdo da embalagem fica em `packageQuantity`, separado da base, e `null`
quando não é legível; e o modo «só rótulo» recusa em vez de inventar quando a
tabela não está visível.

### Preferência determinística pela coluna dos 100 g

Rótulos declarados por porção são raros nestas lojas: numa amostra de 100
produtos por loja, o OFF regista 2 no Continente, 2 no Pingo Doce e 4 na
Mercadona. Foram testados sete desses produtos, e nenhum tinha uma tabela
apenas por porção — na União Europeia a coluna por 100 g/ml é obrigatória, e a
porção aparece como coluna adicional.

Em todos os que tinham as duas colunas, o modelo escolheu a dos 100 g e disse-o
explicitamente: «a coluna da porção de 30 g foi ignorada», «a coluna por porção
(40 g) foi ignorada por existir a base por 100 g». É a regra determinística do
prompt, confirmada em rótulos reais.

Consequência prática: o ramo `serving`/`package` serve sobretudo o
preenchimento manual e produtos sem tabela por 100. Em fotografias de produtos
embalados na UE, o caminho normal continua a ser `standard`.

### Fiabilidade e ressalvas

Em 13 chamadas com fotografias reais houve 3 falhas à primeira: duas respostas
que não passaram a validação do servidor e um timeout. Repetidas, as três
devolveram `reference` válida e valores coerentes, ou seja, é instabilidade do
fornecedor e não rejeição indevida do contrato novo. O adaptador não faz
retries automáticos: o utilizador vê o pedido para tentar outra fotografia.
Os tempos de resposta com fotografias reais foram de 13 a 62 segundos, bem
acima dos 10 a 13 segundos das etiquetas geradas.

O OFF é colaborativo e pode estar errado, por isso divergir dele não é, por si
só, erro do modelo. No leite do Pingo Doce o modelo leu 0,1 g de sal e o OFF
regista 0,00025 g, implausível para leite. Ficou por resolver o caso do Protein
Drink, em que o modelo leu 60 kcal e o OFF aponta 84,3 kcal por 100: sem ver o
rótulo original não é possível dizer quem está certo. A imagem marcada como
«nutrition» no OFF nem sempre mostra a tabela, como nas tortitas do Pingo Doce.

Este exercício não mede a precisão em fotografias tiradas pelo utilizador, com
reflexos, dobras, ângulo ou pouca luz: as imagens do OFF são enquadradas e
legíveis.

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
- O texto antes do envio identifica OpenAI ou OpenRouter + fornecedor executor,
  e diz que seguem também os nomes do catálogo da conta, não só a imagem.
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

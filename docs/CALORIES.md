# Calorias — diário alimentar

## Funcionalidade

A nova tab **Calorias** tem três áreas:

- **Diário:** data, energia consumida/meta, proteína/hidratos/lípidos, refeições,
  quantidade em g ou ml, editar/eliminar consumos e concluir/reabrir o dia.
- **Produtos:** catálogo privado, nome/marca, valores nutricionais, fotografia,
  criação/edição/arquivo, pesquisa local e consulta externa por código de barras
  ou amostras de produtos associados ao Continente, Lidl, Pingo Doce, Mercadona e Aldi em Portugal.
- **Evolução:** dia, semana (segunda–domingo) e mês civil; kcal registadas,
  média dos dias com registos, dias concluídos, dias dentro da meta e dias em falta.

Nutrientes: kcal, proteína, hidratos de carbono, lípidos, saturados, açúcares,
fibra e sal. Campos desconhecidos mantêm-se desconhecidos; totais parciais são
identificados. Não confundir zero com ausência de informação.

## Metas e cálculos

- A pessoa define a sua meta calórica e uma margem percentual (0–30%).
  A app não calcula necessidades energéticas nem recomenda uma dieta.
- Uma meta alterada entra em vigor no dia atual em Lisboa. Não reescreve dias
  anteriores. Antes da primeira meta, os dias apresentam “Sem meta”.
- Só dias explicitamente concluídos e dentro do intervalo contam como cumpridos.
  Um dia sem refeições não é um sucesso; ingerir abaixo da margem também não.
- Alterar/eliminar um consumo reabre o respetivo dia. Dias futuros não entram
  nas estatísticas. A média informa que pode incluir registos parciais.
- Valores guardados por 100 g **ou** 100 ml. Consumo = valor × quantidade / 100.
  Não se faz conversão implícita entre g e ml. Aceita vírgula ou ponto decimal.
- Cada consumo contém uma cópia dos valores do produto. Alterar o catálogo
  não modifica o histórico. Ao editar a quantidade do mesmo produto, usa-se a
  cópia histórica. Para aplicar um rótulo corrigido a um consumo anterior,
  eliminar esse consumo e registá-lo novamente é uma escolha explícita.

## Fotografia e IA

Reutiliza `AI_PROVIDER`, as chaves/modelos OpenAI ou OpenRouter e a quota diária
partilhada com identificação de máquinas. Não requer outra chave.

1. Criar produto e tirar/escolher fotografia.
2. Usar **Preencher com IA (permite estimativas)** (predefinido) ou **Só valores legíveis do rótulo**.
3. Rever o aviso do fornecedor e carregar em Analisar alimento.
4. Rever os campos sugeridos, corrigir se necessário e confirmar a caixa de revisão.
5. Guardar o produto e indicar no diário a quantidade efetivamente consumida.

O modo rótulo pede apenas dados legíveis e admite ausência de correspondência.
Se a foto só mostrar a frente da embalagem, pode pedir uma foto da tabela.
O modo estimativa é explicitamente aproximado: a imagem não revela, de forma
fiável, quantidade, receita, óleos adicionados ou preparação. As estimativas
permanecem identificadas no diário. Nunca guardar automaticamente sugestões.

### Tabela, embalagem e quantidade consumida

- Um único seletor de fotografia abre as opções disponibilizadas pelo sistema;
  câmara/galeria dependem do browser e dispositivo. Não se promete captura nativa no desktop.
- A tabela tem gorduras (lípidos), saturados, proteína, hidratos, açúcares, fibra e
  sal em gramas, e energia em kcal. Cada campo estimado tem um aviso próprio.
- O prompt lê primeiro os dados visíveis, normaliza porções legíveis para 100,
  converte kJ e preenche os restantes nutrientes por estimativa quando há base para
  isso. Não inventa zeros nem resolve macros desconhecidos por subtração das kcal.
- Conteúdo da embalagem e peso de uma unidade são detalhes de conversão no diário,
  não campos pedidos ao criar/editar um produto. Unidades e Embalagens estão
  sempre disponíveis, mesmo nos produtos antigos sem esses pesos.
  A IA pode sugerir valores com indícios suficientes, sempre marcados se estimados;
  uma embalagem sem escala/peso/formato identificável fica com peso desconhecido.
- No diário pode-se indicar g/ml, unidades (ex.: 20 amendoins) ou embalagens (ex.:
  0,5). A conversão usa os pesos revistos do produto e mostra kcal e nutrientes
  antes de guardar. Pesar é mais preciso do que usar um peso médio por unidade.
- Quando falta peso de uma unidade, a ação explícita **Estimar peso por unidade
  com IA** usa apenas nome, marca e tabela desse produto, obtidos no servidor
  para a conta autenticada. Não envia fotografia nem refeições do diário.
  Respeita fornecedor/modelo/quota existentes e pode devolver desconhecido.
- É possível ajustar o peso diretamente no diário, distinguindo pesado de
  aproximado. Só ao registar o consumo se guarda a conversão para reutilizar.
  Cancelar/simular uma quantidade não altera produtos. O servidor recalcula a
  quantidade efetiva; editar um consumo não reescreve outros nem o catálogo.
- O histórico mantém os pesos e nutrientes originais. A indicação aproximada de
  unidades no histórico é calculada desse peso médio, não uma contagem por visão.
  Ao editar explicitamente a conversão de um consumo, apenas esse registo muda;
  os nutrientes por 100 g/ml continuam a ser os do snapshot original.
- `OPENROUTER_VISION_MODEL=z-ai/glm-5.3-flash` tem um adaptador JSON explícito
  com validação Zod no servidor. A [ficha OpenRouter](https://openrouter.ai/z-ai/glm-5.3-flash)
  consultada em 2026-09-06 anuncia visão e JSON sem enforcement de JSON Schema.
  Os outros modelos mantêm o contrato estrito anterior. Os testes automáticos não
  usam chaves; houve um teste real separado, autorizado, descrito em VALIDATION.md.
- O GLM usa `reasoning.effort=max`, orçamento de saída de 8000 tokens para alimentos
  e timeout de 120 s. O browser aguarda até 130 s e a rota permite 150 s.
  O estado de espera tem tempo decorrido, animação respeitando movimento reduzido
  e cancelamento; não representa percentagens nem expõe o raciocínio do modelo.
  Cancelar conserva foto/campos, mas uma chamada já enviada pode ser cobrada.
  Vercel deve permitir esta duração (Fluid Compute ou plano compatível).

## Fotografias privadas

- Originais JPEG/PNG/WebP até 20 MB. HEIC ainda não é suportado.
- A imagem para análise tem até 1280 px / 1 MiB. A miniatura guardada tem até
  512 px / 140 KB no browser, com limite servidor de 160 KB descodificados.
- O re-encode remove EXIF. Ao guardar o produto, a miniatura JPEG fica na DB
  privada; não é publicada no Open Food Facts nem numa loja.
- A rota `/api/calories/photos/[id]` exige a conta proprietária e usa no-store.
  A outra conta não tem acesso. O service worker não guarda estas rotas.
- Remover fotografia e guardar apaga-a do produto; arquivar o produto também
  apaga a fotografia guardada. Cópias de segurança seguem a retenção da DB.
- Imagens provenientes do Open Food Facts mantêm URL e atribuição, sem download
  pela app; o browser contacta images.openfoodfacts.org ao apresentá-las.

Guardar pequenas miniaturas na DB evita exigir uma conta de armazenamento extra
para esta app privada de duas pessoas. Para grande volume de fotografias, migrar
para object storage privado, com URLs temporários e política de retenção.

## Pesquisa e fontes

Foram consultadas fontes primárias em 2026-09-05:

- [Continente: leitura do semáforo e bases por porção/100 g/ml](https://missao.continente.pt/alimentacao/semaforo-nutricional).
- [Lidl: rotulagem e alimentação consciente](https://institucional.lidl.pt/sustentabilidade/promover-a-saude/alimentacao-consciente).
- [Open Food Facts: API, limites e uso](https://openfoodfacts.github.io/openfoodfacts-server/api/).
- [Consulta de produto por código](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v2/products/get-product-by-code/).
- [Pesquisa por tags de loja/país](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v2/search/get-search/).
- [Licenças dos dados e fotografias](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/).
- [Visão na API OpenAI](https://developers.openai.com/api/docs/guides/images-vision).

A integração escolhe Open Food Facts para produtos reais com origem identificável,
em vez de copiar indiscriminadamente fotografias das lojas. Não é um catálogo
oficial/completo/atualizado destas cinco lojas. Os nomes, unidades, receitas e
rótulos devem ser confirmados na embalagem. As amostras de loja não são pesquisa
integral: o código de barras é a identificação mais específica implementada.

Dados Open Food Facts: ODbL; fotografias: CC BY-SA, com links de origem na UI.
O adaptador descarta produtos sem kcal válidas, conserva nutrientes em falta,
converte kJ em kcal quando necessário e admite que os resultados possam estar
desatualizados. Consulta apenas hosts fixos, com User-Agent identificável e timeout.
Limite local: 4 consultas por minuto/conta. Não há chamadas externas a cada tecla.

**Verificação real:** a consulta pública de teste devolveu HTTP 503 / página
temporariamente indisponível do Open Food Facts. O fallback manual foi mantido.
Não se afirma que os testes simulados validam disponibilidade real, imagens atuais
das lojas ou a precisão visual da IA.

## Migração e validação

Aplicar `npm run db:migrate` antes de iniciar a versão. A migração 0003 acrescenta
`food_products`, `food_entries`, `calorie_goals` e `food_days`, sem alterar tabelas
de treino ou apagar dados. Fazer backup antes de migrar produção; não correr seed
para obter a funcionalidade.

A migração aditiva 0004 acrescenta `food_products.details` com default vazio;
produtos e snapshots antigos continuam válidos. O hook de produção já existente
no projeto aplica migrações no deploy Vercel de produção; esta tarefa não faz deploy.

- Unitários: porções decimais, valores desconhecidos, metas históricas, margens,
  semanas/meses, fontes/URLs e ambos os adaptadores de IA.
- E2E: diário e metas, snapshots imutáveis, fotos privadas, separação entre contas,
  edição/eliminação, períodos, confirmação de IA/importação e chave ausente.
- Testes de IA e catálogo externo usam mocks e não têm custos de inferência.
- O teste real com chave temporária confirmou um rótulo sintético e uma estimativa,
  não precisão geral. Falta validar fotografias representativas, captura nativa
  iPhone/Android/PWA e disponibilidade do Open Food Facts no alojamento.

O formulário mantém os campos se uma gravação falhar enquanto estiver aberto.
Esta versão não promete fila de gravação offline nem rascunhos nutricionais
persistentes depois de fechar/navegar: não confundir com os rascunhos de treino.

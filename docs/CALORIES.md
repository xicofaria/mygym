# Calorias — diário alimentar

## Funcionalidade

A nova tab **Calorias** tem três áreas:

- **Diário:** data, energia consumida/meta, proteína/hidratos/lípidos, refeições,
  quantidade em g ou ml, editar/eliminar consumos e concluir/reabrir o dia.
- **Produtos:** catálogo privado, nome/marca, valores nutricionais, fotografia,
  criação/edição/arquivo, pesquisa local e consulta externa por código de barras
  ou amostras de produtos associados ao Continente/Lidl em Portugal.
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
2. Escolher **Ler rótulo nutricional** (predefinido) ou **Estimar alimento**.
3. Rever o aviso do fornecedor e carregar em Analisar alimento.
4. Rever os campos sugeridos, corrigir se necessário e confirmar a caixa de revisão.
5. Guardar o produto e indicar no diário a quantidade efetivamente consumida.

O modo rótulo pede apenas dados legíveis e admite ausência de correspondência.
Se a foto só mostrar a frente da embalagem, pode pedir uma foto da tabela.
O modo estimativa é explicitamente aproximado: a imagem não revela, de forma
fiável, quantidade, receita, óleos adicionados ou preparação. As estimativas
permanecem identificadas no diário. Nunca guardar automaticamente sugestões.

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
oficial/completo/atualizado do Continente ou Lidl. Os nomes, unidades, receitas e
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

- Unitários: porções decimais, valores desconhecidos, metas históricas, margens,
  semanas/meses, fontes/URLs e ambos os adaptadores de IA.
- E2E: diário e metas, snapshots imutáveis, fotos privadas, separação entre contas,
  edição/eliminação, períodos, confirmação de IA/importação e chave ausente.
- Testes de IA e catálogo externo usam mocks e não têm custos de inferência.
- Falta validar com fotografias representativas e chave real, captura nativa
  iPhone/Android/PWA e disponibilidade do Open Food Facts no alojamento.

O formulário mantém os campos se uma gravação falhar enquanto estiver aberto.
Esta versão não promete fila de gravação offline nem rascunhos nutricionais
persistentes depois de fechar/navegar: não confundir com os rascunhos de treino.

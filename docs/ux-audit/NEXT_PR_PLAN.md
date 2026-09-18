# Próximo PR — registo alimentar e base nutricional explícita

Estado: plano autorizado e implementado na branch `feat/calorie-reference-ux`.
Consultar [implementação e validação](IMPLEMENTATION.md) para o estado da entrega.

## Objetivo e âmbito

Permitir copiar os valores tal como aparecem no rótulo, incluindo porções e embalagens, sem fazer contas. A IA propõe a base identificada e o utilizador confirma antes de guardar. O diário continua a perguntar quanto foi efetivamente consumido.

Este plano inclui o lote de UX alimentar discutido: organização de Produtos, contexto após guardar (UX-28), conclusão do dia (UX-27) e repetição de alimentos (UX-30). Gráficos, onboarding e persistência offline ficam fora deste PR.

O PR anterior #46 foi integrado. Implementar numa nova branch a partir de `main`, após confirmar o estado remoto; não reutilizar o PR fechado.

## Ordem de implementação

| Ordem | Entrega | Prioridade | Esforço | Critério principal |
| --- | --- | --- | --- | --- |
| 1 | Organizar Produtos e preservar a origem do registo (UX-28) | Alta | M | CTA separado da pesquisa; guardar no catálogo mantém o catálogo; criar a partir do diário devolve à quantidade, preservando dia/refeição. |
| 2 | Base nutricional editável e conversão centralizada | Alta | L | Aceitar valores por 100 g/ml, porção, embalagem ou quantidade personalizada, sem alterar os cálculos históricos. |
| 3 | IA identifica a base e explicita suposições | Alta | M | Mostrar base, origem e valores para revisão; nenhuma conversão ambígua ou duplicada. |
| 4 | Concluir/reabrir dia junto ao resumo (UX-27) | Média | S | Ação explícita, estado visível e reabertura ao alterar consumos. |
| 5 | Repetir um consumo recente (UX-30) | Média | M | Preparar alimento, quantidade e refeição para confirmação; nunca registar automaticamente. |

As prioridades são de implementação, não novas severidades heurísticas validadas. Os esforços são relativos, não estimativas de calendário.

## 1. Produtos: entrada e continuidade

- Separar visualmente o botão «Novo produto», o campo de pesquisa e os resultados. Evitar que o label da pesquisa pareça pertencer ao botão.
- Uma entrada «Novo produto» apresenta «Preencher manualmente», «Fotografar rótulo/alimento» e «Ler ou introduzir código de barras», usando apenas capacidades já disponíveis.
- Catálogo vazio: explicar como criar o primeiro produto; pesquisa sem resultados: manter a pesquisa e oferecer criar produto. São estados distintos.
- Manter informação sobre Open Food Facts, mas subordinada ao método de importação, sem a confundir com um catálogo oficial das lojas.
- Guardar/cancelar devolve ao contexto de origem e repõe o foco. Criar um produto não equivale a registar um consumo.

## 2. Formulário nutricional

Substituir a instrução «Esta base é sempre 100 g/ml» por «Os valores abaixo correspondem a:».

| Opção | Campos apresentados | Exemplo |
| --- | --- | --- |
| 100 g / 100 ml | Unidade | Valores por 100 g |
| Uma porção | Quantidade e unidade obrigatórias; nome opcional | Uma porção de 30 g |
| Embalagem inteira | Conteúdo líquido em g/ml obrigatório | Um iogurte de 125 g |
| Outra quantidade | Quantidade e unidade obrigatórias | Valores por 50 g |

Mostrar junto aos nutrientes «Valores por uma porção de 30 g», por exemplo. A quantidade comida só é pedida no diário.

Ao mudar a base depois de preencher valores, pedir uma escolha explícita: «Manter os números e corrigir a base» ou «Converter os valores para a nova quantidade». A segunda opção só existe entre bases conhecidas da mesma unidade. Nunca converter g ↔ ml implicitamente.

Validar quantidade positiva e finita, aceitar vírgula decimal e preservar desconhecido como desconhecido, não zero. Energia continua obrigatória para guardar. Mostrar erros junto aos campos e focar o primeiro erro.

## 3. Regras da IA

| Evidência na imagem | Proposta | Comportamento |
| --- | --- | --- |
| Tabela por 100 g ou 100 ml legível | Base indicada | Transcrever a coluna correspondente. |
| Colunas por 100 e por porção | Por 100 g/ml | Preferência determinística; não misturar colunas. |
| Apenas valores por porção com massa/volume legível | Uma porção com essa quantidade | Transcrever sem converter no modelo; converter no servidor. |
| Valores explicitamente para a embalagem inteira, com conteúdo conhecido | Embalagem inteira | Não assumir que qualquer porção corresponde à embalagem. |
| Alimento reconhecido, sem base identificável, no modo estimativa | 100 g por defeito | Aviso «Base assumida: 100 g. Confirma antes de guardar»; nutrientes estimados identificados. Usar 100 ml quando a evidência sustentar uma base volumétrica. |
| Números legíveis «por porção», mas quantidade da porção desconhecida | Base por porção incompleta | Pedir quantidade ou nova foto; não reinterpretar esses números como valores por 100 g. |
| Base/energia ilegíveis no modo «Só rótulo» | Sem tabela validada | Pedir outra foto ou preenchimento manual; não inventar nutrientes. O formulário pode começar em 100 g, identificado como valor por defeito. |
| Alimento não identificável | Sem proposta nutricional | Permitir nova fotografia ou preenchimento manual. |

A base assumida não representa o peso da embalagem nem a quantidade consumida. Mostrar sempre a proposta antes de guardar; a confirmação deve incluir base e quantidade de referência. Alterar fotografia ou receber uma nova análise invalida a confirmação anterior.

Não usar apenas a explicação textual da IA como origem dos dados: base, quantidade, unidade e proveniência devem ser campos estruturados e validados. Texto nas imagens continua a ser entrada não fiável.

## 4. Contrato técnico

Situação observada: `food-recognition.ts` pede atualmente ao modelo que normalize para 100; `nutrition.ts` valida nutrientes já normalizados; `food-product-form.tsx` só apresenta 100 g/ml.

- Manter nutrientes canónicos por 100 g/ml para catálogo, cálculos e snapshots.
- Introduzir um contrato de entrada para valores na base declarada. A IA devolve valores nessa base, sem fazer a normalização. Usar uma função pura partilhada para a pré-visualização e para a conversão autoritativa no servidor: `valorPor100 = valorIntroduzido × 100 / quantidadeDeReferência`.
- Validar números brutos com limites próprios; aplicar os limites canónicos existentes apenas depois da normalização. Uma embalagem grande pode ter mais de 100 g de um nutriente sem que o valor por 100 g seja inválido.
- Guardar metadados opcionais da referência no JSON `details`: tipo, quantidade, unidade e origem (manual, lida ou assumida). Produtos antigos sem esses metadados abrem em 100 g/ml. Não criar migração SQL se a extensão compatível deste JSON for suficiente.
- Reabrir a edição na base escolhida, reconstruindo a apresentação a partir dos valores canónicos. Evitar arredondamentos sucessivos: abrir e guardar sem alterações não deve alterar os nutrientes.
- Não normalizar novamente dados já canónicos do Open Food Facts. Separar claramente os contratos de entrada e armazenamento.
- Preservar o caminho de estimativa de peso por unidade, que reutiliza atualmente `recognizeFood` com `productContext`; esta alteração não pode modificar os nutrientes desse pedido.
- Não alterar snapshots históricos quando se edita um produto. Repetir um consumo usa o snapshot original e abre confirmação; não o substitui silenciosamente pelo catálogo atual. Permitir esta cópia autenticada mesmo se o produto original estiver arquivado, sem o reativar.
- Autenticar e validar propriedade em todas as escritas e leituras privadas. Preservar limites, quotas, cancelamento, proteção das fotografias e ausência de registo automático.

Áreas previstas: `src/lib/nutrition.ts`, `src/lib/food-recognition.ts`, `src/components/food-product-form.tsx`, componentes do diário/catálogo, actions e rotas de calorias, respetivos testes. Antes de escrever código, ler o guia aplicável em `node_modules/next/dist/docs/` e confirmar os caminhos concretos.

## 5. Critérios de aceitação e testes

- 125 g / 95 kcal → 76 kcal por 100 g; consumir 125 g → 95 kcal.
- Porção de 30 g / 120 kcal → 400 kcal por 100 g; consumir duas porções → 240 kcal.
- Embalagem de 250 ml / 150 kcal → 60 kcal por 100 ml, sem conversão para gramas.
- Tabela com duas colunas usa uma só base; valores desconhecidos continuam `null` e zero explícito continua zero.
- Porção sem massa bloqueia a conversão; quantidade zero, negativa, não finita ou fora dos limites é rejeitada também no servidor.
- Estimativa sem base mostra 100 g como suposição e exige revisão; modo estrito não inventa dados.
- Produtos antigos, importação OFF, estimativa por unidade e snapshots continuam compatíveis.
- Mudar a base tem semântica explícita; guardar repetidamente sem alterações não degrada valores.
- Criar pelo catálogo e pelo diário mantém os contextos corretos; cancelar não cria produto nem consumo.
- Concluir dia é explícito; editar, eliminar ou repetir um consumo reabre o dia conforme o contrato existente.
- Repetir um consumo exige confirmação e não permite acesso a dados de outra conta.
- Testar erros e cancelamento da IA, respostas tardias e troca de fotografia sem perder alterações do utilizador.
- Validar em largura móvel e desktop: labels, foco, teclado, leitura dos erros e avisos por leitor de ecrã, estados vazio/loading/erro/sucesso. Guardar screenshots reais do resultado; testes automatizados não substituem validação visual ou com utilizadores.

Executar testes unitários focados nas conversões, contratos e regressões; depois `npm run check` e `npm run test:e2e`. E2E usa a base descartável e respostas simuladas, sem credenciais de produção nem chamadas de IA faturáveis. Identificar essas simulações no relatório de validação.

## Documentação e entrega

- Atualizar [guia de calorias](../CALORIES.md) e [contratos](../DOMAIN_RULES.md#calorie-tracker): distinguir a nova quantidade de referência nutricional do peso por unidade/quantidade consumida. Alterar explicitamente a regra atual que impede pedir pesos no formulário de produto, apenas para permitir esta referência.
- Atualizar README e arquitetura se os fluxos/contratos descritos mudarem.
- Atualizar [kanban](index.html) e [registo de implementação](IMPLEMENTATION.md), com estado real por finding e screenshots identificadas como antes/depois. Separar trabalho integrado do PR anterior de trabalho ainda por implementar.
- Título proposto: **UX calorias: base nutricional flexível, revisão da IA e continuidade do diário**.
- Descrever no PR as limitações restantes. Não afirmar melhoria de retenção ou compreensão sem dados de utilização.

Este documento conserva o plano aprovado. A implementação não inclui nome livre
opcional para a porção: a quantidade/unidade identifica a referência. Quando uma
porção legível não tem massa/volume, a IA pede essa informação ou outra foto, sem
devolver uma tabela ambígua. O peso em falta pode ser preenchido manualmente.
Não foram adicionadas migrações SQL, scanner de câmara, persistência offline nem
alterações aos gráficos. O registo de validação distingue testes reais da UI e
respostas de IA simuladas.

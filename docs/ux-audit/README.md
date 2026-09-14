# Avaliação UX — quadro Kanban

Abrir [index.html](index.html) diretamente no browser. Não precisa de servidor,
instalação nem acesso à rede. Manter a pasta `screenshots/` junto do HTML.

O quadro apresenta 31 findings, agrupados por prioridade, com filtros de área,
evidência, estado e top 5 quick wins. Abrir um cartão para consultar impacto,
heurística, correção, critério de conclusão e evidência. O estado de trabalho
é pessoal: fica no armazenamento deste browser, se disponível, e não cria
issues nem altera a aplicação. A navegação por teclado não depende de arrastar.

## Âmbito

Público confirmado: utilizadores de ginásio iniciantes e intermédios que querem
acompanhar progressão no treino e cumprimento de metas alimentares próprias.
Os gráficos existentes, acessíveis através dos exercícios, são preservados.
Durante a avaliação não foram implementadas correções na aplicação. A fase
seguinte propõe 18 correções em dois lotes no PR #46; consultar [âmbito da implementação](IMPLEMENTATION.md).
Os cartões UX-06 e UX-25 incluem capturas após a correção, separadas da evidência
original. Foram obtidas em Chromium a 390 × 844 com dados fictícios na base E2E;
não são mockups nem dados de produção.

Contexto confirmado: treino 3–5 vezes por semana e alimentação diária, em
telemóvel com interrupções e rede instável. Objetivo de retenção à 6.ª–8.ª semana.
UX-11 e UX-10 sobem de severidade 2 para 3. UX-09 mantém 3 e passa para P1.
UX-18 acrescenta a ausência de comparação explícita entre sessões, com impacto
e severidade provisórios a validar com iniciantes. O diário já apresenta kcal
até à meta; não é reportada uma ausência desse feedback.

O [segundo passe por percursos](JOURNEYS.md) acrescenta UX-19–31: primeiro acesso,
primeira medição/meta, contexto da progressão, repetição, recuperação offline
e alimentação diária. Inclui recomendações de onboarding e um plano de avaliação
com utilizadores. Não se assume que uma modal obrigatória seja a solução.

Prioridade e severidade são avaliações heurísticas, sem medições de frequência
ou testes com utilizadores. O HTML distingue factos, impactos possíveis e
limitações. A análise não certifica conformidade WCAG 2.2 AA.

## Evidências

Screenshots do browser usam uma base SQLite temporária, uma conta fictícia e
nenhuma chave de IA ou serviço de email. Não representam dados de produção.
As imagens mostram a interface sem retoques; cada cartão descreve o cenário.
Problemas assíncronos e de semântica que uma imagem não prova mantêm a referência
ao código. Quando a rede é controlada para reproduzir espera ou offline, essa
condição é indicada no cartão.

Na primeira ronda, sete imagens deram suporte a oito findings (alguns partilham
a mesma captura): UX-01/02, UX-04 (antes/depois), UX-05, UX-06, UX-09/18 e UX-11.
O segundo passe acrescenta 12 imagens, perfazendo 19 imagens para 19 findings.
Viewport das capturas: 390 × 844, tema claro, Chromium. O primeiro contexto tinha
service worker bloqueado; o segundo passe testa UX-26 com worker realmente ativo.
UX-03 não foi reproduzido. Capturas de página completa
podem mostrar os elementos fixos na posição do viewport da captura.

Reprodução observada: o produto perdeu os campos ao tocar novamente em Produtos;
a validação de proteína acima de 100 g apresentou o erro genérico; foi possível
alterar 20 kg para 25 kg durante um POST retido, e a chave do rascunho já não
existia. O pedido retido foi abortado pelo teste. O gráfico foi capturado após
guardar pela interface duas sessões fictícias (40 kg × 8 e 42,5 kg × 8).

O finding UX-06 foi afinado face ao relatório inicial: o nome vazio é normalmente
bloqueado pelo `required` nativo. O exemplo relevante é um nutriente inválido
com kcal válidas, que recebe uma mensagem genérica sem identificar o campo.

## Validação

Verificar filtros, abertura/fecho dos cartões, persistência de estado e ausência
de overflow horizontal em mobile. Verificar que todos os screenshots e links
locais existem. `npm run check` valida o projeto; não substitui a inspeção desta
página autónoma no browser.

Validação da primeira ronda (preservada como histórico):

- 18 cartões, filtros de área/pesquisa/evidência/estado e cinco quick wins.
- Todos os detalhes abrem; Escape fecha; estado persiste após recarregar.
- Imagens e links locais existentes, sem erros JavaScript no browser.
- Sem overflow horizontal da página e do painel a 390 e 320 px; inspeção desktop
  a 1440 px. Não constitui teste em hardware móvel real.
- `npm run check`: lint, TypeScript e os 26 ficheiros de testes passaram.
  O build padrão falhou por acesso às fontes e depois por uma restrição de
  abertura de porta no Turbopack. `npm run build -- --webpack` passou com a base
  temporária e os marcadores de produção limpos. Não se declara que o comando
  `npm run check` completo tenha passado.
- `git diff --check` passou. Os fluxos de negócio da aplicação não foram alterados;
  não foi executada a suite E2E completa.

Validação do segundo passe:

- Registo público real de conta fictícia e primeiro acesso, sem serviço de email.
- Duas medições, duas sessões e distinção entre peso da última sessão e máximo.
- Rascunho restaurado com data original; reload offline com worker real conserva
  a chave local mas só mostra a página offline.
- Quatro consumos locais: 520 kcal registadas, 1480 até à meta de 2000; conclusão
  explícita passa a disponibilizar Reabrir dia.
- O catálogo volta ao diário após guardar produto. Posições fora do viewport
  medidas apenas nos cenários descritos nos cartões.
- Relatório expandido validado em Chromium a 1440, 390 e 320 px: 31 cartões,
  filtros, cinco quick wins, todos os detalhes/imagens, Escape e persistência.
  Sem erros JavaScript ou overflow horizontal; links locais verificados.
- A aplicação não foi alterada. Não se repetiu o build ou a suite funcional
  integral; os resultados anteriores não são apresentados como novos testes.

# Correções propostas — primeiro PR

A avaliação e screenshots originais do Kanban registam o comportamento anterior às
correções. UX-06 e UX-25 incluem também capturas posteriores identificadas.
Os cartões indicados abaixo passam a «Em revisão» por omissão; o
estado pessoal guardado no browser continua a ter precedência.

| Ordem | Findings | Implementação |
| --- | --- | --- |
| 1 | UX-01, UX-02 | Rascunho mantido durante envio, removido após sucesso; fieldset bloqueia edição durante submissão. Falha de armazenamento não é apresentada como rascunho guardado. |
| 2 | UX-24 | Última sessão usa as séries dessa sessão; máximo histórico tem rótulo separado. |
| 3 | UX-04 | Editor alimentar mantido entre separadores; aviso antes de sair/descartar alterações. Sem promessa de persistência offline. |
| 4 | UX-11 | Exercício novo exige escolha explícita; modelos e repetição preservam escolhas existentes. |
| 5 | UX-09, UX-22 | Eixos com contraste nos dois temas; variação de peso corporal neutra. |
| Complemento | UX-05, UX-08 | Avisos offline não garantem rascunhos alimentares; eliminar aguarda a ação e apresenta falha recuperável. |
| Primeiro acesso | UX-19, UX-20, UX-21 | Configuração opcional por conta, peso em destaque, medidas recolhidas, acesso direto à meta alimentar. |
| Acesso ao valor | UX-23 | Nomes dos exercícios em treinos guardados ligam à progressão existente. |
| Lote 2 · 1 | UX-03 | Atualização com Atualizar agora/Mais tarde e confirmação; não recarrega outras janelas, nem inicia a atualização durante operações assinaladas como pendentes. |
| Lote 2 · 2 | UX-10 | Voltar mantém o rascunho; falha de armazenamento impede prometer preservação. Descartar alterações exige confirmação quando há dados alterados. |
| Lote 2 · 3 | UX-25 | Início lista rascunhos da conta neste dispositivo, com data/hora e contexto. Rascunho de outra data exige decisão; começar hoje cria um contexto separado sem apagar o anterior. |
| Lote 2 · 4 | UX-06 | Erros de nutrientes junto dos campos com limites, associação acessível e foco no primeiro inválido; mantém os valores introduzidos. |
| Lote 2 · 5 | UX-07 | Editar consumo foca o título com o alimento; guardar/cancelar devolve o foco ao botão de origem após terminar a operação. |

A migração aditiva 0009 conserva as contas existentes fora do onboarding. Novas
contas entram nesse passo depois da autenticação, incluindo quando há verificação
de email. Guardar peso e concluir/adiar configuração são decisões separadas.
Não foram alterados os contratos de privacidade, snapshots ou confirmação de IA.

## Fora deste PR

UX-26 (editor offline estrutural) e UX-18 (comparação textual a validar
com iniciantes), bem como os restantes findings não listados. O pedido autoriza
abrir o PR, não fazer merge ou publicar em produção.

## Verificação

Regressões em `tests/e2e/ux-priorities.spec.ts` cobrem onboarding por conta,
preferência entre logins, seleção explícita, pedido retido/falhado, rascunho,
última sessão diferente do recorde, preservação entre separadores e eliminação
com falha/repetição. Os testes existentes foram adaptados para selecionar o
exercício conscientemente e abrir as medidas opcionais antes de as preencher.

Validação final dos dois lotes: `npm run test:e2e` passou com 50 testes;
`npm run check` passou com lint, tipos, 128 testes unitários e build.
A atualização foi testada com worker real e duas janelas. O HTML foi verificado
com 31 cartões, 18 em revisão, 13 pendentes, filtros, diálogo/Escape, capturas
posteriores carregadas e sem overflow a 320/390/1440 px.
Mocks de rede só demonstram comportamento perante espera/falha; não validam
fornecedores de IA nem retenção de utilizadores em várias semanas.

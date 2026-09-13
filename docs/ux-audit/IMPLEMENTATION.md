# Correções propostas — primeiro PR

A avaliação e screenshots do Kanban registam o comportamento anterior às
correções. Os cartões indicados abaixo passam a «Em revisão» por omissão; o
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

A migração aditiva 0009 conserva as contas existentes fora do onboarding. Novas
contas entram nesse passo depois da autenticação, incluindo quando há verificação
de email. Guardar peso e concluir/adiar configuração são decisões separadas.
Não foram alterados os contratos de privacidade, snapshots ou confirmação de IA.

## Fora deste PR

UX-25/26 (retoma e editor offline estrutural) e UX-18 (comparação textual a validar
com iniciantes), bem como os restantes findings não listados. O pedido autoriza
abrir o PR, não fazer merge ou publicar em produção.

## Verificação

Regressões em `tests/e2e/ux-priorities.spec.ts` cobrem onboarding por conta,
preferência entre logins, seleção explícita, pedido retido/falhado, rascunho,
última sessão diferente do recorde, preservação entre separadores e eliminação
com falha/repetição. Os testes existentes foram adaptados para selecionar o
exercício conscientemente e abrir as medidas opcionais antes de as preencher.

`npm run test:e2e`: 46 testes passaram, incluindo seis novas regressões de UX.
`npm run check`: lint, tipos, 126 testes unitários e build passaram.
Mocks de rede só demonstram comportamento perante espera/falha; não validam
fornecedores de IA nem retenção de utilizadores em várias semanas.

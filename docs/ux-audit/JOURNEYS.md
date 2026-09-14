# Segundo passe: ativação, progressão e regresso

Esta ronda alarga a avaliação à experiência completa. O resultado está nos
cartões UX-19–31 do [Kanban](index.html), com a evidência e correção de cada caso.
Não implementa as correções sugeridas.

## Contexto e critério de avaliação

Iniciantes e intermédios usam telemóvel, entre séries, com interrupções e rede
instável. Treino 3–5 vezes por semana; alimentação diária. O objetivo declarado
é continuar a registar à 6.ª–8.ª semana porque o feedback de progressão compensa
o esforço de introdução.

As perguntas desta ronda foram: consigo começar sem conhecer a aplicação,
obter o primeiro resultado, continuar depois de uma interrupção, compreender
o que aconteceu e repetir a tarefa na sessão ou no dia seguinte?

## Percursos analisados

| Percurso | Comportamento atual / evidência | Decisão de UX |
| --- | --- | --- |
| Criar conta → primeiro acesso | Registo real redirecionou para o painel; existe CTA de primeiro treino, mas não configuração inicial de peso/alimentação. | UX-19: orientação opcional; a ausência de modal não é, por si, uma falha. |
| Primeiro peso | Corpo → Adicionar medição abre oito campos. É possível guardar só peso. | UX-20: tornar opcionalidade evidente e usar divulgação progressiva. |
| Primeira meta alimentar | O resumo manda procurar a configuração em baixo; no cenário vazio, o controlo estava abaixo do viewport inicial. | UX-21: acesso direto à configuração; não recomendar automaticamente uma dieta. |
| Guardar treino → obter valor | O treino fica no histórico, mas os nomes não ligam à progressão. | UX-23: ligar ao detalhe existente, explicar a primeira sessão como ponto de partida. |
| Comparar sessões | Detalhe já tem séries e gráficos. Catálogo mostra data recente com máximo histórico. | UX-18: testar comparação explícita; UX-24: corrigir referência factual errada. |
| Repetir treino | Valores anteriores já estão preenchidos, sem estado de execução. | UX-29: distinguir referência e séries realizadas, sem perder a eficiência da repetição. |
| Interromper → voltar | Rascunho recuperado com data original; não há atalho no Início. | UX-25: descoberta e decisão explícita entre continuar e iniciar outro treino. |
| Recarregar sem rede | Worker real devolve página offline. A chave local existe mas o treino não é editável. | UX-26: capacidade offline limitada à sessão requer desenho estrutural e revisão de privacidade. |
| Peso aumenta | +2 kg aparece a âmbar no Início, sem objetivo configurado; Corpo usa semântica neutra. | UX-22: neutralidade consistente. Não interpretar ganho/perda como sucesso/falha por defeito. |
| Registar alimento → quanto falta | Quatro consumos de 200 g a 65 kcal/100 g resultam em 520 kcal e 1480 até à meta de 2000. | Preservar a resposta textual existente. Aritmética e atualização verificadas neste cenário. |
| Terminar o diário | Concluir dia fica depois das refeições; só dias explicitamente concluídos contam. | UX-27: expor estado e ação também no resumo, sem concluir automaticamente. |
| Gerir produtos | Guardar no catálogo passa para o diário com produto selecionado. | UX-28: conservar contexto de origem e clarificar produto guardado vs. consumo registado. |
| Voltar a comer o mesmo | Sem recentes no formulário do diário e sem repetir consumo no histórico. | UX-30: preparar consumo frequente, sempre com revisão de data/quantidade. |
| Consultar a semana | Relatório existente acessível através da Conta. | UX-31: ligá-lo ao Início; preferência de email continua na Conta. |

## Prioridade e decisão de onboarding

O peso inicial é útil para evolução corporal, mas não é requisito para registar
cargas ou comparar exercícios. Uma modal obrigatória com todas as medidas
acrescentaria uma barreira ao primeiro valor. A proposta é um passo opcional no
primeiro acesso: peso em destaque, outras medidas recolhidas, alimentação
configurável e “Agora não”. Quem salta deve ter atalhos contextuais para completar
mais tarde. Não repetir automaticamente em todos os logins.

UX-19 é severidade 2/P2: há um caminho válido para começar pelo primeiro treino.
UX-21 é severidade 2/P1 porque configurar a meta é necessário para responder
à tarefa alimentar, mas o controlo existe e é alcançável. UX-24 é severidade 3/P1:
a referência histórica errada foi reproduzida. UX-26 é severidade 3/P1 e esforço L:
a tarefa fica indisponível sem rede, embora o rascunho não tenha sido perdido.

O top 5 de pequenas correções passa a ser UX-01, UX-02, UX-24, UX-05 e UX-08.
UX-06 continua P1; sai do top 5 porque a referência histórica incorreta afeta
diretamente a decisão sobre a sessão seguinte.

## O que ainda exige pessoas ou dispositivos reais

- A proposta de onboarding reduz hesitação ou acrescenta uma interrupção?
- Um iniciante encontra a primeira medição e sabe que pode guardar só peso?
- Percebe carga e repetições anteriores/atuais sem ajuda e sem interpretar gráficos?
- Numa sessão abreviada, distingue séries sugeridas das realizadas?
- Identifica que o diário está parcial e descobre a conclusão do dia?
- Num telefone físico, consegue usar os controlos com uma mão, em luz forte,
  com teclado aberto, bloqueio do ecrã e reabertura da PWA?

Proposta: sessões moderadas com um pequeno grupo de iniciantes/intermédios,
sem fornecer os nomes dos menus na instrução da tarefa. Observar sucesso sem
ajuda, erros de data/exercício/quantidade, recuperação e interpretação dos dados.
Uma ronda qualitativa não mede retenção. A continuidade à 6.ª–8.ª semana exige
acompanhamento longitudinal; não é um resultado demonstrado por esta avaliação.

## Limitações e proteção da evidência

Contas e dados fictícios numa base temporária. Sem chaves de IA ou envio de email.
O ramo de verificação de email foi inspecionado no código, mas não testado com
entrega real. Não foram ensaiados fornecedores de fotografia, bloqueio físico,
leitores de ecrã nem semanas reais de utilização. Planos, rotinas e relatórios
foram inspecionados, mas não foi repetida uma suite funcional integral.

Não se confunde um estado vazio com falta de funcionalidade: gráficos, histórico
textual, repetição de treinos, kcal restantes, conclusão explícita e relatórios
já existem. Os findings identificam limitações de descoberta, contexto ou
significado dessas capacidades, além dos defeitos concretos reproduzidos.

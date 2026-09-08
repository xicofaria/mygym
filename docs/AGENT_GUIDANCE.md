# Manutenção das instruções de agentes

Revisão de 2026-09-08 para GPT-6 Astra, limitada à documentação do repositório.

## Fontes oficiais

O [guia de GPT-6 Astra](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra)
recomenda explicitar autonomia, auditar conflitos entre instruções, definir o estilo
de resposta e calibrar delegação e testes. Aplicação neste projeto: concluir trabalho
autorizado, esclarecer decisões materiais, explicar bloqueios e validar conforme a alteração.

A [documentação de skills](https://learn.chatgpt.com/docs/build-skills) recomenda
descrições concisas, com âmbito e gatilhos claros no início. A lista inicial pode
abreviar descrições ou omitir skills quando excede o orçamento de contexto; as
instruções completas são lidas quando a skill é selecionada. Não impõe exatamente
uma linha. Para futuras skills do projeto, usar uma frase curta na descrição e
colocar procedimentos e referências no corpo do `SKILL.md`.

## Organização adotada

- `AGENTS.md`: autonomia, segurança, mapa de leitura e verificações obrigatórias.
- `CLAUDE.md`: importa as mesmas regras, sem manter uma segunda cópia.
- `ARCHITECTURE.md`: estrutura e decisões técnicas de referência.
- `DOMAIN_RULES.md`: contratos detalhados de treinos, fotografias e calorias.
- `TESTING.md`: critérios de validação; resultados correntes no PR/CI e
  experiências anteriores no [arquivo histórico](archive/VALIDATION_2026-09.md).
- Guias de funcionalidades e operação mantêm os respetivos detalhes e evidências.

Não foram encontrados `SKILL.md` no repositório. As skills pessoais e os plugins
instalados fora dele não fazem parte desta revisão. A preferência local é delegar
apenas a pedido do utilizador; o guia permite ajustar a delegação ao fluxo de trabalho.
A escolha do modelo do agente é independente de `AI_PROVIDER` e dos modelos de
reconhecimento da aplicação, cuja configuração permanece igual.

## Evitar regressões na documentação

Manter cada regra numa referência principal e atualizar os links quando a mover.
Antes de descrever comportamento atual, confirmar o código: nesta revisão foram
corrigidas as referências ao seletor de parceiro, `getPageContext`, ausência de registo
público e gestão de conta via seed. Preservar contratos de segurança e dados ao
encurtar instruções. Relatos de testes datados são históricos, não requisitos de execução.

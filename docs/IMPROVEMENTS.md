# Revisão e melhorias — 2026-09-05

## Contexto e âmbito

App privada para duas contas, catálogo partilhado, treinos/planos/rotinas/modelos,
medidas corporais, gráficos e rascunhos locais. Revistos arquitetura, autenticação,
validação, schema/migrações, formulários, privacidade, dependências, testes e docs.
Não é uma auditoria integral de produção nem uma medição da precisão da IA.

## Implementado neste PR

- Pesos com ponto/vírgula, incluindo 2.8 e 2.75, sem passos obrigatórios de 0.5 kg.
  Todas as séries são validadas; linhas incompletas não desaparecem ao guardar.
- Fotografia com preview, envio explícito e confirmação de exercício existente;
  preserva séries preenchidas e permite seleção manual em caso de erro.
- OpenAI ou OpenRouter configurável, com Qwen vision como exemplo/predefinição
  OpenRouter; chaves só no servidor, respostas estruturadas verificadas.
- Quota diária persistente por conta e limite rápido por instância, sem fotos guardadas.
- Next/eslint-config-next 16.3.4, postcss 8.5.28, esbuild corrigido e lockfile revisto;
  auditoria npm sem vulnerabilidades no momento da validação.
- Catálogo com sinónimos portugueses, equipamento, pesquisa sem acentos, edição
  de detalhes e favoritos privados; histórico recente acessível no seletor.
- Séries consecutivas agrupadas por exercício, duplicação/remoção compactas,
  última prestação visível e teclado decimal no telemóvel.
- Temporizador manual de descanso com pausa, reposição e durações 60/90/120 s;
  estado por conta/dispositivo preservado ao navegar, sem alterar séries.
- Migração aditiva, testes de regressão e atualização de AGENTS/CLAUDE/README.

A skill de frontend orientou a UI para listas e divisores simples, menos seletores
repetidos, controlos táteis e um único destaque de ação, mantendo o estilo da app.

## Próximas melhorias que faria

1. **Validar a IA no ginásio:** conjunto de fotografias representativo, revisão
   de acertos/ambiguidades, custo e latência por modelo. Só depois escolher outro
   modelo ou ajustar o catálogo com base em evidência.
2. **Observabilidade e orçamento:** métricas sem imagens/chaves/textos pessoais,
   alertas de despesa e limpeza/retenção definida dos contadores antigos.
3. **Decimais consistentes nas medidas corporais:** aplicar ponto/vírgula e
   formatação pt-PT sem arredondar o valor guardado.
4. **Exportação pessoal CSV/JSON:** treinos e medidas da própria conta.
5. **Fotografias:** recorte e melhor gestão de memória para imagens grandes.
   HEIC funciona em Safari/iOS 17+; um decoder WASM compatível com CSP
   (sem eval) é follow-up para Chrome/Firefox.
6. **Acessibilidade e PWA em dispositivos reais:** VoiceOver/TalkBack, modo instalado,
   captura nativa, contraste e comportamento com pouca rede.
7. **Correspondência OFF na análise de calorias (2026-09-07):** ensaio de
   integração da rota completa com fornecedor de IA realmente lento (valida o
   orçamento total ponta a ponta) e teste de aborto por timeout a atravessar
   `resolveFoodCandidates` à escala real (o teste atual de aborto real vive no
   nível da pesquisa textual, com prazos curtos).

**Gestão de conta implementada** (registo público, `/conta`, eliminação RGPD,
verificação e reposição por email) — a exceção anterior deixou de se aplicar.

## Limites conhecidos

- O catálogo representa exercícios, não inventário de máquinas físicas.
- IA e captura nativa ainda requerem validação com chave/fotos reais.
- A quota diária não é um teto monetário; configurar créditos com o fornecedor.
- O temporizador não promete som/notificações com a PWA fechada.
- Testes SQLite temporários têm limitação de limpeza EBUSY no Windows;
  migrações/quota são verificadas em Linux, sem suprimir asserções.
- Nenhum deploy, merge ou alteração à base de dados de produção foi solicitado/executado.

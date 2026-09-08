# Melhorias pendentes

Revisto em 2026-09-08 contra o código atual. Esta lista orienta trabalho futuro;
não significa que as melhorias estejam implementadas ou que tenham sido medidas
em produção. O comportamento disponível está no [README](../README.md).

## Próximas alterações

| Prioridade | Melhoria e evidência atual | Critério de conclusão |
| --- | --- | --- |
| 1 | **Decimais nas medidas corporais.** `src/components/body-metric-form.tsx` usa `type="number"` e `Number()`, ao contrário da entrada de pesos dos treinos. | Aceitar ponto e vírgula em campos decimais, preservar precisão e campos opcionais vazios, validar limites no servidor e cobrir introdução/persistência em pt-PT. |
| 2 | **Relatórios com consultas específicas.** `getWeeklyReportData()` chama `getCalorieData()`, que carrega e valida produtos não usados pelo relatório. | Consultar apenas consumos, metas e dias necessários, preservando resultados, isolamento por conta e limites do período; verificar a redução de leituras. |
| 3 | **Envio semanal recuperável.** O cron envia sequencialmente e não mantém um registo persistente por conta/semana. | Registar estado de envio, coordenar execuções concorrentes e permitir retomar falhas; definir como evitar duplicados perante resposta incerta do fornecedor e testar repetição/interrupção sem emails reais. |
| 4 | **Exportação pessoal.** A página de privacidade indica que a exportação automática ainda não existe. | Exportar treinos, medidas e diário alimentar em JSON/CSV a partir de `/conta`, apenas da sessão autenticada, com unidades/datas explícitas e snapshots históricos preservados. |

Começar pelos dois primeiros pontos permite alterações pequenas e independentes.
O envio semanal requer desenho de persistência e uma migração aditiva; a exportação
requer definir o formato e os limites para contas com histórico extenso.

## Validação da experiência e operação

- **PWA e acessibilidade em dispositivos reais:** verificar iPhone/Android,
  instalação, VoiceOver/TalkBack, teclado decimal, captura de fotografias,
  rascunhos com pouca rede e comportamento ao bloquear o ecrã. Concluir com uma
  matriz de dispositivos/resultados e correções dos problemas reproduzidos.
- **IA no ginásio:** usar fotografias representativas e revistas, medir acertos,
  ambiguidades, recusas, latência e custo. Os ensaios anteriores com imagens
  públicas não estabelecem precisão no ginásio. Chamadas pagas e fotografias
  privadas exigem autorização para esse ensaio.
- **Timeout e cancelamento de calorias:** testar a rota completa com fornecedor
  lento simulado e resolução Open Food Facts, incluindo orçamento esgotado,
  cancelamento e respostas tardias. Confirmar que o formulário preserva a foto
  e os campos e que o catálogo não prolonga o prazo total indevidamente.
- **Observabilidade e retenção:** definir métricas de falhas/latência sem imagens,
  chaves ou texto pessoal; política de limpeza dos contadores de IA e alertas de
  despesa. A quota diária de tentativas não substitui limites de crédito.
- **Fotografias grandes e HEIC:** avaliar recorte e uso de memória em dispositivos
  reais. Investigar descodificação compatível com CSP nos browsers sem suporte
  nativo; conservar a alternativa manual e mensagens acionáveis.

## Limites a preservar

- O catálogo representa exercícios, não inventário de máquinas físicas.
- IA pode falhar ou estimar incorretamente; sugestões exigem revisão e confirmação.
- Open Food Facts é colaborativo e pode estar incompleto ou indisponível.
- O temporizador não promete som ou notificações com a PWA fechada.
- Cache offline não inclui dados autenticados nem fotografias privadas.

## Manutenção da lista

Cada alteração deve retirar daqui o trabalho concluído e atualizar o guia da
funcionalidade. Resultados correntes acompanham o PR/CI, conforme
[TESTING.md](TESTING.md). O [arquivo de setembro de 2026](archive/VALIDATION_2026-09.md)
conserva as experiências anteriores; pendências nesse arquivo precisam de nova
verificação antes de serem tratadas como defeitos atuais.

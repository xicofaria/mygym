# Backup e recuperação do Turso

Este procedimento protege a base completa da aplicação. Os dumps contêm nomes,
emails, hashes de palavras-passe, treinos e medições: trata-os como dados
sensíveis, nunca os coloques no Git e guarda-os cifrados fora do computador de
desenvolvimento.

Os comandos abaixo seguem a documentação oficial atual do Turso para
[`db shell`](https://docs.turso.tech/cli/db/shell),
[`db create`](https://docs.turso.tech/cli/db/create) e
[Point-in-Time Recovery](https://docs.turso.tech/features/point-in-time-recovery).

## Criar e validar um backup

Escolhe um diretório privado, impede permissões de leitura para outros
utilizadores e cria um dump SQLite:

```bash
umask 077
mkdir -p backups
turso db shell <base-producao> .dump > backups/mygym-AAAA-MM-DD.sql
npm run backup:verify -- backups/mygym-AAAA-MM-DD.sql
```

`backup:verify` não toca na base original: restaura o dump numa base SQLite
temporária, executa `integrity_check` e `foreign_key_check`, confirma as sete
tabelas da aplicação e apresenta apenas o número de registos em cada uma.
Usa apenas dumps produzidos pela tua própria base Turso; não executes o
verificador sobre ficheiros SQL recebidos de terceiros.

Depois da validação, cifra e copia o ficheiro para armazenamento separado. Por
exemplo, podes usar o cofre cifrado do teu fornecedor de backups. Apaga a cópia
local não cifrada quando já não for necessária.

## Testar um restauro sem afetar produção

Um restauro deve criar sempre uma base nova:

```bash
turso db create mygym-restore-AAAA-MM-DD \
  --from-dump backups/mygym-AAAA-MM-DD.sql \
  --wait
turso db shell mygym-restore-AAAA-MM-DD \
  "SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS workouts FROM workouts;"
```

Cria um token para a nova base, aponta um deployment de preview para o novo
`DATABASE_URL`/`DATABASE_AUTH_TOKEN` e valida, pelo menos:

1. login dos dois utilizadores;
2. histórico e detalhe de treinos;
3. métricas corporais e gráficos;
4. templates e catálogo de exercícios;
5. criação e eliminação de um registo descartável.

Só depois desta validação deves alterar as variáveis do deployment de produção.
Mantém a base antiga intacta até confirmares o funcionamento e teres um novo
backup da base restaurada.

## Recuperar um erro recente com PITR

O Turso cria pontos de recuperação automaticamente em cada `COMMIT`. O período
disponível depende do plano. A recuperação cria uma base nova e pode perder até
cerca de 15 segundos imediatamente anteriores ao timestamp escolhido:

```bash
turso db create mygym-recovery-AAAA-MM-DD \
  --from-db <base-producao> \
  --timestamp 2026-07-29T18:30:00Z \
  --wait
```

Repete a mesma validação de preview antes de trocar produção. O Turso não permite
restaurar PITR por cima de uma base existente e a nova base precisa de um novo
token (ou de um token de grupo).

## Cadência recomendada

- dump validado antes de qualquer migração de schema;
- dump validado mensal enquanto a aplicação tiver uso regular;
- ensaio completo de restauro a cada três meses;
- PITR para incidentes recentes, sem substituir os backups independentes.

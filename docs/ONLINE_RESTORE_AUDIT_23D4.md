# ONLINE-01C-23D4 — Auditoria de PostgreSQL restaurado e plano operacional Railway

## Entregue

- `services/api/src/restoreAudit.mjs`: inventário **READ ONLY**, com `BEGIN READ ONLY` e `ROLLBACK`. Exige identidade de banco explicitamente informada antes de consultar tabelas do jogo; valida 25 migrações, tabela de outbox e tabelas críticas, ausência de restrições SQL não validadas e contagens agregadas. Não retorna PII, e-mails, senhas, tokens, dados de jogadores, URLs ou segredos.
- `services/api/scripts/audit-restored-pg.mjs`: CLI só executa quando `RESTORE_AUDIT_ISOLATED=true`, `RESTORE_AUDIT_DATABASE_NAME` exata e `DATABASE_URL` de um banco **isolado** forem passados pelo operador. A flag não prova isolamento: o operador deve comprovar a origem do destino antes de executar. Nome `railway` ou `postgres` proibido como destino, para reduzir acidentes.
- CI `.github/workflows/online-api.yml`: após o `pg_dump` e `pg_restore` que já existiam no PostgreSQL18 **descartável**, executa o mesmo audit CLI contra `kanto_ci_restore`, nunca contra `kanto_ci`. A checagem tem de ser verde em CI. Testes unitários cobrem sucesso e fail-closed.
- Não há DDL novo, worker, variável de produção, e-mail real, URL pública, escrita de banco ou mecanismo de habilitar cadastro.

## Processo de recuperação REAL Railway — gate A NÃO COMPROVADO

Repositório e CI não bastam. Verificar no Railway o serviço `Postgres` do projeto `kanto-idle-lab` em `production`, volume `postgres-volume`. Documentar a configuração efetiva no painel **Backups**, evidência da existência de backup finalizado e a retenção aplicável. A ferramenta de Railway conectada nesta sessão não expõe uma API para confirmar lista de backups nem disponibilidade real do arquivo, portanto não inferir proteção a partir do volume ou do fato de o serviço estar online.

**Risco importante:** na documentação Railway, o restore de um *backup de volume* é preparado como troca do volume montado no mesmo serviço/ambiente. Isso NÃO é um teste seguro em production: **não clicar em Deploy/confirmar restore no Postgres original**. Usar PITR para um novo serviço isolado (se estiver efetivamente habilitado), ou cópia lógica restaurada em banco novo também isolado com aprovação operacional explícita. Um `pg_dump` não comprova PITR.

Segundo a documentação de PITR, a restauração a timestamp cria **outro serviço PostgreSQL**, sem modificar a origem. Antes disso, PITR precisa ser habilitado e ter **primeiro backup base + WAL disponível**; habilitar exige reconfiguração e redeploy do Postgres, portanto não alterar as configurações da produção sem aprovação. É possível conferir status pelo CLI Railway usando apenas leitura (`railway postgres pitr status --service Postgres`, dentro do projeto/ambiente selecionado pelo operador), mas o CLI não foi executado nesta implementação.

### Evidência mínima para aprovação do gate A

1. Backup/snapshot real: identificador não secreto, timestamp UTC, janela disponível e retenção confirmada no serviço; estado do archiver se PITR.
2. Restore efetivo: **novo serviço/banco isolado**, acesso não público, IDs/timestamps da operação, versão PostgreSQL, sem alterar API/web/variáveis de production.
3. Integridade: no clone, executar `RESTORE_AUDIT_ISOLATED=true RESTORE_AUDIT_DATABASE_NAME=<nome_exato> DATABASE_URL=<URL_DO_CLONE> npm run audit:restore --prefix services/api`; nunca copiar URL/chave para commit ou log. Guardar somente relatório sanitizado, além de checagem de negócio/fixtures.
4. RPO e RTO reais medidos do incidente simulado, origem do restore, responsável e aprovação. O relatório do CLI sozinho não satisfaz esses itens nem prova backup ou PITR.
5. Reconciliar ou destruir clones e recursos temporários após validação, preservando a base original.

## Outros gates do beta

Entrega real controlada de e-mails via Resend, domínio verificado, processo LGPD/exclusão, segurança de sessão, limites de abuso, suporte/alertas e decisão formal de lançamento seguem BLOQUEADOS. Nenhuma conta pública pode ser aberta: `NODE_ENV=test` ainda é guard obrigatório da API. `/play` segue save local e sem migração; Regiões 1v1 apenas `team[0]`, Ginásios 3v3 pela equipe já escolhida na Coleção, recompensas/HMAC intactos.

Referências:
- https://docs.railway.com/volumes/backups
- https://docs.railway.com/volumes/point-in-time-recovery

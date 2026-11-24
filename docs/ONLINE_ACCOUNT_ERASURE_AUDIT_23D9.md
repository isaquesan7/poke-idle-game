# ONLINE-01C-23D9 — Grafo real de dependências e ensaio de exclusão sem persistência

## Implementado

A etapa **não exclui contas reais**. O módulo accountErasureAudit.mjs somente de leitura consulta pg_constraint para identificar relações reais do PostgreSQL com destino direto ou indireto à tabela game_accounts. Exige ON DELETE CASCADE em todo caminho descoberto, bloqueia relações externas/não cascata e exige presença de todas as tabelas críticas esperadas.

Tabelas verificadas: perfil, saves, sessões, verificação, reset, recibos econômicos, encontros selvagens, turnos selvagens, equipamentos de golpes, equipes da Coleção, reservas Gym, turnos Gym e outbox criptografada. A análise do catálogo não autoriza exclusão em produção.

O teste de integração PostgreSQL 18 cria uma conta fictícia e dependências exclusivamente em uma transação temporária: BEGIN, INSERT, verificação de presença, DELETE de game_accounts, verificação da cascata e ROLLBACK obrigatório. Nem a conta fictícia, nem a exclusão são persistidas. Nenhuma rota pública foi criada.

## Limitações e riscos ainda abertos

- **LGPD e retenção:** definir e aprovar quais dados devem ser excluídos, anonimizados ou preservados; a cascata pode eliminar recibos econômicos e progressão. O teste não é política jurídica.
- **Backups:** uma restauração do Railway pode reintroduzir dados previamente eliminados. Falta política de retenção, expurgo de instantâneos quando aplicável e reaplicação de solicitações após restore.
- **Outras fontes:** game_auth_throttles usa digests HMAC sem FK de conta. Necessita política de limpeza/expiração. Logs, telemetria, provedor de e-mail e caches não são abrangidos pelo grafo.
- **Identidade e abuso:** faltam confirmação forte do solicitante, sessões de confirmação, proteção contra concorrência, idempotência, auditoria minimizada e tratamento de retenções legais.
- **Acesso do jogador:** nenhum endpoint para exclusão/exportação foi aberto. O gate privacy.accountDeletionVerified continua não homologado.

## Preservação

Nenhuma alteração nas rotas, banco Railway, dados reais, Resend, save local em /play ou motor canônico. Regiões 1v1 usam team[0]; Ginásios 3v3 usam a equipe previamente definida na Coleção. Cadastro público OFF. Restore/PITR Railway REAL, entrega Resend REAL, LGPD e confiança no proxy permanecem bloqueios.

## Próximo recorte

Definir plano de retenção e tratamento de backups; só depois projetar solicitação autenticada e idempotente de exclusão com verificação de identidade e transação operacional controlada.

# ONLINE-01C-23D5 — Evidência cronológica de restore REAL (Gate A)

## Resultado deste recorte

Código **OFFLINE** e sem mutação do Railway, do Postgres ou do cadastro. API/web/Postgres do Railway estavam online no commit `f898d3432378fce4fd8e8bc674b166dce95ca8ac`; não existem forks operacionais verificados. **Nenhum backup real ou PITR foi consultado/restaurado** nesta etapa. Os conectores disponíveis não expõem lista de backups nem a operação de PITR para um destino isolado; não concluir que PITR está habilitado apenas porque o volume existe.

O novo `evaluateRestoreEvidence` verifica **consistência de evidência fornecida pelo operador**, nunca autenticidade perante Railway. Integra-se como requisito adicional ao gate `restore` do avaliador `betaReadiness.mjs`, sem alterar qualquer feature flag.

## Operação real necessária (não executada)

1. No painel Railway, projeto `kanto-idle-lab`, environment `production`, serviço `Postgres`, confirmar backup disponível, PITR habilitado, retenção, ponto de recuperação e operação real; guardar identificadores não secretos fora do Git.
2. Aprovar e iniciar um **restore para novo environment e novo serviço PostgreSQL** com acessos limitados. Nunca selecionar restore que substitua volume no Postgres original; nunca apontar API/web da produção ao novo DB.
3. Registrar UTC do último ponto efetivamente recuperado, incidente simulado, início do restore, novo DB saudável, auditoria de integridade e revisão. Medir `RPO = incidente - ponto recuperado` e `RTO = DB saudável - incidente` em minutos. Uma cópia lógica não equivale a comprovação de PITR; só marcar `method='pitr'` quando reprodução de WAL até timestamp tiver sido observada.
4. Executar no **clone comprovadamente isolado**, nunca no banco original: `RESTORE_AUDIT_ISOLATED=true RESTORE_AUDIT_DATABASE_NAME=<nome_exato> DATABASE_URL=<URL_PRIVADA_DO_CLONE> npm run audit:restore --prefix services/api`. A ferramenta faz inventário READ ONLY e retorna contagens agregadas.
5. Um operador e **revisor independente** verificam no painel os IDs de backup/restore, origem/destino, logs de recuperação e tempos. Guardar apenas referência sanitizada. Não guardar dados de jogadores, host, URL privada, senha, token, screenshot de segredo ou export SQL no repo.
6. Criar **fora do repositório** o JSON de evidência com os campos abaixo; `npm run check:restore-evidence --prefix services/api -- /private/restore-evidence.json`. Código 0 = **consistência aprovada**, 1 = campos inconsistentes, 2 = arquivo ou documento inválido. Isto não valida a autenticidade da evidência.
7. O `check:beta-readiness` exige agora `gates.restore.drill` com esses dados e exige que `backupId`, `restoreId`, RPO/RTO e SHA coincidam com o gate externo. Nenhum relatório `ready` ativa o cadastro automaticamente.

### Estrutura do JSON privado (campos e tipos, sem evidência fabricada)

- `provider`: literal `railway`; `method`: `pitr` ou `volume-snapshot`.
- `sourceEnvironmentId`, `restoreEnvironmentId`, `sourceServiceId`, `restoreServiceId`: UUIDs distintos em cada par, conferidos no painel Railway.
- `backupId`, `restoreId`: referências operacionais não secretas e distintas; `appCommitSha`: commit `main` verificado, 40 dígitos hex.
- `recoveryPointUtc`, `incidentUtc`, `restoreStartedUtc`, `restoredHealthyUtc`, `integrityCheckedUtc`, `reviewedUtc`: ISO UTC `YYYY-MM-DDTHH:MM:SSZ`; ordem obrigatória, sem data futura.
- `observedRpoMinutes`, `observedRtoMinutes`: números não negativos calculados dos marcos acima, com tolerância de arredondamento de até 1 segundo.
- `restoredIntoNewService`, `productionSourceUnaffected`, `apiNeverPointedAtRestore`, `integrityAuditPassed`: `true` só após conferência real; `integrityAuditReference`: referência de auditoria não secreta.
- `pitrWalReplayVerified`: `true` somente quando método `pitr` e replay de WAL comprovado; `false` quando `volume-snapshot`.
- `operator`, `reviewer`: identificadores internos de pessoas diferentes, sem e-mails pessoais.

Este checklist reforça a não equivalência de sucesso CI/volume online com recuperação operacional. Ausência de backup real continua **BLOQUEIO**. Também permanecem bloqueados: entregabilidade Resend com domínio/remetente real em ambiente de teste controlado, políticas LGPD, segurança e disponibilidade. `NODE_ENV==='test'` continua exigido para cadastro; `/play` LOCAL sem migração; Regiões 1v1 (`team[0]`), Ginásios 3v3 com trio da Coleção, HMAC e recompensas não alterados.


## ONLINE-01C-23D4/23D5 — recuperação de evidência PITR já executada (24/11/2026)
- NÃO refazer restauração nem auditoria estrutural genérica. Operador confirmou 25 migrations às 11:20 UTC no histórico de atendimento; revisão registrada às 11:33 UTC relata 16 tabelas, zero constraints não validadas, zero contas/saves/e-mails, consulta via psql no clone. Esses resultados são evidência histórica do operador, não uma nova execução desta sessão.
- Leitura direta Railway confirma serviço Postgres-restored-20261124-1107 (b216fba8-bfce-4bb0-813c-261b1231e5af), deployment 816069b3-5db0-4d10-ae88-03682af8f23d SUCCESS, imagem PostgreSQL18, volume distinto, zero domínios e zero TCP proxies. Logs PostgreSQL UTC: parada de replay em commit 11:07:09.960099; consistent recovery state e redo concluído 11:15:56.224; archive recovery complete 11:15:56.770; ready to accept connections 11:15:56.835. Dez registros de WAL restaurados na amostra consultada. Deploy criado 11:15:03.428Z; elapsed deploy→ready 53.407s, NÃO RTO formal (marco do incidente não recuperado); recovery point→ready 8m46.875s NÃO RPO. Fonte principal e clone estão no MESMO ambiente production, com serviços/volumes distintos. Sem mutação, sem conexão DB nova, sem logs brutos/PII ou credenciais no documento.
- Gate A continua incompleto EXCLUSIVAMENTE quanto ao isolamento ambiental exigido pelo verificador, comprovação de referências backup/restore, cronologia formal RPO/RTO, retenção e revisão independente; PITR e auditoria estrutural não estão mais marcados como não realizados. Não relaxar verificador nem inventar timestamps/aprovação; reaproveitar evidência e escolher solução de isolamento operacional com responsável, antes de nova operação faturável. O conector não oferece API PITR/backup ou execução shell no clone existente (fork_exec é restrito a fork), e não se deve criar proxy público nem tocar produção para suprir isso.
- Próximos trabalhos: fechar #271 após CI; resolver delta de isolamento/evidência do restore e revisar LGPD/Resend sem repetir sandbox; concentrar integração do progresso servidor e release fechado. Cadastro OFF, SQL026 candidata, /play local sem migração, regiões 1v1 e ginásios 3v3.

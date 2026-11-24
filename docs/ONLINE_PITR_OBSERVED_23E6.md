# ONLINE-01C-23E6 — Evidência observada de PITR Railway (homologação parcial)

## Fatos observados em 24/11/2026

- Operador apresentou no painel Railway backup manual de volume de 874 MB às 08:05 (horário mostrado), agendamento ativo e PITR habilitado. Frequências individuais de retenção ainda não conferidas.
- O operador solicitou restauração PITR. Railway provisionou serviço separado Postgres-restored-20261124-1107 (b216fba8-bfce-4bb0-813c-261b1231e5af), volume postgres-restored (b442eb80-0865-4e04-a4a6-b15826e93393), deployment 816069b3-5db0-4d10-ae88-03682af8f23d.
- Origem Postgres c1411126-70c6-40c1-84c0-817f8323edea permanece online e com volume original 2cbb1105-577f-4650-b7df-ea08c7e50858. API e web online, sem alertas observados. Não alteramos configurações da API/web. Referência efetiva DATABASE_URL não foi inspecionada (valores indisponíveis pelo conector).
- Logs do deployment restaurado comprovam leitura de WAL, recuperação consistente, parada após commit de transação às 2026-11-24T11:07:09.960099Z, archive recovery complete, nova timeline e ready to accept connections às 2026-11-24T11:15:56.835Z. Deployment criado às 2026-11-24T11:15:03.428Z. Intervalo deploy→ready = aproximadamente 53,4 segundos; **não é RTO integral** sem marco de incidente simulado; RPO também não medido formalmente.
- Serviço restaurado não tem domínio público nem proxy TCP público na inspeção. Captura da aba Database mostrou 16 tabelas da aplicação, incluindo game_schema_migrations; operador confirmou 25 registros de migrações. A consulta SQL agregada executada pelo operador no serviço restaurado, com resultado apresentado em captura do terminal psql, retornou exatamente: migracoes=25, tabelas=16, restricoes_invalidas=0 (constraints não validadas), contas=0, saves=0, emails=0. Auditoria estrutural e contagens aprovadas para este recorte; comparação dos checksums com os arquivos do commit ainda não executada. Não havia dados de jogadores para testar recuperação de progresso.
- Ambos os serviços residem no ambiente production (dffdf664-9fc0-42c1-a16d-a9182cc91ea9). **Isolamento por serviço/volume demonstrado; isolamento por ambiente NÃO demonstrado.** Não satisfaz integralmente o gate 23D5, que exige ambiente distinto, integridade e revisão independente. Não alterar esse gate nem declarar beta aprovado.

## Próximos passos

1. Consulta agregada somente leitura concluída com resultado esperado; resta comparar nomes e checksums das 25 migrações com os arquivos do commit. Não consultar conteúdo de jogadores nem expor credenciais.
2. Conferir no painel a referência DATABASE_URL da API original sem compartilhar valor resolvido ou senha. Não alterá-la.
3. Revisar alternativa de restauração em ambiente separado e procedimento pós-restore, incluindo RPO/RTO e retenção. Não apagar fonte, volume original ou bucket PITR. Remover somente clone após coleta de evidências e autorização explícita.
4. PR #247 (5bb8399ddbfdff1ae14503bcbc02dc87f90d946c) integrou a ferramenta de ensaio manual Resend depois de três workflows aprovados. Nenhuma entrega real comprovada. Deploy exato API/web confirmado SUCCESS em 5bb8399ddbfdff1ae14503bcbc02dc87f90d946c e log de registro desabilitado. Preparar domínio/remetente controlado.

Cadastro público OFF; /play local sem migração. Regiões 1v1 e Gym 3v3 preservados. Nenhum dado pessoal, token ou segredo registrado neste documento.

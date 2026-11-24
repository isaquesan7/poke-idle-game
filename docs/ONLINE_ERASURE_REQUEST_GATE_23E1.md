# ONLINE-01C-23E1 — Contrato de solicitação de exclusão (somente revisão)

O módulo erasureRequestGate.mjs é uma **especificação verificável offline**. Não verifica identidade de ninguém, não cria endpoint e não altera uma conta. Seu resultado deletionAuthorized é sempre false, mesmo quando a documentação do operador é coerente.

## Condições do projeto

1. Identificar a solicitação usando referência pseudônima não secreta, versão/commit da aplicação e revisão isolada.
2. Antes de qualquer exclusão real, confirmar autenticação válida, reautenticação recente e confirmação por canal independente, com token de uso único. Esses mecanismos ainda não foram implementados para esta operação; as flags de evidência **não** são prova de execução.
3. Bloquear movimentos e recompensas de batalhas/Gym, reservas e escritas concorrentes durante processamento; projetar idempotência e revogação de sessões.
4. Oferecer exportação segura antes de remover dados. A exportação interna 23D8 é parcial e ainda não atende este requisito para jogadores.
5. Aprovar política LGPD para retenções necessárias, legal hold e eventuais recibos econômicos; revisar provedores externos, backups e risco de reintrodução pós-PITR.
6. Manter um operador e um revisor independentes, com carimbos UTC válidos, sem registrar senhas, tokens, e-mails ou payloads de saves na trilha.
7. Implementar o fluxo real de forma separada, após revisão jurídica e de segurança. Nunca inferir autorização de exclusão a partir da função de revisão.

## Bloqueios atuais

- Sem endpoint público de solicitação, confirmação, exclusão ou download de dados.
- Sem ledger externo real de solicitações, mecanismo de replay após backup ou aprovação de retenção.
- Sem teste real de backup/PITR Railway ou entrega Resend.
- Cadastro público desligado em produção; /play preservado, Regiões 1v1 usam team[0], Ginásios 3v3 usam equipe definida previamente na Coleção.

Esta etapa complementa 23D9 (grafo FK e ROLLBACK) e 23E0 (prevenção de retorno de contas por restores) sem autorizar alterações destrutivas.

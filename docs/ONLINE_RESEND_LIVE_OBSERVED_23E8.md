# ONLINE-01C-23E8 — Ensaio real de cadastro e recuperação com Resend sandbox

## Evidência observada em 24/11/2026

- Operador confirmou anteriormente o recebimento de mensagem simples com onboarding@resend.dev.
- Checkout confirmado por git rev-parse HEAD: e501e4e5bda242ff71f636b2ab2c7b4e553a81af (PR #249). CI geral 45394048957, PG18 45394049025 e navegador 45394049006 SUCCESS. Railway API f5ea1afb-302b-4c07-a9d3-39bea347534c e web 92f38e11-abe3-47dd-9d85-c3fa97207ca3 SUCCESS no mesmo SHA.
- Ensaio em Docker Desktop local, Node 22.23.5, PostgreSQL 18-alpine, rede dedicada kanto-mail-drill-net, sem publicação de portas, contêiner Node compartilhando namespace de rede do PostgreSQL descartável kanto-mail-drill-db. A conexão do ensaio usa 127.0.0.1/kanto_mail_drill. Operador apresentou instalação de dependências e 25 migrações aplicadas. Nenhuma conexão com Railway necessária.
- Operador executou npm run drill:resend:journey --prefix services/api com autorização manual. Confirmou recebimento do primeiro link na caixa própria e forneceu o link ao terminal privado. Captura do relatório final mostra os dois recibos distintos e os resultados:
  - verification providerMessageId 01a20dad-aec4-7723-a2d7-030f5dcd2c33; acknowledgedAtUtc 2026-11-24T13:10:16.041Z.
  - reset providerMessageId 01a20daf-fd4b-7a5a-b327-25bbaadaf43c; acknowledgedAtUtc 2026-11-24T13:12:47.207Z.
  - httpJourneyPassed=true, inboxLinksConsumed=true, reusedLinksRejected=true, oldSessionRevoked=true, oldPasswordRejected=true.
  - providerDeliveryEventVerified=false, senderDomainVerified=false, publicRegistrationAuthorized=false.
- A evidência comprova jornada HTTP real no ambiente local com aceite do provedor e consumo dos links apresentados pelo operador. Não comprova, por si só, evento Delivered do provedor, identidade independente do operador/revisor, horário de observação/consumo em caixa, expiração em ensaio real ou entrega ao público. Expiração e fluxo HTTPS no navegador foram testados separadamente em CI. Não registrar chave, endereço, senha, links ou token. Capturas originais permanecem com operador.

## Próximas ações

1. Conferir os dois identificadores no painel Resend > Emails, registrar status e horário de evento Delivered se apresentado, sem expor destinatário ou corpo. A observação é pelo operador; não substituir ID de evento por ID de mensagem nem inventar referência.
2. Encerrar contêiner Node, limpar variável temporária do CMD e parar somente kanto-mail-drill-db local (--rm); remover rede dedicada quando vazia. Não apagar imagens, cópia local, containers de terceiros ou Railway. Descarte da base local contém somente conta fictícia e foi planejado pelo ensaio; conferir nomes antes.
3. Domínio/nome definitivo adiados. Remetente sandbox não satisfaz gate 23D6. Revisão independente, expiração operacional, domínio verificado e evidências formais continuam pendentes. Gate 23D5 de restore integral (isolamento por ambiente, checksums, RPO/RTO) também pendente; LGPD e segurança não dispensados.
4. Manter cadastro público OFF, /play local sem migração, Regiões 1v1 e Ginásios 3v3. Não promover modo de teste ou chave para Railway. Próxima frente de desenvolvimento: finalizar revisão de segurança e privacidade, sem bloquear trabalho pelo nome provisório.

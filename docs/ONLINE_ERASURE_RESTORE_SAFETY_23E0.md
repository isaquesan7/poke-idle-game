# ONLINE-01C-23E0 — Exclusões após um backup: prevenir reintrodução de contas

## Contexto

O sucesso de um restore não prova que ele respeita exclusões de contas ocorridas após o ponto recuperado. Se um backup criado na segunda-feira for restaurado na quarta-feira, uma conta excluída na terça-feira poderá reaparecer. Este caso precisa de tratamento **antes** de liberar exclusão definitiva ou restauração como banco de produção.

## Implementado neste recorte

- `evaluateDeletionAfterRestoreDrill` é um verificador **offline** de consistência de um ensaio feito em ambiente isolado. Exige referência ao backup e restore, horários UTC em ordem válida, inventário de exclusões posteriores ao ponto de recuperação, reconciliação de contagens, comprovação externa de ledger de exclusões, revarredura do banco restaurado e revisão por pessoas diferentes.
- Mesmo com todos os campos coerentes, o resultado **nunca** autoriza apontar a API de produção para o banco restaurado (`productionRestorePermitted:false`).
- Testes unitários com valores inteiramente sintéticos rejeitam exclusões não reconciliadas, ausência de ledger, revisão no futuro, falta de isolamento e alegações incorretas.

## O que NÃO foi implementado nem comprovado

- Não existe ainda ledger externo durável de pedidos de exclusão, nem mecanismo validado de replay. Não foram criados tokens, tabelas ou endpoints de exclusão em produção.
- Este verificador não consulta Railway, provedores de e-mail, backups reais ou identidades de jogadores. Declarações do operador precisam de prova independente.
- Não há validação de retenção legal, nem garantia sobre cache, logs, analíticas, envios Resend ou restauração posterior de backups históricos.
- Os gates LGPD/exportação/exclusão e restore REAL permanecem bloqueados.

## Procedimento que precisará ser desenvolvido

1. Definir e revisar base legal, retenções e estratégia de limpeza com revisor autorizado.
2. Projetar trilha externa imutável **minimizada e pseudonimizada** de exclusões, independente da base restaurada, sem guardar e-mails, senhas ou tokens; conferir medidas contra adulteração e expiração.
3. Restaurar backup Railway em **outro ambiente e serviço** sem apontar produção para o clone.
4. Comparar ponto recuperado com o ledger externo, reaplicar exclusões autorizadas só no clone, revalidar integridade e verificar zero contas reintroduzidas.
5. Revisor independente aprova o procedimento operacional. A liberação real de restauração/exclusão exigirá implementação específica, testes de autorização e nova decisão explícita.

Todos os códigos desta etapa preservam /play local, Regiões 1v1, Ginásios 3v3, HMAC, recompensas e cadastro público OFF.

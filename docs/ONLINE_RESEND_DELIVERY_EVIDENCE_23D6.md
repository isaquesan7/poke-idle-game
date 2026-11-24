# ONLINE-01C-23D6 — Evidência real de e-mail Resend (sem envio nesta etapa)

O código exige **comprovação separada da aceitação da API e entrega na caixa postal**: resposta 2xx do Resend é apenas aceite, não prova recebimento do e-mail. Nenhuma credencial ou mensagem real é enviada por este recorte.

## Processo operacional (a executar fora do ambiente público)

1. Validar domínio remetente real, DNS e configuração Resend num ambiente isolado. Credencial somente no backend isolado e não em GitHub, logs ou navegador. Usar caixa postal de teste controlada. **Não ativar registro público**.
2. Executar cadastro de teste e verificar emissão e efetiva entrega. Guardar referência não secreta do evento de entrega do provedor e referência separada da observação na caixa postal; não salvar token, corpo do e-mail ou endereço pessoal.
3. Confirmar link válido de verificação, segundo uso recusado, fluxo de reset com novo ID de entrega e recebimento efetivo. Comprovar recusa de token vencido e reuso.
4. Associar commit da aplicação e horários UTC de envio, entrega, observação na caixa, abertura/consumo e revisão final. Registrar operador e revisor distintos. Não usar documentação, mocks, HTTP 200 de teste ou um único recibo para atestar os dois fluxos.
5. Preencher `gates.resend.drill` do `check:beta-readiness` fora do repositório, com:
   - `provider:'resend'`, `environment:'isolated'`, `productionDeliveryDisabled:true`, `controlledTestRecipient:true`
   - `senderDomainVerified:true`, `domainProofRef`, `appCommitSha`, `operator`, `reviewer`
   - `verification` e `reset` com `providerMessageId`, `providerDeliveryEventId`, `inboxObservationRef`, `sentAtUtc`, `deliveredAtUtc`, `inboxObservedAtUtc`, `linkUsedAtUtc`, `providerDeliveryEventVerified:true`, `inboxReceiptVerified:true`, `tokenConsumedOnceVerified:true`
   - `expiredTokenRejectedAtUtc`, `expiredTokenRejectedVerified:true`, `reusedTokenRejectedVerified:true`, `reviewedAtUtc`
6. Verificar a consistência com o avaliador offline. Esta ferramenta **não consulta o Resend, não valida a veracidade da comprovação e nunca habilita o cadastro**. É obrigatório avaliar as evidências originais de forma independente.

## Estado e limites

A execução de entrega real continua bloqueada até que domínio, remetente, acesso controlado, retenção e canal de testes estejam comprovados. Os testes adicionados são somente unitários e com valores sintéticos. Não há novos endpoints nem mudanças na engine.

A PR depende da etapa 23D5, que exige um restore REAL, isolado e comprovado do Railway. Os gates `restore`, `resend`, `privacy` e `security` continuam pendentes na operação real. `/play` permanece local e não migra save, Regiões 1v1 `team[0]` e Ginásios 3v3 por trio configurado na Coleção.

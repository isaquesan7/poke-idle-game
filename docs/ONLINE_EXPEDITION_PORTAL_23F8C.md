# 23F8C — interface de expedições


## ONLINE-01C-23F8C — painel de expedições CI-only
- Dependente #281, branch separada de #279: futura reconciliação deve preservar ambos os painéis. Timer monotônico de apresentação ancorado no horário PostgreSQL, iniciado em startedAt, não reinicia em claim; cursor separado lastClaimAt, cap visual 2880 ciclos. Preview autoritativo no último sincronismo e botão atualizar; nunca inventar estimativa econômica no browser. Seleção regional, líder, start/claim/stop, bloqueio de batalhas/Coleção/atributos, releitura após erro e logout limpa estado. E2E browser usa botões reais, reload e cap fixture; CI pendente. Sem alterar economia, motor, SQL, /play ou cadastro.

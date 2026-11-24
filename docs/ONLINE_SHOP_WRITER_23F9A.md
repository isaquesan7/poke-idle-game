# 23F9A — Loja autoritativa


## ONLINE-01C-23F9A — loja privada autoritativa
- Reutiliza catálogo e reducer D064BQ: Poké 600/Nv1/máx50, Great 2400/Nv20/máx25, Ultra 16000/Nv55/máx10. Master fora da loja. Saldo e estoque no PostgreSQL, lock/CAS/receipt, rejeita preço vindo do cliente, cap100k, bloqueia reserva regional/Gym/expedição. Duplicata retorna conflito e requer releitura, nunca cobra novamente. Teste PG18 descartável cobre preços, bloqueios, saldo/estoque, concorrência e cap. Ainda sem HTTP/UI; CI obrigatório. Cadastro OFF, economia e /play intactos.

# 23F9B — Loja API e painel


## ONLINE-01C-23F9B — API e painel loja CI-only
- Ampliado #283, sem criar PR paralelo adicional. GET shop/current e POST purchase autenticados, sessão verificada, CSRF e throttle, flag test/PG18 descartável. Vitrine de três itens, nível, saldo/estoque, quantidade e total; preço mostrado não é enviado no checkout, débito exclusivamente servidor, UI atualiza após resposta. E2E real proxy/compra/duplicata/preço forjado/reload. Produção fail closed. CI final obrigatório e integração ordenada após #278/#279/#282 para evitar conflitos. Nenhuma mudança preços/SQL/cadastro /play.

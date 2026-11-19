# D-054 — Inventário real: transações offline e migração explícita

Esta fase é **preparatória**. Não cria preços, recompensas, expansores, nem altera a jogabilidade atual.

## Código criado

**packages/game-core/src/inventory/transactions.ts**: oferece duas rotinas puras, somente para auditoria/testes de domínio. Nenhuma delas é exportada pela API principal ou chamada pelos botões.

- **planLegacyEquipmentMigration** examina o save legado e produz uma proposta de migração, SEM persistência. Conserva somente os equipamentos atualmente equipados (um exemplar por ID), valida slots e catálogo, mantém moedas/XP/Pokémon/badges/stones intactos, começa com zero expansões. Recusa saves inválidos e não reprocessa um ledger já existente.
- **applyAuthorizedInventoryGrant** recebe envelope com raw, revision e receipts, mais a revisão esperada e uma proposta de grant de equipamento ou capacidade. Usa ID único do evento e conteúdo do grant para prevenir duplicação ou conflitos. Recusa IDs forjados, revisão obsoleta, itens não catalogados, pilhas acima de 99, capacidade extra acima de 1000, journal inválido e save ainda sem migração. O reducer não grava arquivos nem armazenamento.

**ATENÇÃO:** o nome Authorized indica uma PRÉ-CONDIÇÃO, não autenticação. O eventId passado pelo cliente NÃO prova uma conquista. Este código é laboratório; jamais expor seu comando à UI, API pública ou writer sem a camada de autoridade que deriva grants de eventos reais e sem persistência transacional única.

## Regras de aquisição que ainda precisam ser definidas

Recomendação de produto para discussão posterior: equipamentos obtidos por marcos verificáveis da Arena/expedições ou compras, sem grant por clique. Expansor da Mochila requer item catalogado, regras de preço/drop/uso, quantidade de slots por uso e limite máximo. Estas propostas NÃO foram ativadas nem fixadas no código.

## Próximas etapas

1. Aprovar eventos/fonte de aquisição, tabela econômica, preços e raridades.
2. Implementar autorização verdadeira derivada do estado de jogo e integração ao RewardJournal e à única revisão persistida; preservar concorrência e idempotência.
3. Validar migração explícita e auditável sem inventar itens, preservando o equipamento já em uso e os dados de evolução.
4. Ligar propriedade real ao grid, grants ao inventário, consumo do expansor e rollback. Testar PC/mobile e sobrecapacidade.
5. Manter TM09 indisponível até existir inventário transacional, writer de ensino e motor de combate correspondente.

## Preservação e gates

Executar TypeScript, testes de domínio, regressão legada, Playwright PC/mobile e Docker. A suite inventory-transactions.test.ts cobre migração, integridade de estado, grants repetidos, conflitos, revisões e limites.

Não alterar esquema/chave do save v0.2, 151 GIFs, arte original do treinador, combate, TM09, a rota / legada ou o repositório isaquesan7/pokedex.

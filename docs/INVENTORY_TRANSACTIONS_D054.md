# D-054 — Inventário real: transações offline e migração explícita

Esta fase é **preparatória**. Não cria preços, recompensas, expansores, nem altera a jogabilidade atual.

## Código criado

**packages/game-core/src/inventory/transactions.ts**: oferece duas rotinas puras, somente para auditoria/testes de domínio. Nenhuma delas é exportada pela API principal ou chamada pelos botões.

- **planLegacyEquipmentMigration** examina o save legado e produz uma proposta de migração, SEM persistência. Conserva somente os equipamentos atualmente equipados (um exemplar por ID), valida slots e catálogo, mantém moedas/XP/Pokémon/badges/stones intactos, começa com zero expansões. Recusa saves inválidos e não reprocessa um ledger já existente.
- **applyAuthorizedInventoryGrant** recebe envelope com raw, revision e receipts, mais a revisão esperada e uma proposta de grant de equipamento ou capacidade. Usa ID único do evento e conteúdo do grant para prevenir duplicação ou conflitos. Recusa IDs forjados, revisão obsoleta, itens não catalogados, pilhas acima de 99, capacidade extra acima de 1000, journal inválido e save ainda sem migração. O reducer não grava arquivos nem armazenamento.

**ATENÇÃO:** o nome Authorized indica uma PRÉ-CONDIÇÃO, não autenticação. O eventId passado pelo cliente NÃO prova uma conquista. Este código é laboratório; jamais expor seu comando à UI, API pública ou writer sem a camada de autoridade que deriva grants de eventos reais e sem persistência transacional única.

## Regras de aquisição que ainda precisam ser definidas

**DECISÃO APROVADA EM 19/11/2026: aquisição exclusiva na LOJA** para (1) equipamentos de todas as raridades, (2) itens de expansão da Mochila, (3) Pokébolas e (4) itens de cura. **Nunca conceder itens dessas quatro categorias por drop ou crafting**, ainda que sejam raros. Arena/expedições podem conceder recursos/moedas/materiais que depois são usados na compra, mas NÃO concedem diretamente equipamentos.

**Drops** destinam-se a excitação, materiais e otimização, privilegiando raridades altas e possíveis rolagens variáveis em itens elegíveis; não podem condicionar o avanço da história principal à sorte. **Crafting** entrega progressão determinística e consumo planejado de recursos, com receitas e atributos alvos, sem criar equipamentos/expansões/Pokébolas/cura. **Loja** fornece aquisição confiável e controle econômico; raridades comuns/incomuns são a base, mas equipamentos raros, se oferecidos, continuam exclusivos de compra e devem exigir condições/custo apropriados, não apenas moedas comuns fáceis.

A política explícita fica em `packages/game-core/src/inventory/acquisitionPolicy.ts`, testada por `inventory-acquisition-policy.test.ts`. O teste bloqueia origem `drop` ou `craft` para os quatro grupos. Categorias de materiais/refinados ainda não catalogadas permanecem fechadas até existir catálogo de drop/receitas. **Não há writer de compra, preço aprovado, disponibilidade, economia monetária ou alteração de gameplay nesta etapa.**

O expansor precisa de item catalogado, preço, regra de compra e uso, quantidade de slots acrescentados e limite máximo. Pokébolas e itens de cura precisam de catálogo, estoques, consumos, efeitos e valores de compra. Equipamentos precisam de raridade, preço, requisitos, bônus e validação de posse. Essas definições são etapas de implementação posteriores, sem decisões numéricas presumidas.

## Próximas etapas

1. Fonte de aquisição dos quatro grupos já aprovada: **Loja**. Definir catálogo de materiais/drops/receitas e detalhar tabela econômica, preços e raridades da Loja.
2. Implementar transação de **compra** validando preço, saldo, requisitos e capacidade, com débito e concessão no mesmo commit, integrando recibos ao RewardJournal e à única revisão persistida; preservar concorrência, idempotência e origem autorizada. Bloquear criação/drop de produtos exclusivos.
3. Validar migração explícita e auditável sem inventar itens, preservando o equipamento já em uso e os dados de evolução.
4. Ligar propriedade real ao grid, grants ao inventário, consumo do expansor e rollback. Testar PC/mobile e sobrecapacidade.
5. Manter TM09 indisponível até existir inventário transacional, writer de ensino e motor de combate correspondente.

## Preservação e gates

Executar TypeScript, testes de domínio, regressão legada, Playwright PC/mobile e Docker. A suite inventory-transactions.test.ts cobre migração, integridade de estado, grants repetidos, conflitos, revisões e limites.

Não alterar esquema/chave do save v0.2, 151 GIFs, arte original do treinador, combate, TM09, a rota / legada ou o repositório isaquesan7/pokedex.

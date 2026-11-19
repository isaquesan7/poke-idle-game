# D-054 — Inventário real: transações offline e migração explícita

Esta fase é **preparatória**. Não cria preços, recompensas, expansores, nem altera a jogabilidade atual.

## Código criado

**packages/game-core/src/inventory/transactions.ts**: oferece duas rotinas puras, somente para auditoria/testes de domínio. Nenhuma delas é exportada pela API principal ou chamada pelos botões.

- **planLegacyEquipmentMigration** examina o save legado e produz uma proposta de migração, SEM persistência. Conserva somente os equipamentos atualmente equipados (um exemplar por ID), valida slots e catálogo, mantém moedas/XP/Pokémon/badges/stones intactos, começa com zero expansões. Recusa saves inválidos e não reprocessa um ledger já existente.
- **applyAuthorizedInventoryGrant** recebe envelope com raw, revision e receipts, mais a revisão esperada e uma proposta de grant de equipamento ou capacidade. Usa ID único do evento e conteúdo do grant para prevenir duplicação ou conflitos. Recusa IDs forjados, revisão obsoleta, itens não catalogados, pilhas acima de 99, capacidade extra acima de 1000, journal inválido e save ainda sem migração. O reducer não grava arquivos nem armazenamento.

**ATENÇÃO:** o nome Authorized indica uma PRÉ-CONDIÇÃO, não autenticação. O eventId passado pelo cliente NÃO prova uma conquista. Este código é laboratório; jamais expor seu comando à UI, API pública ou writer sem a camada de autoridade que deriva grants de eventos reais e sem persistência transacional única.

## Regras de aquisição que ainda precisam ser definidas

**CORREÇÃO EXPRESSA DA DECISÃO (19/11/2026) — EQUIPAMENTOS TÊM TRÊS FONTES:**
- **Equipamentos:** podem ser comprados na **Loja**, obtidos como **drop** ou produzidos por **crafting**. Raridade, atributos/rolagens, requisitos/receitas e probabilidades de cada item ainda serão definidos; não presumir valores nem ativar chances/crafts genéricos.
- **Expansões da Mochila, Pokébolas e itens de cura:** **somente comprados na Loja**; estas três categorias permanecem proibidas em drops e crafting.
- **Drop:** variedade, raridades altas e rolagens de atributos quando definidas no catálogo; RNG não pode bloquear o progresso da história.
- **Crafting:** progressão determinística e consumo de materiais, incluindo equipamentos de raridade/atributos alvos quando receitas forem aprovadas; receitas não devem custar desproporcionalmente mais que recompensas de drops.
- **Loja:** acesso confiável a equipamentos apropriados e compra exclusiva dos três grupos definidos; não comercializar automaticamente o melhor equipamento apenas por moeda comum sem esforço.

A elegibilidade das três fontes de equipamento é definida em `inventory/acquisitionPolicy.ts` e validada em testes. **Elegibilidade de categoria não é concessão autorizada**: só poderão ser efetivamente concedidos equipamentos via drop/crafting quando existirem tabelas verificadas de drop, receitas, regras de raridade e uma transação de recompensa com origem comprovada. O reducer de laboratório usa `source` no fingerprint, mas uma string enviada pelo jogador não comprova a origem. Os demais grupos seguem bloqueados sem catálogo.

**A orientação anterior de que equipamento era exclusivo da Loja foi revogada.** Não reutilizar texto antigo de comentários/planos como regra.

O expansor precisa de item catalogado, preço, regra de compra e uso, quantidade de slots acrescentados e limite máximo. Pokébolas e itens de cura precisam de catálogo, estoques, consumos, efeitos e valores de compra. Equipamentos precisam de raridade, preço, requisitos, bônus e validação de posse. Essas definições são etapas de implementação posteriores, sem decisões numéricas presumidas.

## Próximas etapas

1. Fontes aprovadas: equipamentos **Loja/drop/crafting**, os outros três grupos **só Loja**. Definir depois catálogo de equipamentos, raridades, faixas de atributos, receitas/requisitos, % de drop e preços da Loja.
2. Implementar autorização transacional distinta para **compra**, **drop** e **crafting** de equipamentos (cada uma com validação apropriada), com revisão/recibos duráveis e sem duplicações. A compra deverá debitar moedas e conceder o produto no mesmo commit. Drops e receitas só poderão operar com tabelas aprovadas. Bloquear drops e crafting de expansões/Pokébolas/cura.
3. Validar migração explícita e auditável sem inventar itens, preservando o equipamento já em uso e os dados de evolução.
4. Ligar propriedade real ao grid, grants ao inventário, consumo do expansor e rollback. Testar PC/mobile e sobrecapacidade.
5. Manter TM09 indisponível até existir inventário transacional, writer de ensino e motor de combate correspondente.

## Preservação e gates

Executar TypeScript, testes de domínio, regressão legada, Playwright PC/mobile e Docker. A suite inventory-transactions.test.ts cobre migração, integridade de estado, grants repetidos, conflitos, revisões e limites.

Não alterar esquema/chave do save v0.2, 151 GIFs, arte original do treinador, combate, TM09, a rota / legada ou o repositório isaquesan7/pokedex.

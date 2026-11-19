# D-056 — Refinamento do Perfil, Evolução e Golpes do Pokémon

## Mudanças implementadas
- Perfil: cartão de arte/identidade e Treinamento Pokémon lado a lado no desktop, em coluna no mobile. Mantidos GIF original, UID, nível, afinidade e papel na equipe.
- Atributos: PokemonTraining.tsx replica a prévia do Treinador. Os botões +1 e − só mudam o rascunho React, nunca o save. Barras de prévia, pontos disponíveis, Cancelar, Confirmar e Redistribuir. O rascunho está isolado por UID e por revisão.
- Escrita: action pokemon-invest-batch é validada pelo core reduceLegacyPokemonTeamJson para cada ponto sobre candidato temporário. Apenas um commit/revisão por confirmação. UID falso, campo inválido, orçamento excedido, revisão desatualizada e falhas no último ponto nunca gravam parte do lote.
- Evolução: texto alterado exatamente para 'Treine seu Pokémon para que ele possa evoluir.'. Removidos kit de teste, listagem do estoque de pedras e disclaimers. Requisitos de evolução legítimos (inclusive pedra) e validação real de nível/consumo no writer foram preservados.
- Golpes: removidos textos internos sobre SP/Concentrar/IA/recorte. Seções visuais de golpes Equipados (quatro slots visíveis) e Aprendidos, com cards, ícones, estado Principal/Equipado, poder/PP/SP/rank quando relevante e botões de ações com ícones. Todos os writers de golpes são os anteriores.

## Testes
- apps/web/src/play/pokemonBatch.test.ts: uma revisão com múltiplos incrementos, sem alterações em moedas/roster/treinador; rejeitar UID inexistente, orçamento extrapolado, lote vazio, dados inválidos e revisão obsoleta.
- apps/web/tests/e2e/playable-route.mjs: perfil lado a lado no desktop, prévia/desfazer/cancelar sem gravação, confirmação de +1 DEF em uma revisão, Evolução sem kit, Golpes com seções e sem textos internos, além das jornadas anteriores.
- Gates: TypeScript/Vitest/Playwright desktop e mobile e Docker, capturas visuais.

## Compatibilidade
- Preservar schema2 e chave kanto-idle-play-v02, combate, regras de evolução e movimentos, TM09, 151 GIFs, avatar original, rota legada / e isaquesan7/pokedex.
- Itens, raridades, drops e crafting continuam pendentes na PR #78; D056 não altera economia.
- A interface do kit foi removida, sem editar a regra de domínio das pedras ou inventar fonte de obtenção; o comando de kit experimental permanece isolado sem botão de UI nesta etapa.
- Não publicar antes de testes e autorização.
- Ajuste de precisão D056: a prévia de status Pokémon usa obrigatoriamente pokemonFinalStats do game-core sobre os pontos manuais projetados, inclusive HP (+2 finais por ponto manual) e contribuições do Treinador/afinidade; evita prévia numérica linear incorreta. E2E confirma HP preview +2, desfaz e garante zero escrita antes do commit.

- E2E D056: jornada de dois Pidgey independentes por UID atualizada para usar prévia + confirmação de SPD (não mais incremento imediato). Confirma revisão intacta antes do commit, depois incremento somente no UID selecionado, preservando o primeiro exemplar.

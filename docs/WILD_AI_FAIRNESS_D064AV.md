# D-064AV — auditoria da IA e golpes de selvagens

**21/11/2026 — branch em validação.**

## Problema comprovado
Em `apps/web/src/play/playSave.ts`, o combatente do jogador recebia `moves` (até quatro slots selecionados), enquanto o selvagem era construído apenas com `move:enemy.move`, sem array `moves`. O core `simulateKantoBattle` usa a **mesma função `choose` para os dois lados**, mas o selvagem só conhecia o golpe padrão provisório. Assim ele não usava golpes novos, inclusive Twineedle, Rock Blast, Night Shade, sono, status etc., a menos que coincidissem com seu golpe padrão.

## Política de justiça adotada
- O selvagem recebe golpes apenas de `kantoLevelMoves(speciesId,level)` e `kantoSupportMoves(speciesId,level)`, as **mesmas funções de elegibilidade** oferecidas para slots do treinador. Só recorte FRLG validado e golpes executáveis, sem TMs.
- Até **3 ofensivos de aprendizado mais recente** e **1 suporte mais recente**: quatro slots no máximo, estáveis, selecionados sem RNG extra e sem olhar os atributos/equipamentos do jogador. Esse é um moveset automático para a alfa, não simulação exata dos quatro golpes nas cartuchas Gen III. O jogador segue administrando seus próprios slots.
- Quando a espécie ainda não dispõe de ataque ofensivo implementado por nível, preservar apenas seu **golpe padrão provisório**, que já estava disponível na alfa, com eventual suporte desbloqueado. Não inventar um ataque de nível futuro.
- O selvagem permanece com stats de `pokemonOwnStats`, `rank:0`, sem atributos manuais, bônus do treinador, badges ou itens. **Não recebe SP extra nem bonificações ocultas.** IA, turnos, cooldown de Concentrar, prioridades, precisão, SP, efeitos por hit, sono e RNG seguem o **mesmo motor compartilhado**.
- A seleção usa somente espécie/nível. A seed continua controlando encontro, ordem de ação e efeitos do combate; a formação do moveset não realiza sorteios extras. Não altera captura, balls, sorteio da região, XP, economia, save, Pokédex ou GIFs.
- Essa mudança pode aumentar a dificuldade de alguns encontros: antes os selvagens tinham golpe único. Evitar prometer win-rate 50/50; vencer depende do nível, atributos, tipo, equipe, builds e SP. Analisar relatórios de win-rate antes de ajustar poderes.

## Cobertura
`packages/game-core/tests/d064av-wild-ai-fairness.test.ts` verifica elegibilidade/limites para 151 espécies × sete níveis (1.057 loadouts), exemplos de Twineedle/Rock Blast/Night Shade/Sleep Powder, sem TM09, ataque fallback, SP, simulação deterministicamente espelhada e registro real de Twineedle pelo lado selvagem. `apps/web/src/play/playSave.ts` passou a utilizar o novo helper `kantoWildMoveLoadout`.

**Gate:** TypeScript/Vitest, E2E v0.1/v0.2, React desktop/mobile, Playwright isolado e Docker/HTTP no HEAD; publicação Railway no SHA exato após CI aprovado. Não declarar release antes de deploy SUCCESS.

**Próxima:** instrumentar níveis/seleção de ataques por região e win-rate por equipe real com writer, incluindo tempo do replay PC/celular, antes de modificar os números de dano/XP/progressão.

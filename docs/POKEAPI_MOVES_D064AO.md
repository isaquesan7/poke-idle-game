# D-064AO — Expansão de golpes FireRed/LeafGreen com PokéAPI

**Data:** 21/11/2026 · **Escopo:** catálogo estático de level-up, integração segura ao motor, testes e documentação.

## Fontes e cobertura

Snapshot *reproduzível e sem consultas externas em runtime* do repositório oficial [PokeAPI/pokeapi](https://github.com/PokeAPI/pokeapi/tree/ac2f1acb055026e3dff1e0aca743bb46256a810a/data/v2/csv), commit `ac2f1acb055026e3dff1e0aca743bb46256a810a`.

- `pokemon_moves.csv`, blob `f66f614adf535af6940c65f434efe5ddeec4687a`: grupo 7 FireRed/LeafGreen; método 1 level-up; IDs Pokémon #1–151, **1.536 entradas**, **151 espécies cobertas**.
- `moves.csv` e `types.csv`: **273 movimentos distintos**, com nome, tipo, poder, dano físico/especial/status, precisão, prioridade e PP.
- `move_meta.csv`: categoria dos efeitos, faixa de multi-hit, usados para impedir execução quando faltar um efeito fiel ao motor.
- Os metadados de poder/classe/PP são do **snapshot atual PokéAPI** mesmo para aprendizados FRLG (como os movimentos alfa anteriores); não representam todas as estatísticas históricas da geração III. A política D048 das futuras TMs *historicamente versionadas* continua em vigor.
- Não utilizar a API ao executar o jogo. `kantoFrlgLevelMoveCatalog` expõe toda a lista **para consulta e auditoria**; somente golpes suportados entram no inventário equipável.

## Efeitos disponíveis e bloqueados

O catálogo de referência inclui os 273 golpes, inclusive status e técnicas ainda não implementadas. O motor permite **52 movimentos ofensivos únicos vindos da fonte FRLG** cujos efeitos são atualmente suportados: dano direto (1), envenenamento secundário (3), drenagem de HP (4), queimadura secundária (5), paralisia secundária (7), golpes que nunca erram (18), redução de velocidade (71) e prioridade (104). Os movimentos já usados pelo jogo permanecem intactos, incluindo Double Kick com dois acertos e Recover; o catálogo total de golpes executáveis pode ultrapassar 52 por causa desses movimentos legados.

**Exemplos adicionados à seleção de golpes por nível:** Lick e Shadow Punch para Gengar, Flamethrower, Thunderbolt, Sludge Bomb, Giga Drain, Aerial Ace, Icy Wind, Mach Punch. PP e efeitos compatíveis são fornecidos pelo mesmo snapshot. O motor ainda controla SP, IA, limites de turnos, visualização e recompensas.

Não habilitar como ação equipável os movimentos que exigem mecânicas ainda ausentes: sono, confusão, taxa elevada de crítico, recoil, autodestruição, dano fixo, KO instantâneo, trap, substituto, debuffs não suportados, combinações especiais e multi-hits variáveis. Um exemplo: **Hypnosis, Night Shade e Shadow Ball** aparecem na fonte de Gengar mas ficam somente no catálogo de consulta; não simular esses efeitos como ataques normais. A presença em PokéAPI **não autoriza TM**, move tutor ou egg move.

## Persistência e regras mantidas

- `kantoLevelMoves` agrega golpes seguros do snapshot mantendo os antigos golpes (nome/poder/categoria/rank/UID), e o writer `pokemonMoveSlots` continua verificando aprendizado por nível e máximo de quatro slots.
- `KANTO_BATTLE_MOVES` passa a enxergar os novos golpes; `KANTO_MOVE_PP` e `KANTO_SECONDARY_EFFECTS` agora contemplam dados oficiais para esses golpes, preservando entradas já publicadas.
- Sem alterar XP treinador/Pokémon, SP máximo, chances de encontro, raridade, Pokébolas, drops, histórico de combate, expedições, saves locais, GIFs ou o repositório `isaquesan7/pokedex`.
- O jogo continua **não oficial e experimental**, sem garantias comerciais sobre uso de imagens ou marcas. Dados podem ser atualizados apenas em fases versionadas e com testes de regressão.

## Gates e próximos passos

1. TypeScript strict e testes do core e web, incluindo 151 espécies, 273 movimentos, 1.536 learnsets e equipagem/recusa para Gengar.
2. Playwright desktop/mobile /play /regions e GIF/replay isolados; smoke Docker, Railway SHA exato, serviço online e sem alertas.
3. **D-064AP:** simular trajetórias de captura/nível/equipe incorporando golpes recém-disponíveis; medir tempo real do diário em desktop/mobile; ampliar efeitos restantes por implementações explícitas com replay/SP/testes antes de liberação de status e multi-hit variáveis.

A auditoria D064AN utilizava Gengar apenas com Tackle; esta fase permite Lick e Shadow Punch pelo nível exigido, mas **a melhoria de win-rate ainda precisa ser medida novamente com esta versão**.

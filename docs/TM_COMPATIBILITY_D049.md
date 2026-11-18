# D-049 — extrator offline de compatibilidade TM09 (primeiro recorte)

**Data:** 18/11/2026. **Estado:** branch de trabalho; nenhuma TM liberada, nenhum combate ou save alterado.

## Implementado
- `scripts/extract-tm09-compatibility.mjs`: lê **arquivo local fornecido explicitamente**, valida SHA-1 Git blob completo **antes** de interpretar o CSV; usa snapshot fixo `PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a`, blob `f66f614adf535af6940c65f434efe5ddeec4687a`.
- Filtra exatamente `pokemon_id 1..151`, `version_group_id=7` (FRLG), `move_id=331` (Bullet Seed), `pokemon_move_method_id=4` (machine). Gera IDs distintos ordenados, contagem de linhas e origem; saída JSON contém `state: review-only-not-released`.
- Rejeita checksum errado, estrutura CSV/cabeçalho inválida, IDs inválidos, ausência de elegibilidade e criação acidental de artefato já existente (`--output` usa `wx`).
- `tests/tm09-compatibility-extractor.test.mjs`: fixtures locais com seleção positiva/negativa, deduplicação, filtro de versão/método, checksum, CSV escapado e falhas fechadas.
- Executar: `node scripts/extract-tm09-compatibility.mjs --input pokemon_moves.csv --output tm09-review.json` com arquivo **exato da origem fixada**. Este arquivo original NÃO é baixado em runtime e a lista real de compatibilidade NÃO foi incluída sem validação da fonte. O script pode emitir relatório no terminal sem `--output`.

## Restrições preservadas
O relatório gerado **não** é importado no core nem no browser e não autoriza ensino. `kantoTmIsTeachEnabled` continua deny-all; `bullet-seed` continua ausente do catálogo executável e multi-hit. Nenhuma moeda, item TM, drop, golpe, RNG, replay, SP, PP, save schema2, UI, GIF, animação FULL, Docker, `/`, `/play` ou repositório `isaquesan7/pokedex` é modificado.

## Próximas etapas obrigatórias
1. Obter `data/v2/csv/pokemon_moves.csv` do commit fixado e **executar a validação real** de blob; revisar a lista de espécies, cobertura de formas/evoluções e integridade do relatório antes de integrar compatibilidade positiva ao catálogo. Nenhuma espécie é declarada elegível por suposição.
2. Decidir economia de obtenção/consumo de TM09 e limite por jogador. Não conceder item por seed ou recompensas arbitrárias.
3. Implementar writer `teach-tm` em PR independente, com estoque, UID, slot1–4, revisão esperada, receipt idempotente e consumo/ensino atômicos; demonstrar rollback para todos os erros e persistência após evolução.
4. Só depois implementar 2–5 hits e custo SP histórico com testes determinísticos, KO antecipado, logs, replay e acessibilidade.
5. CI core/web, jogo legado, 151 GIFs, Chromium desktop/mobile e Docker; conferir merge e Railway apenas depois do resultado real. NVDA/VoiceOver manual e Picomatch no BUILD permanecem pendentes.

**Nota:** os testes com fixtures provam somente o comportamento do extrator; não substituem a verificação do CSV oficial nem testes de UI em Windows real.

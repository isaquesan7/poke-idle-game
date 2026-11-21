# D-064AU — Twineedle: poison por impacto

**Data:** 21/11/2026 — aguardando CI/merge/deploy.

## Fonte e elegibilidade
Snapshot estático PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a, version_group_id 7 / método 1: Twineedle ID 41, effect 78, `power 25`, `PP 20`, `accuracy 100`, tipo Bug/physical, `min_hits=max_hits=2`, `effect_chance 20`. Na Season 1 FRLG, Beedrill #15 aprende em **nível 20**. O writer de slots por UID e nível usa `kantoLevelMoves`, sem acesso remoto. Bullet Seed / TM09 seguem bloqueados.

## Resolução, IA, segurança
- Um teste de precisão (100%) e um custo SP por ação. Dois danos independentes e respectivos frames; crítico/variação por impacto, nenhum RNG para quantidade fixa. O custo SP usa dois impactos + bônus de efeito secundário uma única vez.
- Efeito secundário é processado **após cada impacto efetivo**, desde que o alvo ainda tenha HP. Cada oportunidade de envenenar tem 20% (LCG determinístico já usado no combate), sem roll desnecessário se o alvo está com status ou é imune a poison (tipo Poison/Steel).
- Ao envenenar, criar uma linha/frame de `status` com o índice do impacto no log, sem custo SP extra. Se o primeiro impacto envenenar, não tentar envenenar de novo no segundo. Dano residual de poison permanece o do motor ao final do turno.
- Não aplicar efeito após dano zero, imunidade de tipo Bug ou KO; não persistir status, contador ou mudanças de combate no roster. Se um ataque terminar antecipadamente, nenhum impacto posterior é emitido.
- Validação canônica anti-forgery dos stats de multi-hit; sem alteração do RNG de outros movimentos nem do fluxo de recarga/concentrar. `KANTO_PER_HIT_SECONDARY_EFFECTS` é allowlist específica; efeitos anteriores continuam sendo resolvidos após o ataque, sem dupla rolagem.

## Testes e limitações
`packages/game-core/tests/d064au-twineedle-per-hit.test.ts`: elegibilidade Beedrill Nv20, bloqueio Nv19/TM09, custo SP/PP, replay determinístico, logs/frames, imunidade por status, RNG por impacto e anti-adulteração. Regressão D064AT atualizada para reconhecer Twineedle na whitelist de multi-hit.

Este é um recorte de regras do Kanto Idle; não implica paridade exata do combate GenIII. Não altera XP, raridades, itens, captura, expedições, schema2 nem assets/GIFs. Verificar TypeScript/Vitest, E2E desktop/mobile, Playwright isolado e Docker/HTTP no HEAD antes do merge, e Railway SUCCESS no SHA após merge.

**Próxima etapa D064AV:** auditar efeitos secundários por impacto restantes e analisar progressão real com writer/expedições, incluindo cronômetro e animação do BattlePlayback desktop/mobile.

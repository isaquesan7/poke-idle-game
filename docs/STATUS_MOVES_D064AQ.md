# D-064AQ — liberação controlada de status FRLG (21/11/2026)

## Implementação
O snapshot PokéAPI fixo `PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a` (grupo7, método level-up1) contém movimentos de suporte que reutilizam **mecânicas já implementadas** sem ampliar o motor de sono/confusão/dano fixo.

| Golpe | Efeito | Exemplos de espécie / primeiro nível FRLG | Precisão | PP snapshot | SP próprio |
| --- | --- | --- | ---: | ---: | --- |
| Leer | Defesa alvo -1 estágio | Spearow #21 Nv7 | 100 | 30 | fórmula de escassez +10 |
| Stun Spore | Paralisia alvo | Oddish #43 Nv16 | 75 | 30 | fórmula de escassez +16 |
| Glare | Paralisia alvo | Ekans #23 Nv20 | 100 | 30 | fórmula de escassez +16 |

Learnsets consultados de `KANTO_FRLG_LEVELUP_ROWS` somente quando o nome está em allowlist fechada; `power:null` normalizado para 0. Os demais 270 nomes da prévia não são automaticamente liberados. Sem conexão externa no runtime.

A IA mantém uso único por batalha para suporte, turnos iniciais, SP cobrado antes de precisão e verificações de imunidade/condição já implementadas. São regras simplificadas de Kanto Idle, não emulação histórica completa de FireRed/LeafGreen. Evitar alegar fidelidade para status sem testes de geração III, efeitos próprios ou prioridades históricas. Novos status integram os slots de UID através do writer existente, sem alteração de schema2.

## Segurança e testes
`d064aq-frlg-status.test.ts` verifica corte de nível, PP/SP, IDs, UID, writer, bloqueio de aprendizagem prematura, simulação reprodutível, log/frame e ausência de Hypnosis. Não altera catálogo de TMs nem os dados dos 151 GIFs.

**Não implementados nesta etapa:** sleep/Hypnosis, confusão, dano fixo Night Shade, ataques multihit 2–5 Bullet Seed, buffs de múltiplos estágios, Toxic escalável ou efeitos que precisem RNG/turnos novos. A expansão de efeitos precisa de PRs de motor separados, com semântica especificada e testes de integridade dos replays.

## Gate e próximo passo
Verificar TypeScript/Vitest (core+web), E2E desktop/mobile e Docker no HEAD final. Nenhum merge ou deploy alegado até prova. D064AR: sono / dano fixo em design e implementação isolados; progressão com writer e medição real BattlePlayback seguem pendentes na D064AQ original.

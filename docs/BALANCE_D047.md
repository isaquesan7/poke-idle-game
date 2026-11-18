# D-047 — Double Kick por tipos e Recover nos limites críticos

**Data:** 18/11/2026 · **Estado: PUBLICADA** na PR #67, main `fca91202bc391bc2ebd4abe31183fbefed53a2a8`; CI final `44363512579 SUCCESS` (geral) e `44363512763 SUCCESS` (Docker); Railway deployment `2172dd7f-50e5-4fe0-bda2-0517b22e53f3 SUCCESS` com healthcheck interno /health. Sem GET público externo verificado diretamente.

Este documento complementa `docs/BALANCE_D046.md`. É **teste determinístico de laboratório**, nunca telemetria de jogadores. A D-047 não modifica `simulateKantoBattle`, custo de SP, RNG, IA, learnset, recompensas, `localStorage`, interface ou GIFs.

## Método de controle por eficácia de Fighting

- 6 espécies com Double Kick: Nidoran♀/Nidorina/Nidoqueen e Nidoran♂/Nidorino/Nidoking, níveis 15/30/60. 8 rivais, 8 seeds, total **1.152 pares / 2.304 simulações**. Cada par usa o mesmo atacante/defensor/stats e seed inicial: sem vs com Double Kick como golpe extra. Se a habilidade altera as decisões, o consumo posterior da seed pode divergir, portanto o resultado não mede apenas dano bruto.
- Rivais em grupos reais de eficácia `kantoTypeMultiplier('fighting',types)`: **×2** Rattata (Normal)/Geodude (Rock+Ground); **×1** Squirtle (Water)/Pikachu (Electric); **×0,5** Abra (Psychic)/Caterpie (Bug); **×0,25** Zubat (Poison+Flying); **×0** Gastly (Ghost+Poison). Grupos têm tamanhos diferentes; não combinar porcentagens sem pesos.
- Verificados: HP/SP nunca negativos nem maiores que o máximo, 1 frame por linha, 2 impactos salvo KO, 18 SP exclusivamente no primeiro frame, **IA não usa golpe imune**, seed estável, sem alterações em saves. Outros movimentos ofensivos do Pokémon (seleção por IA) continuam disponíveis — **não** é confronto cego apenas com Double Kick.
- Para isolar **dano bruto** de regra, foi construído **APENAS dentro do teste** um golpe *single Fighting power60*, físico e 100% de precisão, mesmo atacante/defensor/roll de crítico e variação, comparado a dois cálculos individuais de `kantoDamage` com Double Kick poder30. Esse controle **NÃO existe em catálogo, learnset, UI, PP/SP ou inventário e não é equipável**. É comparação numérica, não ensaio de custo ou taxa de vitória.

## Resultado reproduzido

Linha `D047_MATCHUP_REPORT` da CI **`44362107569 completed/success`**; no mesmo run `D047_POWER60_CONTROL`. O teste de 1.152 pares levou ~1,7s, sem falhas, e o teste de Recover foi aprovado (3 cenários).

| Eficácia Lutador | Pares | Vitória golpe-base → com Double Kick | Ganho (p.p.) | Batalhas que usaram Double Kick | Ações de Double Kick |
|---|---:|---:|---:|---:|---:|
| ×2 super efetivo | 288 | 61,81% → 86,81% | +25,00 | 100% | 452 |
| ×1 neutro | 288 | 62,50% → 79,86% | +17,36 | 100% | 584 |
| ×0,5 resistido | 288 | 100% → 100% | 0,00 | 0% | 0 |
| ×0,25 duplamente resistido | 144 | 100% → 100% | 0,00 | 0% | 0 |
| ×0 imune | 144 | 100% → 100% | 0,00 | 0% | 0 |

**Atenção:** resultados 100% nos grupos resistentes/imune refletem *apenas os matchups e golpes-base escolhidos*, não taxa universal de vitória, nem impossibilidade de resistir a lutador no game. A IA recusou Double Kick por pontuação inferior ou eficácia nula nesses rivais e assim o resultado dos pares ficou idêntico.

### Controle físico de mesmo tipo (sem turnos/SP)

| Eficácia Fighting | Média de 2×30 Double Kick | Média de 1×60 sintético |
|---|---:|---:|
| ×2 | 54,06 dano | 51,31 dano |
| ×1 | 28,22 | 26,81 |
| ×0,5 | 25,11 | 24,95 |
| ×0,25 | 8,44 | 8,50 |
| ×0 | 0 | 0 |

Em um sistema com arredondamentos, cálculos independentes de crítico/variação e constante da fórmula adicionada por golpe, 30×2 não equivale sempre a 60×1. **Não interpretar como bug ou motivo para nerf sem uma decisão do design**; o inventário/SP e a chance de KO intermediário não são comparados pelo teste de dano.

## Recover crítico e sem SP

A suíte `packages/game-core/tests/kanto-d047-recover-boundaries.test.ts` usa **atributos artificiais** e 16 seeds para cobrir situações raras em jogos normais:

1. Staryu Nv15 com `tackle` + `recover` e HP próprio chegando a até 50% e SP suficiente: Recover cura uma vez no máximo, consome 36 SP no frame de autocura, não supera HP máximo e não altera HP selvagem; preserva `log.length === frames.length`.
2. Mesmo Staryu com golpe `mega-kick` caro **somente na fixture de teste** — Staryu não o aprende nesse nível — consome 40 SP antes do limiar crítico: resta SP insuficiente, a IA não tenta Recover, não cria evento de cura falso e mantém replay determinístico. O aprendizado por espécie/nível no writer **não foi alterado**.
3. Com adversário fraco e HP próprio sempre acima do limiar, nenhum uso de Recover; não existe cura gratuita/redundante.

## Decisão de produto

**Manter Double Kick com poder 30×2 e 18 SP por ação e Recover com 36 SP/até uma autocura**, sem mudança de IA nesta etapa. A D-046 revelou grande vantagem vs golpe principal em oito rivais; D-047 mostra que ela depende fortemente da eficácia Fighting e da escolha do golpe alternativo. É uma explicação mais precisa, mas ainda não garante equilíbrio de PvE/arena em toda a Pokédex. Ampliar a comparação por rank do golpe, bônus de treinador, evolução/afinidade e rivais de níveis diferentes antes da beta.

**Bullet Seed continua NÃO executável nem equipável.** O teste `kanto-d047-tm-boundary.test.ts` confirma que a prévia de custo da PokéAPI moderna não adiciona golpe ao catálogo, e que `add`/`replace-primary` do writer rejeitam TM09 mesmo para Bulbasaur nível 100. A política de versão, compatibilidade, inventário, transação e replays está em `docs/TM_SYSTEM_DESIGN_D047.md`; **não há TM no jogo**. Fonte histórica do Bullet Seed FRLG: https://pokemondb.net/move/bullet-seed e https://www.dittobase.com/firered-and-leafgreen/items/tm09.

## Próximo passo D-048

- Decidir formalmente se os futuros TMs terão **metadados históricos GenIII** ou **metadados modernos** em coerência com o RPG, antes de criar catálogo multiversão ou motor 2–5 hits.
- Se aprovado, implementar inventário TM e writer idempotente, consumo atômico, learnsets positivos da versão FRLG, compatibilidade com evolução e teste de replays antigos, **sem habilitar Bullet Seed até tudo passar**.
- Validar acessibilidade manual NVDA/VoiceOver e Windows Edge/Chrome. O modo animação FULL compulsório da D-042 é decisão do proprietário, mas pode ser obstáculo de acessibilidade antes de beta.
- Continuar observação da dependência Picomatch no estágio Docker BUILD; nenhum servidor Vite dev é publicado.

**Compatibilidade D-047:** 151 GIFs, / legado, /play, jogo v0.2 schema2 `kanto-idle-play-v02`, writer de UIDs, HP/SP, Concentrar e replays permanecem inalterados. Nenhum deploy com lutas novas ou migração de save foi requerido por estes testes.

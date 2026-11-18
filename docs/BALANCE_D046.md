# D-046 — matriz pareada de balanceamento: Recover e Double Kick

**Data:** 18/11/2026 · **Estado: PUBLICADA PR #65**; PR integrada à main SHA `db1fe0601275d2840a7355e26f97433fc2589e0c`, CI final `44357355587 SUCCESS` (geral) e `44357355602 SUCCESS` (Docker), Railway deployment `81d23805-40ba-4eb6-a4ab-281946a483c0 SUCCESS` com `/health` interno aprovado. A suíte foi repetida antes, com relatório idêntico em `44356247481 SUCCESS`. GET externo público não aferido diretamente.

Este documento consolida as métricas sintéticas da rotina `packages/game-core/tests/kanto-d046-ability-balance.test.ts`. **Não é telemetria de jogadores reais**, amostragem probabilística do matchmaking nem compromisso de porcentagens de vitória. Sem alteração das fórmulas, loot/captura, learnsets, escritor de saves, cronômetro ou replays. O baseline D-040 de 1.920 simulações e o stress D-042 de 384 permanecem independentes.

## Método

- **4.608 confrontos pareados, 9.216 batalhas determinísticas:** controle com o golpe primário que a espécie já possuía vs o mesmo Pokémon com esse golpe + Recover ou Double Kick equipado. Mesmo par de espécies, nível, stats iniciais e seed. Cada configuração roda uma luta separada; quando o golpe equipado altera ações, os *rolls de RNG posteriores podem divergir*. Portanto, os deltas não isolam apenas dano/HP por golpe.
- **Espécies que recebem habilidade:** Recover Staryu #120 / Starmie #121 (2); Double Kick Nidoran♀ #29 / Nidorina #30 / Nidoqueen #31 / Nidoran♂ #32 / Nidorino #33 / Nidoking #34 (6), validadas pelo learnset FRLG do código. Níveis 15, 30 e 60. Rivais #1, #4, #7, #25, #74, #92, #95 e #143; seeds `0,1,7,19,31,53,107,169`.
- **Três modos:** `normal` usa `pokemonOwnStats` sem modificações. `fortified` multiplica artificialmente HP ×4 e as defesas ×5 de ambos para chegar ao teto30. `pressure` amplia HP de ambos ×3, atributos de dano do selvagem ×2 e as defesas dele ×2 para testar cura sob risco. **Stats artificiais jamais alteram o jogo**.
- A matriz confere HP/SP entre 0 e máximos, frames 1:1 com o diário, `Concentrar` sem custo e recuperação real de SP, Double Kick com 2 impactos fixos (interrompendo em KO), cobrança 18 SP uma só vez, Recover 36 SP e até1 uso antes do turno27 com HP<=50%, sem curar o inimigo ou ultrapassar HP máximo. Confrontos controlados não usam as habilidades novas.
- Fonte dos números: linha `D046_BALANCE_REPORT` nos logs do GitHub Actions do teste Vitest. **Na primeira execução houve timeout de 5s, embora os dados completos tenham sido emitidos (~22s); corrigido com timeout específico de 60s. Na repetição `44356247481 SUCCESS` o teste levou 18,5s e reproduziu as contagens (`4608` pares, `9216` lutas, `150` curas, `15960` eventos Double Kick, `1137` críticos). O commit final com documentação ainda precisará CI.**

## Comparação agregada por cenário

Cada linha agrega os três níveis (15, 30, 60) e mostra os dois grupos com os mesmos seeds/oponentes. Valores são **resultados da fixture**, não previsões de desempenho ao jogar.

| Cenário / golpe | Pares | Vitória sem → com golpe | Δ vitórias (p.p.) | Uso do golpe nos combates com ele | Δ duração média | Δ SP gasto médio |
|---|---:|---:|---:|---:|---:|---:|
| Normal · Recover | 384 | 63,54% → 65,36% | +1,82 | 25,00% (96 curas) | +0,40 turno | +11,20 SP |
| Normal · Double Kick | 1.152 | 56,25% → 75,87% | +19,62 | 75,00% (1.856 ações) | −1,13 turno | +0,08 SP |
| Fortificado · Recover | 384 | 4,95% → 4,95% | 0,00 | 0% (0 curas) | 0 turno | 0 SP |
| Fortificado · Double Kick | 1.152 | 0% → 0% | 0,00 | 75,00% (3.514 ações) | −0,08 turno | +0,26 SP |
| Pressão · Recover | 384 | 35,94% → 35,42% | −0,52 | 14,06% (54 curas) | +0,42 turno | +7,34 SP |
| Pressão · Double Kick | 1.152 | 12,59% → 12,50% | −0,09 | 75,00% (2.701 ações) | −0,16 turno | +6,72 SP |

No total, houve **150 usos de Recover** e **15.960 eventos de impacto de Double Kick**, incluindo **1.137 eventos críticos**. Essas contagens incluem o mesmo combate várias vezes na comparação estruturada e incluem stats artificiais. Double Kick pode encerrar após o primeiro hit por KO; `média impactos por ação` não deve ser tratada como chance de acertar.

## Interpretação para produto

1. **Recover não provocou loop ou domínio da arena:** a IA usa uma vez no máximo, e só quando HP<=50% com 36 SP. Em cenários fortificados, a resistência alta impede a queda até o limiar e Recover fica sem uso. Sob pressão pode ajudar HP mas também gastar um turno e SP, não gerando automaticamente vitória. **Manter regra D-045** até dados de uso real e variedade maior de oponentes.
2. **Double Kick merece vigilância:** nos confrontos normais selecionados, a vantagem de +19,62 pontos percentuais é alta quando comparada ao único golpe primário anterior (muitas vezes pouco favorável no tipo e sem dois hits); na pressão sintética sua vantagem praticamente desaparece. Não interpretar a diferença isoladamente como prova de erro matemático do poder30 ou do custo18. Próxima matriz deve separar alvo com fraqueza Fighting, resistência, imunidade Ghost e movimentos-base comparáveis em tipo/poder antes de reduzir valores.
3. **Longas fortificadas permanecem um stress, não o jogo normal:** mais de 90% do stress atinge limite de 30 turnos, mesmo sem Recover; o remédio não prolongou esse cenário porque não foi usado. Atingir 30 na fixture não justifica elevar limite de turnos no produto.
4. **Diário e cronômetro:** cada impacto tem seu evento/frame, mas a apresentação pode ficar mais longa que a contagem de turnos. Monitorar `meanJournalLines` nos logs; continuar informando que o cronômetro mede **apresentação**, não tempo de execução do motor. Replays antigos permanecem de leitura, sem pagamento ou prêmio adicional.

## Bullet Seed permanece bloqueado — decisão de dados por versão

O registro da PokéAPI moderna que embasa a prévia D-039 usa **poder25, categoria física, PP30**. Porém em **FireRed/LeafGreen (Geração III)**, Bullet Seed era **TM09, poder10 por hit, categoria especial**; não é correto misturar `power=25` moderno com `damage_class=special` de GenIII e chamá-lo de fiel ao FRLG. Fontes:
- https://pokemondb.net/move/bullet-seed
- https://bulbapedia.bulbagarden.net/wiki/Bullet_Seed_(move)
- https://bulbapedia.bulbagarden.net/wiki/Multistrike_move

Para hits 2–5 na Geração III, a distribuição registrada é **2 hits 3/8; 3 hits 3/8; 4 hits 1/8; 5 hits 1/8**, média **3,0** impactos por acerto. Na Gen V em diante, a distribuição comum muda (média 3,1). A prévia de custo atual D-039 usa **2,5** apenas como heurística simplificada de orçamento, e não define RNG ou poder por hit no combate. Antes de um golpe TM ser equipável, implementar sistema de obtenção/consumo e learnsets compatíveis com a versão de origem, decidir versão de estatísticas (Geração III ou snapshot moderno), definir custo SP versionado e validar probabilidades, frames e limites de turno. **Nenhuma alteração jogável de Bullet Seed foi incluída na D-046.**

## Critérios para uma D-047

- Estratificar Double Kick por matchup (Fighting × Rock/Normal vs Poison/Flying/Psychic/Bug/Ghost) usando pares com movimento-base comparável, incluindo diferenças de rank e tipo; não nerfar somente pelos +19,62 p.p. em 8 rivais.
- Stress adicional que force Recover próximo de HP crítico e SP insuficiente (sem suporte inválido), com testes de paralisia/KO entre decisão e ação e no máximo 1 cura.
- Se houver implementação de TM09 e multi-hit variável, criar primeiro tipos/learnsets versionados e mecanismo determinístico testável SEM mexer em recortes já jogáveis por acidente.
- Acessibilidade manual em Edge/Chrome físico e NVDA/VoiceOver continua pendente. Animações full sem seletor por decisão anterior pode exigir reconsideração para beta.

**Compatibilidade:** `kanto-idle-play-v02` schema2, snapshots antigos, / legado, replays, 151 GIFs, PP/SP publicados, Concentrar e Docker mínimo preservados; `isaquesan7/pokedex` não é alterado.

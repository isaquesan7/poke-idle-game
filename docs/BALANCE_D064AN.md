# D-064AN — Golpes equipáveis, derrota e progressão no Pico Dracônico

**Data:** 21/11/2026. **Estado:** auditoria em branch; nenhuma alteração de runtime ou economia.

## Objetivo e regras
A D-064AM encontrou taxa média de vitória de 43,06% no Pico Dracônico em matriz com seis líderes. Esta etapa compara o golpe padrão com até três golpes adicionais realmente aprendidos pelo catálogo atual, respeitando quatro slots, o primeiro como principal e o mesmo motor de IA, sem inventar golpes. O catálogo de golpes FRLG ainda é incompleto e não contém TMs ativas.

## Matriz determinística
- Regiões 8, 9 e 10, Pico Dracônico como foco.
- Líderes: Venusaur #3, Charizard #6, Blastoise #9, Pikachu #25, Gengar #94, Gyarados #130, Starmie #121 e Dragonite #149. Posse/captura de cada um é hipótese, não demonstrada.
- Níveis de líder: 81, 90 e 100. Na batalha a região é desbloqueada por nível do treinador; ao contrário da expedição, não há requisito separado de nível mínimo do Pokémon. Assim, Nv81 na região 10 é cenário deliberado de subnível.
- Perfis: base sem pontos, moderado com 4 pontos próprios e contribuição de treinador de 8 por atributo, afinidade 60; sem equipamento, badge ou rank de golpe.
- Loadouts: default (golpe inicial do catálogo) vs learned (inicial e até três golpes de kantoLevelMoves/kantoSupportMoves elegíveis por nível, priorizados por poder/STAB para construir fixture, não um moveset ótimo).
- 32 seeds por cenário: 3 regiões × 3 níveis × 8 líderes × 2 perfis × 2 loadouts × 32 = 9.216 batalhas. Pares usam mesmos encontros e seed; movimentos podem divergir no consumo posterior de RNG.
- Selvagem por kantoRegionalEncounter, stats próprios sem treino, golpe atual da espécie.

## Medidas
Win/loss/draw, média e p95 de turnos/linhas do diário, estimativa de exibição a 900 ms por linha após a primeira, XP de treinador por tentativa (derrotas com XP zero), XP/h teórico a 20 tentativas/h e horas hipotéticas para somar XP Lv82→93. Não confundir com telemetria de jogadores, duração real, nem tempo garantido de progressão; não inclui expedições, novos Pokémon, capturas, estoques, escolhas ou pausas.

## Limites e continuidade
O perfil moderado não é um save validado do nível 1 até o fim. O acesso a Dragonite, Starmie e outros líderes depende de captura/evolução. Os learnsets são um recorte incompleto, lendários podem não aparecer nessas seeds. A simulação não altera chances, XP, drops, equilíbrio ou persistência. O BattlePlayback mede tempo de apresentação, não cálculo. Testar depois com perfis/saves completos, composição de equipe e Playwright desktop/mobile instrumentado.

## Gate de publicação e próxima etapa
Registrar resultados do CI do HEAD (TypeScript, Vitest, React, /play, /regions, Docker). Depois de sucesso, comparar Delta de vitória e XP/ tentativa por região e por build para decidir se é necessário propor ajuste separado. Próxima D-064AO: trajetórias de equipe e tempo de apresentação em dispositivos, sem alterar números antes de evidência.


## Resultados do CI — primeira medição D-064AN

Na execução de regressão `44917376014`, job `136885772009`, o teste `D064AN_LEARNSET_PROGRESS_REPORT` concluiu **9.216 confrontos** e 126 combinações com slots aprendidos adicionais (contados por região × nível × líder × perfil). A construção Docker `44917376055` também passou no mesmo HEAD `3fea23817da13f6c02d85d520ca1926e4aea2aed`.

| Região | Vitórias: golpe padrão | Vitórias: golpes aprendidos | Diferença | XP por tentativa: padrão → aprendidos | Maior p95 teórico de playback com golpes aprendidos |
| --- | ---: | ---: | ---: | ---: | ---: |
| 8 Reserva Selvagem | 71,55% | 74,09% | +2,54 p.p. | 207,39 → 214,74 | 15,3 s |
| **9 Pico Dracônico** | **47,26%** | **55,53%** | **+8,27 p.p.** | **147,34 → 173,33** | **25,2 s** |
| 10 Santuário Lendário | 55,79% | 63,28% | +7,49 p.p. | 185,63 → 210,40 | 16,2 s |

Essas taxas **não devem ser comparadas diretamente** com D064AM como um teste A/B: a D064AN usa oito espécies, dois perfis com outros valores de treino e 32 seeds por confronto. O pareamento válido é apenas **entre padrão e learned dentro da D064AN**, onde a seed/espécie selvagem e os demais fatores iniciais são iguais.

### Pico por nível e perfil — taxa de vitória

| Líder / perfil | Só golpe padrão | Golpes aprendidos | XP médio por tentativa com golpes aprendidos |
| --- | ---: | ---: | ---: |
| Nv81, base | 40,23% | 44,14% | 130,06 |
| Nv81, moderado | 45,70% | 51,56% | 151,93 |
| Nv90, base | 39,45% | 46,09% | 146,59 |
| Nv90, moderado | 45,31% | 53,52% | 170,15 |
| Nv100, base | 56,64% | 67,97% | 217,50 |
| Nv100, moderado | 56,25% | 69,92% | 223,75 |

**Atenção ao catálogo parcial:** Gengar #94 só teve o golpe `tackle` disponível na fixture, sem ganho por novos slots. Outros exemplos de slots atualmente disponíveis: Charizard `ember / wing-attack / scratch`, Blastoise `water-gun / hydro-pump / bubble / tackle`, Starmie `water-gun / recover`, Dragonite `tackle / wing-attack / slam`. Não autorizar golpes ausentes no recorte para corrigir artificialmente a dificuldade.

No modelo de 20 tentativas/h, para um Pokémon moderado Nv90 no Pico os resultados do bloco estimaram **113,46 horas** para acumular XP de treinador equivalente a Lv82→93 com golpe padrão versus **96,04 horas** com golpes aprendidos. Isso **não é uma trajetória real**: o líder e os encontros aumentam de nível, pode haver outras regiões disponíveis, e expedições concedem XP além das tentativas. Serve apenas para ilustrar que derrotas e escolhas de golpes alteram a cadência. O cálculo de XP usa somente vitórias.

### Conclusão sem alteração de números

Os golpes aprendidos existentes melhoram materialmente a taxa de vitória no Pico para esta seleção de líderes, mas não resolvem todos os confrontos e **não provam que o jogador médio consiga equipar esses golpes ou capturar esses oito líderes**. Priorizar na D064AO:
1. Examinar cobertura incompleta de golpes equipáveis por espécie (especialmente Gengar) antes de reduzir a dificuldade global do Pico.
2. Construir trajetórias válidas de posse/evolução/treino de uma equipe e XP somando expedição, encontros e derrotas.
3. Instrumentar execução Playwright do diário no desktop e celular para medir elapsed real com pausas/2×, mantendo o resultado salvo imutável.

Nenhuma modificação em thresholds, taxas de captura, nível mínimo, probabilidades dos lendários, drops, habilidades ou save foi autorizada/aplicada.

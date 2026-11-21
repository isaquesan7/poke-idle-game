# D-064AM — Auditoria das batalhas nas regiões avançadas (21/11/2026)

## Escopo
Auditoria **apenas diagnóstica**, sem alterar código do motor, seed, loja, XP, expedição, capturas, persistência ou apresentação. Executa o simulador real `simulateKantoBattle`, `kantoRegionalEncounter` e atributos-base do catálogo para regiões 7–10 (Costa Oceânica, Reserva Selvagem, Pico Dracônico e Santuário Lendário). As 151 espécies continuam distribuídas nas dez regiões, sem novos itens ou taxa de aparecimento.

A matriz automática `packages/game-core/tests/d064am-advanced-regions-balance.test.ts` cobre **4.608 batalhas**: 4 regiões × 3 níveis distintos do líder (mínimo da região, máximo e Lv100 nas regiões 7–9; mínimo, intermediário Lv95 e máximo Lv100 na região 10) × 6 espécies de líder (Venusaur, Charizard, Blastoise, Pikachu, Gengar, Gyarados) × 2 perfis × 32 seeds determinísticas. O perfil `base` utiliza stats sem treino. O perfil `trained` usa 5 pontos próprios por atributo, 40 de atributo total de treinador por stat e afinidade 75; são fixtures válidas de modelo de atributos, não um save/campanha com inventário e todos os requisitos de progressão demonstrados. Selvagens têm atributos próprios, sem bônus de treinador, e golpes-padrão do catálogo alfa (ainda provisório para várias espécies). Eventos de status/batalha são resolvidos pelo motor real.

## Métricas
Cada estrato registra vitórias/derrotas/empates, turnos médios e p95, percentagem de 30 turnos, linhas do diário médias e p95, espécies selvagens distintas na amostra, nível selvagem médio e **XP médio de treinador por encontro** considerando que vitória concede XP e derrota/empate concedem zero. `frames.length === log.length`, HP final, nível/faixa regional e integridade do motor são checados.

### Tempo de apresentação
O `BattlePlayback` revela a primeira linha imediatamente e cada uma das restantes depois de 900 ms (normal), 450 ms (2×) ou 3.000 ms (leitura assistiva 1×). Estimativa p95: `(p95 linhas - 1) × intervalo`. Estes tempos são **limites teóricos do timer**, não benchmarks do navegador: atrasos de renderização, clamping, pausas ou trocas de aba mudam a duração. Motor resolve a luta instantaneamente; replay não altera save ou concessões.

## Interpretação e limitações
- A taxa de vitória por fixture não é a taxa real dos jogadores: equipamento, buffs, moves equipados, rank, afinidade real e distribuição de atributos variam. A seleção dos seis líderes é propositalmente heterogênea, mas não representativa de todas 151 espécies ou de times humanos.
- Seeds são amostradas determinísticamente sobre uint32; encontros raros de peso 1 podem não aparecer nesta amostra. O teste não mede a chance real de capturar lendários nem estoque de Pokébolas.
- O nível Lv100 como líder em cada região é um contrafactual para avaliar vantagem por sobrelevel, não a trajetória típica. O extremo sem treinamento em regiões 9–10 pode revelar dificuldade que será menor com investimento.
- O XP por encontro mede **apenas** recompensa de vitória e não calcula XP/hora real: é preciso combinar win-rate com duração e tempo de decisão/navegação. Não converter duração do playback em tempo de processamento de combate.
- A simulação D064AL de 20 vitórias/hora e 100% de sucesso permanece limite otimista. Esta auditoria fornece um contraponto de taxas em confrontos reais do motor, mas ainda não comprova progressão sem gargalos para todas as composições.

## Gates e próxima etapa
CI do HEAD: TypeScript strict, Vitest core/web, regressão /play e /regions desktop/mobile, Playwright isolado e imagem Docker. Recolher a linha `D064AM_REGION_BATTLE_REPORT` dos logs CI, sintetizar achados e só depois apresentar proposta de balanceamento separada, sem mudar números automaticamente. Próxima etapa D064AN: avaliação de progressão por sessão com distribuição observável de níveis/tempos e jornadas acessíveis, sem alegar telemetria de jogadores inexistentes.

`isaquesan7/pokedex` permanece intocado.


## Resultados observados no CI — matriz 4.608
A execução de regressão GitHub Actions `44916147384` foi **SUCCESS** no HEAD de teste `2535dd9f0974ba2b16b92610a1a54c39ec01d04e`; relatório `D064AM_REGION_BATTLE_REPORT` foi recuperado dos logs do job `136882063732`. Cada região tem exatamente 1.152 confrontos; cada combinação de região/nível/perfil tem 192. A taxa regional apresentada é a média de seis grupos de mesmo tamanho, portanto equivale à taxa agregada.

| Região | Vitória % (matriz completa) | p95 playback normal mais longo dos grupos |
| --- | ---: | ---: |
| 7 Costa Oceânica | 68,06% | 26,1 s |
| 8 Reserva Selvagem | 63,54% | 18,0 s |
| 9 Pico Dracônico | **43,06%** | **26,1 s** |
| 10 Santuário Lendário | 57,73% | 16,2 s |

### Detalhe do gargalo do Pico Dracônico
| Pokémon líder | Perfil | Vitória % | Derrota % | XP treinador médio por encontro |
| --- | --- | ---: | ---: | ---: |
| Nv81 | sem treino | 33,33% | 66,15% | 98,29 |
| Nv81 | treinado | 43,23% | 56,25% | 127,33 |
| Nv90 | sem treino | 36,46% | 63,54% | 115,92 |
| Nv90 | treinado | 42,71% | 57,29% | 135,78 |
| Nv100 | sem treino | 48,44% | 51,56% | 155,00 |
| Nv100 | treinado | 54,17% | 45,83% | 173,33 |

A amostra do Pico observou **7–8 espécies distintas por segmento**, apesar de dez espécies na região. Isso é esperado com sementes limitadas e pesos baixos para lendários, e NÃO valida a probabilidade extrema de aparição deles. As 24 linhas completas, inclusive turnos e custo visual, estão nos logs estruturados da execução.

O menor percentual em Pico Dracônico sugere investigar a relação entre tipos dos Pokémon selvagens, golpes-padrão provisórios e dano/HP antes de reduzir o requisito de treinador. A taxa no Santuário melhora em comparação ao Pico para estes seis líderes, mas isso não significa que a última região seja sempre mais fácil para qualquer Pokémon.

O p95 de apresentação é calculado por `(p95 linhas - 1) × 900ms` e não mede processamento real nem execução do navegador. Leitura assistiva/pausas podem ser significativamente mais lentas. A estimativa de **XP por encontro** já incorpora derrotas com XP zero; o valor não é XP/hora e não inclui expedições.

### Decisão D064AM
**Nenhum nerf/buff automático**: conservar a curva de treinador D064AJ, os gates D064AK, a tabela de Pokébolas e as raridades atuais. Na D064AN, priorizar amostras com golpes equipáveis reais por espécie, equipamentos/afinidades típicos, vários líderes capturados, testes de replay desktop/mobile e análise de trajetória de XP com win-rate observável. Avaliar Pico Dracônico primeiro.

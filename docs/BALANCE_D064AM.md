# D-064AM — Auditoria das batalhas nas regiões avançadas (21/11/2026)

## Escopo
Auditoria **apenas diagnóstica**, sem alterar código do motor, seed, loja, XP, expedição, capturas, persistência ou apresentação. Executa o simulador real `simulateKantoBattle`, `kantoRegionalEncounter` e atributos-base do catálogo para regiões 7–10 (Costa Oceânica, Reserva Selvagem, Pico Dracônico e Santuário Lendário). As 151 espécies continuam distribuídas nas dez regiões, sem novos itens ou taxa de aparecimento.

A matriz automática `packages/game-core/tests/d064am-advanced-regions-balance.test.ts` cobre **4.608 batalhas**: 4 regiões × 3 níveis do líder (mínimo da região, máximo e Lv100) × 6 espécies de líder (Venusaur, Charizard, Blastoise, Pikachu, Gengar, Gyarados) × 2 perfis × 32 seeds determinísticas. O perfil `base` utiliza stats sem treino. O perfil `trained` usa 5 pontos próprios por atributo, 40 de atributo total de treinador por stat e afinidade 75; são fixtures válidas de modelo de atributos, não um save/campanha com inventário e todos os requisitos de progressão demonstrados. Selvagens têm atributos próprios, sem bônus de treinador, e golpes-padrão do catálogo alfa (ainda provisório para várias espécies). Eventos de status/batalha são resolvidos pelo motor real.

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

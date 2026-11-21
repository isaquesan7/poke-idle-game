# Auditoria de progressão D-064AL — 21/11/2026

## Escopo e fonte dos números
Esta é uma **simulação determinística**, não telemetria nem avaliação humana. Usa funções publicadas `xpThreshold`, `grantXp`, `battleTrainerXp`, `expeditionRewards` e o catálogo `KANTO_REGIONS`. Nenhum parâmetro de jogabilidade foi modificado.

Cenário base: novo treinador Nv1, Pokémon inicial Nv5; 20 vitórias/hora (3 min por encontro), sempre contra o nível **máximo** da melhor região simultaneamente liberada por `trainer.level` e `pokemon.level>=region.levelMin`; nunca há derrota, espera, captura ou exigência de recursos. A projeção não modela balanço de dano, tempo real do replay, baixa chance de capturar, gastos de Pokébolas, múltiplas equipes, disponibilidade dos encontros ou tempo sem jogar. É um **limite inferior otimista** para esforço de batalhas.

## Resultado da simulação por gates

| Região desbloqueada | Só batalhas: vitórias acumuladas | Só batalhas: horas a 20 vitórias/h | Modelo batalha + idle: horas |
| --- | ---: | ---: | ---: |
| 1 — Bosque Inicial | 0 | 0,0 | 0,0 |
| 2 — Colinas de Kanto | 18 | 0,9 | 0,5 |
| 3 — Caverna Rochosa | 57 | 2,85 | 1,65 |
| 4 — Lagos Serenos | 145 | 7,25 | 4,55 |
| 5 — Planícies Elétricas | 329 | 16,45 | 11,05 |
| 6 — Bosque Nebuloso | 679 | 33,95 | 23,90 |
| 7 — Costa Oceânica | 1.241 | 62,05 | 45,30 |
| 8 — Reserva Selvagem | 2.080 | 104,00 | 78,15 |
| 9 — Pico Dracônico | 3.089 | 154,45 | 118,55 |
| 10 — Santuário Lendário | 4.110 | 205,50 | 160,25 |

**Modelo misto hipotético:** a cada batalha de 3 minutos também credita 18 ciclos de expedição (7 moedas, 4 XP de treinador e 5 XP de Pokémon por ciclo), à mesma unidade expedicionária. Exige que a mecânica permita esses acúmulos e resgates; **não** é promessa de ganho enquanto se luta, nem considera o teto de 8 horas por resgate. Se o jogador ficar sem resgatar além do teto, resultados serão menores.

### Observações para decisão
1. A nova curva elimina o salto explosivo de XP no meio/fim, porém desbloquear região 10 somente por batalhas otimizadas requer 4.110 vitórias, ou ~205,5 horas a 20 vitórias/h. Na prática pode ser maior por derrotas, níveis menores que o máximo, telas de combate e disponibilidade.
2. A progressão individual do Pokémon alcança Lv100 **antes** do treinador chegar ao desbloqueio Lv93 na simulação, portanto o gate duplo do Pokémon não é o gargalo nesse cenário otimista de um único líder; isso **não garante** inexistência de travas em equipes reais, Pokémon trocados ou capturas tardias.
3. A expedição atual rende 1.440 XP treinador/h, 1.800 XP Pokémon/h por UID expedicionário e até 11.520 XP treinador por um resgate de oito horas. Isso altera substancialmente o tempo de desbloqueio; qualquer ajuste precisa avaliar ritmo de sessões, limite de resgate e eventuais abusos de relógio local.
4. **Não ajustar automaticamente** XP, drops, desbloqueios ou requisitos nesta PR. A hipótese de 20 vitórias por hora e 100% de sucesso precisa ser substituída ou complementada com séries de encontros reais simulados com estatísticas e IA, medição do replay e testes em celular.

## Próxima ação D-064AM
Fazer simulações estratificadas para win-rate e níveis efetivos do líder nas regiões 7–10, tempos reais de apresentação e probabilidade de estagnação, sem depender de seed cliente como medida antifraude. Após reunir esses resultados, propor alterações separadas com aprovação e E2E desktop/mobile. Preservar v0.2 local, 151 espécies, GIFs, Pokébolas, captura, writer e decisões D064AJ/AK.

## Gates de integração
Executar TypeScript, Vitest, E2E /play e /regions, Playwright isolado e Docker no HEAD; integrar só com CI terminal SUCCESS e verificar Railway SHA exato antes de descrever como publicado. Sem mudança de runtime além de teste/documentação.

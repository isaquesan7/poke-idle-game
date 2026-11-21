# D-064AD — Diagnóstico de estagnação com combate real

**Status:** laboratório offline, NÃO é experiência de jogo publicada. Fonte: job `136701152846`, workflow regional `44856916007`, SHA `b508a1aee1f58fdf0f3bc0847ddc1eb25a393cb0`, linhas `D064AD_SOFTLOCK`. Regressão geral, Playwright, Docker e regional: SUCCESS nesse SHA.

## Metodologia
- 4 seeds: 0, 17, 20261120, 4294967295.
- 240 encontros por cenário, escolhendo sempre a região mais avançada desbloqueada.
- Equipe 1 UID Bulbasaur ou 3 UIDs Bulbasaur/Charmander/Squirtle em rodízio.
- Treinamento `base`: stats de espécie sem pontos extras; `focused`: hipótese de pontos teóricos em HP e Attack, treinador com 20 pontos em cada atributo, +1 de afinidade por vitória.
- Cada encontro usa `simulateKantoBattle` de verdade, com stats recalculados pelo nível atual e HP/SP restaurados. XP e coins só nas vitórias; captura desativada.
- Foram medidas vitórias, derrotas, nível do treinador, região máxima, maior sequência sem vitória e distância da última vitória. Ausência de séries com 60 derrotas **não prova ausência de softlocks**.

## Comparação nas quatro seeds

| Equipe | Treinamento | Vitórias em 240 batalhas (mín–máx) | Região máxima observada | Maior sequência sem vitória observada |
|---|---|---|---|---|
| Bulbasaur sozinho | base | 81–100 | 2–3 | 16 |
| Bulbasaur sozinho | focused | 220–228 | 4 | 3 |
| 1/4/7 em rodízio | base | 88–106 | 2 | 11 |
| 1/4/7 em rodízio | focused | 152–158 | 3 | 15 |

Em nenhum dos 16 cenários a última vitória ficou a 60 ou mais batalhas do fim. Contudo, com treinamento base, a equipe de três UIDs ainda não passou da região 2 após 240 batalhas. O modo focused chega muito mais longe por usar bônus **teóricos e bastante fortes**, não números aprovados para gameplay.

## Bloqueios de decisão

1. **Não liberar** os bônus focused medidos como se fossem a curva real de treino. A análise só mostra sensibilidade do motor a atributos/afinidade e composição.
2. A amostra cobre apenas as primeiras regiões na maior parte das configurações; preparar testes mais longos ou pontos de entrada controlados nas regiões finais, com diversas espécies e stats legitimamente alcançáveis.
3. Construir estratégia de recuperação: retorno a uma região anterior, XP de expedição ou treinamento gradual, sem forçar vantagem de espécie injustificável. Qualquer concessão de recurso precisa de regra/proteção própria.
4. Antes de liberar captura/recompensa regional, resolver autoridade de seed/outcome, migração, idempotência, conflitos e crash recovery (ver `REGIONAL_RELEASE_GATES_D064AD.md`).
5. Seguir com publicação de **Corte A somente leitura** da PR #106 quando CI e QA próprio estiverem aprovados, sem carregar a cadeia experimental para a main.

**Nenhuma economia de jogador, escrita em save, merge na main ou deploy Railway foram realizados nesta auditoria.**

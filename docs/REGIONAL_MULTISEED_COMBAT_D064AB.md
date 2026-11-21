# D-064AB — Multisseed e amostragem de combate real (laboratório)

**Data:** 20/11/2026. **Status:** experimental, sem integração ao writer, UI, economia ou Railway.

## Evidência reproduzível

Testes `apps/web/tests/regional-multiseed-real-combat.test.ts` na PR #100, espelhados na PR CI-only #101, SHA `774962e495594bc8027419eb1fb95cd033907b6f`. Fonte: linhas `D064AB_MULTI_SEED` e `D064AB_REAL_BATTLE` dos logs do workflow regional (job `136698092961`). Os dados são de um **conjunto pequeno de oito seeds**, não intervalos de confiança.

## 1 — Economia com vitória hipotética de 75%

Oito seeds `17,117,1117,20261120,54321,87654,0,4294967295`, 6.000 batalhas cada, um ou três Pokémon alternados, ambas as políticas de captura `every-win` e `rare-only` comparadas com a mesma sequência de batalha.

| Métrica média por seed | Equipe 1 UID | Equipe 3 UIDs |
|---|---:|---:|
| Vitórias em 6.000 batalhas | 4.502 | 4.502 |
| Região 10 liberada nas seeds | 8/8 | 8/8 |
| Batalhas para liberar região 10, média | 3.700,875 | 3.992,375 |
| Menor–maior número de batalhas | 3.638–3.739 | 3.949–4.029 |
| Encontros raros totais (inclui derrotas) | 4,75 | 4,75 |
| Tentativas raras, capturar toda vitória | 0,375 | 0,125 |
| Oportunidades sem bola, capturar toda vitória | 3.312,5 | 3.275,5 |
| Tentativas raras, reservar para raros | 3,75 | 3,375 |
| Ultra Balls restantes, reservar para raros | 228,25 | 216,75 |
| Capturas raras, reservar para raros | 0,625 | 0,5 |

Observação: como a sequência de encontros é pareada dentro de cada equipe/seed, estratégias de captura não alteram os números de vitórias ou desbloqueio. **Entre equipes diferentes, os níveis e portanto os encontros podem mudar**; a taxa de vitória hipotética é a mesma porque o PRNG de decisão não usa stats.

Diferença média para região 10: 291,5 batalhas extras para três UIDs, aproximadamente 7,9% a mais que a equipe de um UID. O modelo **não** desconta tempo real, cura, equipamentos, afinidade ou custo de insígnias.

## 2 — Amostras do motor real: 12 confrontos

Cada linha representa 32 lutas determinísticas com o `simulateKantoBattle` executado via `previewKantoRegionalBattle`, com líder inicial sem pontos, rank 0 e golpe padrão da espécie. Pokémon sempre recomeça com HP/SP cheios, treinador nível 100 apenas libera acesso. Os adversários são sorteados dentro da região.

| Região / nível do líder | Bulbasaur vitórias/32 | Charmander vitórias/32 | Squirtle vitórias/32 |
|---|---:|---:|---:|
| 1 / Lv 5 | 8 (25%) | 21 (65,6%) | 17 (53,1%) |
| 4 / Lv 35 | 23 (71,9%) | 0 (0%) | 6 (18,8%) |
| 7 / Lv 65 | 6 (18,8%) | 0 (0%) | 8 (25%) |
| 10 / Lv 95 | 4 (12,5%) | 4 (12,5%) | 5 (15,6%) |

**Leitura crítica:** as taxas são extremamente dependentes do tipo, golpe, nível e amostra pequena, e não justificam projetar uma única taxa 75% para toda a campanha. 0/32 não comprova impossibilidade de vitória. As batalhas não usam a composição de 1–3 UIDs com trocas, melhorias manuais, bônus do treinador, evolução, status persistente, PP/SP entre encontros ou recursos de cura. Os resultados são diagnósticos de balanceamento dos combatentes sem treinamento, não previsão da experiência final.

## 3 — Consequências de design a testar

1. **Pacing e unlock:** equipe de três UIDs progride mais devagar neste modelo porque o XP de Pokémon fica dividido e o nível do selvagem é dependente do líder, reduzindo recompensa por vitória; testar progressão específica de cada UID e objetivo de diversidade.
2. **Variação real:** medir win rate para equipes com investimento de atributos, golpes aprendidos, afinidade e níveis diferentes, com dezenas/centenas de seeds; não substituir o modelo real por 75% fixos.
3. **Pokébolas:** `every-win` esgota o estoque e deixa milhares de oportunidades sem bola; `rare-only` preserva estoque mas não ajuda a completar a Pokédex comum. Avaliar política híbrida com meta de completar #001–151 e distribuição regional de espécies.
4. **Autoridade:** seed controlada pelo cliente ainda permite selecionar encontro/captura; sem backend, não liberar economia/captura persistente.
5. **Persistência:** writer regional seguro com lock entre abas, backup recuperável, migração XP validada e receipts idempotentes ainda não foi implementado/ativado.

Os números NÃO são recomendação para alterar as taxas/XP nesta etapa. A próxima análise deve integrar desfecho real do combate numa simulação longitudinal com equipe e recursos, sem converter o laboratório em save real.

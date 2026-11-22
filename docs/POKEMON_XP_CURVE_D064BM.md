# D064BM — correção estrutural de progressão Lv1–100 (22/11/2026)

**Estado:** implementação candidata na branch `feat/d064bm-pokemon-xp-curve-unlock-safety`, **não publicada** até CI, merge e Railway. Simulações aqui são determinísticas e assumem expedições sem combates, captura, falha de relógio ou troca de Pokémon. Não são telemetria, calendário real ou previsão de todo jogador.

## Por que esta revisão é necessária
A D064BL comprovou que o sistema com XP Pokémon linear (`65+22×L`) permite ultrapassar a faixa da região enquanto o treinador, com XP quadrático, ainda não pode desbloquear a região seguinte. Com treinador Lv19/1139 XP, Pokémon Lv41/0 XP e apenas R3 disponível, 49 vitórias ideais contra selvagens Lv30 levavam o líder ao Lv42, fator zero e treinador ainda Lv19/1825 XP; ficavam faltando 244 XP. Rebaixar isoladamente todos os requisitos do treinador para [1,6,12,18,21,24,27,30,33,36] permitia alcançar Pokémon Lv100 em **32h10m a 80h** de expedição ativa dependendo da frequência de resgates, acelerando demais a campanha.

## Regra candidata
Manter **inalterados** todos os dez desbloqueios do treinador `[1,6,12,20,30,42,55,69,82,93]`, os mínimos do Pokémon por área `[2,11,21,31,41,51,61,71,81,91]`, a tabela de espécies, taxas e XP por ciclo e vitória, anti-farm, afinidade, raridade de bolas, save e XP do treinador.

Custo do próximo nível Pokémon `L`:

```text
pokemonXpThreshold(L) = 65 + 22L + 7 × max(0, L − 20)²
trainerXpThreshold(L) = 140 + 35L + ceil(3.5L²)   [sem mudanças]
```

A primeira curva é **idêntica à versão anterior nos níveis 1–20**. Passa a crescer gradualmente do Lv21 até o Lv100, para que o Pokémon não passe ao Lv42 antes de o treinador avançar até Lv20. É uma extensão da fórmula, não multiplicador do XP concedido. O cálculo por ciclo já existente da expedição e a concessão por batalha usam `grantXp`, portanto recebem a mesma política sem writer alternativo.

| Pokémon no nível | XP até próximo nível, antes | XP agora |
|---:|---:|---:|
| 1 | 87 | 87 |
| 20 | 505 | 505 |
| 21 | 527 | 534 |
| 30 | 725 | 1.425 |
| 50 | 1.165 | 7.465 |
| 90 | 2.045 | 36.345 |

## Jornada idealizada, um Pokémon
Treinador Lv1/0 XP e Pokémon Lv2/0 XP, sem batalhas extras; sempre escolher a maior região permitida no começo de cada resgate, ciclos ativos completos, sem compras.

| Intervalo de resgate | R10 atingida após | Pokémon Lv100 após | Treinador Lv100 após |
|---|---:|---:|---:|
| 5 minutos | 379h15 | 399h10 | 432h40 |
| 2 horas | 386h | 404h | 438h |
| 8 horas | 424h | 440h | 472h |

As regiões avançadas só chegam quando **treinador e Pokémon** estão aptos, os lendários continuam limitados à R9/R10 com raridade original, o Pokémon chega a Lv100 **antes do treinador**, e nenhum requisito regional foi reduzido. Jogadores mais ativos podem usar batalhas, trocar Pokémon e chegar em horários diferentes.

O primeiro resgate de 8h do Bosque Inicial, Lv2/0 XP, permanece **8039 moedas / 4164 XP treinador / 5833 XP Pokémon**, chegando a Pokémon Lv21 e treinador Lv10. Uma simulação de 40 resgates de 8h com um Pokémon, sem batalha, estima treinador Lv83, Pokémon Lv90, **1.054.319 moedas, 79 Poké Balls, 35 Great Balls e zero Ultra Balls** até essa coleta; não confundir com o teto de estoque da futura loja nem com economia líquida após gastos. As bolas são recompensadas estritamente por ciclos elegíveis, conforme D064BK.

## Compatibilidade e recovery
- Não há mudança de schema, UID, XP já acumulado, inventário ou reset. Um nível salvo permanece no mesmo nível. Como o limiar novo é maior ou igual ao anterior, XP residual legal não se converte em nível extra nem é apagado. No nível 100 o XP permanece zero.
- Um save antigo já estagnado em treinador Lv19/1139 e Pokémon Lv41/0 agora pode, num cenário de vitórias garantidas contra Nv30, conseguir **14 XP de treinador + 20 XP Pokémon por vitória** durante pelo menos 67 vitórias. O treinador atinge Lv20 enquanto o Pokémon ainda é Lv41, permitindo R4. Isso não oferece XP grátis, não ignora fator de nível e não garante uma quantidade real de vitórias.
- Na alfa ainda não existe backend autoritativo; o modelo local não oferece resistência a adulteração de relógio/save. Não aplicar migração retroativa automática.

## Testes e limites
- `trainer-xp-long-curve.test.ts` e `d064bm-pokemon-xp-curve.test.ts`: limiares Lv1–20 preservados, valores exatos 21/30/50/90, crescimento contínuo até100, trainer intocado e ausência de regressão em saves.
- `d064bl-mixed-progression.test.ts`: unlock R4 sem alteração das restrições, recuperação de estado legado do bloqueio e faixa de vitória.
- `d064bl-ten-region-scenarios.test.ts`: todas as 10 regiões e 5m/2h/8h, cap individual 100; cenário expedição-only sem RNG.
- `d064bk-unlock-economy.test.ts`: 40 claims com resultado de economia atualizado e raridade de bolas; demais testes D064BJ preservam regras de anti-farm.
- A D064BL inclui 120 batalhas reais do motor, mas apenas com golpes padrão e stats de espécies evoluídas, não simula a experiência de dezenas de espécies/treinadores do jogo. Testes E2E e QA manual com leitores NVDA/VoiceOver continuam necessários.
- **Gate de release:** CI geral TypeScript/Vitest/Playwright desktop/mobile/Docker, revisão de diferenças de código, merge por squash, Railway deploy `SUCCESS` SHA funcional, healthcheck interno. Ajuste de loja/Pokébolas somente após nova auditoria de consumo de moedas e estoque.

**Nenhuma modificação autorizada ao repositório `isaquesan7/pokedex`.**

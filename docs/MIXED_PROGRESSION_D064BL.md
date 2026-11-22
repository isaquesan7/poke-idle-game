# D064BL — Diagnóstico da progressão combinada (22/11/2026)

**Estado:** simulação diagnóstica em branch; sem alteração de mecânicas, níveis de desbloqueio, IA, save ou preços. Resultados de teste aguardam GitHub Actions e não são dados de partidas reais.

## O que a D064BK mostrou
Após começar com treinador Lv1, Pokémon Lv2 e XP zero, quatro resgates de 8h na maior região acessível por ambos levam a treinador **Lv19 / 1139 XP** e Pokémon **Lv41 / 0 XP**. Só R3 permanece liberada porque a R4 exige treinador Lv20. O parceiro está 11 níveis acima dos selvagens Lv30 (teto R3), recebendo apenas 10% do XP antes do arredondamento. A expedição na R3 já paga zero.

## Teste de recuperação por combate regional (cenário OTIMISTA, não IA real)
Hipótese propositalmente favorável: **100% de vitórias** contra selvagens do **nível máximo 30** da R3, aplicando `battleProgressFactor`, `battleTrainerXp`, `scaledRegionalReward` e `grantXp` do jogo a cada encontro. Nenhuma probabilidade de vencer, velocidade dos turnos ou drop é simulada.

- A partir do treinador Lv19/1139 XP e líder Lv41/0 XP, cada vitória elegível oferece somente **14 XP ao treinador** e **20 XP ao Pokémon**. Após **49 vitórias**, Pokémon alcança Lv42/13 XP e treinador permanece Lv19/1825 XP, faltando 244 XP para o nível 20.
- A partir de Lv42 contra selvagem Lv30, a diferença é +12; o fator passa a **zero**. Nenhuma outra vitória do mesmo líder nessa região aumenta XP treinador/Pokémon, moedas, afinidade ou histórico.
- Portanto, o jogador com **um único Pokémon elegível, sem reserva útil, e sem outra fonte de progresso** não consegue liberar R4 via expedição ou batalha regional, mesmo supondo vitória garantida. É um **risco real de softlock de progressão**, não apenas fricção moderada. O combate e a captura seguem disponíveis, mas podem faltar bolas ou um parceiro capaz.
- Cenário de recuperação **condicional**: uma reserva *já treinada* Lv30 vence 7 vezes um selvagem Lv30 (fator 100%), concedendo 140 XP de treinador por vitória, suficiente para levar o treinador a Lv20. Essa reserva passa para Lv31, tornando R4 acessível. Isto **não garante** que o jogador obtenha/treine tal Pokémon nem que vença 7 vezes. É um caminho alternativo, não solução ao softlock de um único parceiro.

## Novo usuário e onboarding
O inicial começa no Lv1. O sistema `beginnerBattleXp` concede 22 XP Pokémon por derrota/empate exclusivamente no Lv1; quatro resultados sem vitória bastam para chegar ao Lv2/1 XP, permitindo expedição R1. Não atribuir XP de treinador, afinidade, moedas ou captura por essas derrotas. O teste de partida à Lv2 com 0 XP é um ponto de partida idealizado, de modo a manter os números D064BK comparáveis.

## Alternativas de design ainda NÃO aprovadas
1. **Revisar níveis de desbloqueio do treinador** para alinhar à curva quadrática atual, inclusive R5–R10, simulando o caminho completo Lv1–100 e prevenindo novas barreiras. Mantém o fator anti-farm; porém pode liberar regiões cedo demais para o treinador.
2. **Proteger a progressão do treinador com fonte limitada e verificável em combates desafiadores**, sem permitir farm em selvagens fracos, sem ganho passivo/automático. Exige design detalhado e mecanismos antiabuso.
3. **Garantir caminho de reserva/recuperação** sem exigir compras/capturas aleatórias: tutorial, treinamento/experiência de UIDs baixos sob regras estritas, ou um modo de desafios regionais. Não conceder Pokébolas infinitas nem burlar raridade de lendários.

**Não aplicar um ajuste isolado de R4** sem simular R5–R10: o desalinhamento decorre da curva crescente de XP treinador e voltará a ocorrer.

## Próximos gates
- Validar CI TypeScript/Vitest/Playwright/Docker da PR diagnóstica.
- Construir uma matriz de jornadas com vitórias probabilísticas **usando o motor de combate real** (seeds fixas, equipes legítimas) em diferentes iniciais, tempo de expedição e captura/reserva; registrar p50/p95 e taxa de bloqueio.
- Decidir regra anti-softlock com aprovação e regressões, e só então alterar desbloqueios/ganhos. Loja futura precisa respeitar estoque escasso e economia real.
- NVDA/VoiceOver manual ainda pendente; sem backend, toda persistência é local. `isaquesan7/pokedex` não é modificado.

## Amostra complementar do motor de combate
O teste `d064bl-real-battle-sample.test.ts` percorre 3 espécies evoluídas (#003, #006, #009) no Lv41, 5 selvagens reais da R3 Lv30 e 8 seeds fixas, executando 120 batalhas com o motor `simulateKantoBattle`. O objetivo é medir distribuição de vitórias/derrotas/empates e turnos com movimentos padrão. Não equipara um starter sem evolução ao Pokémon do cenário, nem simula pontos manuais, títulos, equipamento, afinidade, lista completa de golpes ou captura; portanto é um **controle mecânico limitado**, não previsão de sucesso do jogador ou verificação de 49 vitórias consecutivas.


## Matriz completa R1–R10 (hipótese de redução dos gates, NÃO IMPLEMENTADA)
O teste `d064bl-ten-region-scenarios.test.ts` conserva as taxas e fórmulas oficiais, mas aplica uma régua de desbloqueio **somente dentro da simulação**, mantendo o código de produção inalterado. O baseline da produção usa requisitos de treinador `[1,6,12,20,30,42,55,69,82,93]`. Uma hipótese para remover o bloqueio é `[1,6,12,18,21,24,27,30,33,36]`.

| Política simulada | Intervalo de resgate | Horas de expedição até Pokémon Lv100 | Treinador ao chegar | Observação |
|---|---:|---:|---:|---|
| Atual | 8 h | Não alcança | Lv19, Pokémon Lv41 | R4 requer treinador Lv20; estagna após quatro claims |
| Gate reduzido, apenas em teste | 8 h | 80 h | Lv44 | R1 a R10 em dez resgates |
| Gate reduzido, apenas em teste | 2 h | 36 h | Lv40 | R10 alcançada, Pokémon Lv100 no resgate 18 |
| Gate reduzido, apenas em teste | 5 min | 32 h 10 min | Lv39 | R10 alcançada, Pokémon Lv100 no resgate 386 |

Essa comparação considera **somente expedições, 100% do tempo contado, nenhum combate, equipe de um Pokémon**, troca imediata à região mais avançada permitida a cada resgate, sem ganho externo e sem custos de loja. O relógio total que o jogador passa no jogo pode ser muito maior, porque os resgates precisam ocorrer nos intervalos. A equipe é limitada a Lv100, mas o treinador permanece bem abaixo de Lv100. *Não confundir o desbloqueio matemático com uma recomendação de publicação*: reduzir somente gates removeria o softlock mas permitiria evolução do Pokémon até Lv100 em cerca de 32 horas acumuladas de expedição ativa com coletas curtas, risco de economia acelerada. Tampouco alterar apenas R4 resolve os gates avançados.

**Decisão pendente:** estabelecer simultaneamente ritmo mínimo razoável de Lv1→100 Pokémon, ritmo do treinador, exigência de regiões por treinador, papel das batalhas, custo de Pokébolas e segurança anti-farm. Somente então escolher ajuste sistêmico para as dez regiões. Não editar XP, gates ou combate com base apenas nesses experimentos.

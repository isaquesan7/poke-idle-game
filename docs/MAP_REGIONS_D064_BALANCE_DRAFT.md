# D-064 — Estudo preliminar de curvas (NÃO ATIVO)
20/11/2026 · estudo de sensibilidade; nenhuma fórmula abaixo está ligada ao writer.

## Hipótese de XP e moedas para simulação

| Componente | Fórmula atual | Hipótese experimental |
|---|---|---|
| Threshold para subir Treinador do nível L | 95+27L | 110+21L+ceil(0,8L²) |
| Threshold para subir Pokémon do nível L | 65+22L | 55+14L+ceil(0,55L²) |
| XP por vitória Treinador contra selvagem de nível W | 30+7W | 10+ceil(1,5W) |
| XP por vitória Pokémon líder | 20+6W | 22+ceil(3,5W) |
| Moedas por vitória | 25+3W | 5+W |
| Expedição a cada 10 s | 7 moedas / 4 XP Treinador / 5 XP Pokémon | DEFINIR APÓS SIMULAR: moedas continuam no cap, XP Pokémon bloqueado no teto, XP Treinador muito menor |
| Captura comum | 35% ao vencer, sem bola | chance por espécie/HP/bola e 1 unidade gasta por tentativa, com estoque e writer autorizados |

**As hipóteses NÃO são propostas aprovadas de valores definitivos.** Precisa verificar estatísticas reais da vitória, golpe especial, duração média do playback, novas bolas e jogadores já com save.

### Desbloqueio do Mapa: hipótese para evitar travamento

A curva do Treinador precisa ser bem mais lenta que a do Pokémon. Teste preliminar de entrada por nível do **Treinador**, com os selvagens ainda distribuídos por faixas 2–10, 11–20, ..., 91–100:

| Região | Treinador (hipótese de desbloqueio) | Selvagens (faixa) |
|---|---:|---:|
| Bosque Inicial | 1 | 2–10 |
| Colinas de Kanto | 6 | 11–20 |
| Caverna Rochosa | 12 | 21–30 |
| Lagos Serenos | 20 | 31–40 |
| Planícies Elétricas | 30 | 41–50 |
| Bosque Nebuloso | 42 | 51–60 |
| Costa Oceânica | 55 | 61–70 |
| Reserva Selvagem | 69 | 71–80 |
| Pico Dracônico | 82 | 81–90 |
| Santuário Lendário | 93 | 91–100 |

Isso mantém o exemplo **Treinador Nv11 + Pokémon Nv5 => expedição apenas no Bosque**, enquanto o Treinador tem Colinas liberadas. O nível do Pokémon precisa alcançar o teto da região anterior antes de iniciar a seguinte (região 2: Pokémon ao menos Nv10). Retorno a regiões antigas liberadas continua permitido; nele, o Pokémon acima do teto recebe apenas moedas.

### Primeira projeção ilustrativa

Um pequeno modelo determinístico (apenas vitórias, um único Pokémon, nenhuma Expedição, sem mortes/retries, região mais avançada disponível e nível selvagem limitado ao intervalo regional) encontrou:

| Marco | Modelo das fórmulas atuais, inimigo ~nível do parceiro | Hipótese nova, inimigo limitado à região |
|---|---:|---:|
| Treinador Nv40 | 132 vitórias | 354 vitórias |
| Pokémon Nv100 | 347 vitórias | 1264 vitórias |
| Treinador Nv100 | 356 vitórias | 3188 vitórias |

Os cenários **não usam a mesma regra de encontro**, portanto não servem como benchmark causal da alteração de XP. São apenas teste de ordem de grandeza e acessibilidade, não estimativa de horas. O número de vitórias real pode ser MUITO maior com derrotas, status, custos e composição de equipe. A curva experimental mantém Treinador significativamente mais lento que o Pokémon. No modelo proposto, quando Pokémon chega ao Nv100 (aprox. 1264 vitórias), o Treinador está por volta do Nv62; será desejável treinar outros Pokémon.

## Aceitação antes de ativar

1. Simulação pareada multi-seed (>=1000) por região, iniciais de tipos diferentes, níveis mínimos e máximos e Pokémon recém-capturados. Medir taxa de vitória, tempo de apresentação, XP e moedas por 30 min/1 h de jogo; aceitar ajustes após testes.
2. Simular 1, 3 e 8 horas de expedições por região e membros de níveis diferentes; cap exato ao nível máximo sem carregar XP, coins continuam, troca requer encerramento/reinício.
3. Medir quantos encontros e quantas Ultra Balls são esperados para cinco raros, incluindo chances de vitória e captura. Reduzir risco de impossível ou de exaustão de estoque. Não transformar 0,1% de aparição × fração minúscula de captura em dezenas de milhares de encontros inevitáveis sem decisão explícita.
4. Garantir todos os 151 presentes no pool de suas regiões e capturáveis sem Master Ball, eventos limitados ou loja inacessível.
5. Garantir migração dos saves existentes e que batalhas antigas/replay permanecem legíveis. Registro de bolsa ausente não pode conceder Poké Bolas fictícias sem uma migração aprovada.
6. Só integrar UI e writer após consenso da economia, regras de aquisição e testes de rollback.

**Não publicar curva nem mapa jogável antes dessa validação.**

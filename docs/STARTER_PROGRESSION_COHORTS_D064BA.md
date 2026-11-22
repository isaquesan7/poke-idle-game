# D-064BA — coortes de progressão inicial, evolução e região 2

**21/11/2026 — auditoria quantitativa em testes, sem alteração no gameplay.**

## Objetivo

D064AZ provou que uma trajetória de 72 encontros por inicial pode produzir diferenças grandes (Bulbasaur 15/72, Charmander 35/72, Squirtle 17/72), mesmo após a correção do softlock de nível1 com 22 XP por derrota ou empate só enquanto o Pokémon está no nível1. Uma trajetória por espécie não representa a distribuição de resultados.

D064BA pergunta: como variam as jornadas de **Bulbasaur, Charmander e Squirtle** em múltiplas seeds, ao enfrentar a IA selvagem publicada, até o desbloqueio da região2 (treinador nível6) e a primeira evolução manual (Pokémon nível16)?

## Experimento reproduzível

Teste `apps/web/tests/d064ba-starter-progression-cohorts.test.ts` — 6 seeds independentes × 3 iniciais × 2 políticas = **36 perfis NORMAIS criados pelo writer**, cada um com 96 encontros da região1 (**3.456 batalhas totais**), sempre calculados pelo sistema publicado e pelo salvamento com revisão e receipts.

- Política **somente batalhas**: não usa expedição.
- Política **batalhas + expedição**: após cada grupo de 12 batalhas, inicia e resgata uma expedição REGIONAL de 15 minutos (90 ciclos do motor atual, 450 XP do Pokémon e 360 XP do treinador, 8 expedições totalizando duas horas de tempo simulado por perfil). O relógio simulado representa intervalos de uso legítimos para a prova de regra, **não 2 horas reais de testes nem horas comprovadamente jogadas por humanos**. Se o líder ainda não atingiu Nv2, a expedição não é feita.
- Mesmas seis sequências de seeds entre espécies e políticas, mas níveis de cada encontro dependem da progressão real do respectivo perfil; pares não são contrafactuais exatos.
- Os perfis usam **somente o inicial** como líder, sem captura, uso de bolas, pontos manuais, troca de golpes ou equipamentos. Isso isola o início da progressão; NÃO mede o potencial de uma equipe otimizada, time de 3 ou estratégias de Pokébolas.
- Ao atingir Nv16, solicita evolução manual real via writer para Ivysaur/Charmeleon/Wartortle, preservando o UID, XP, nível e afinidade; não concede pedras ou evoluções automáticas.
- Ao fim, testa uma batalha real na região2 somente se treinador atingiu nível6; se não, assegura bloqueio sem commit.
- Audita batalha com diário/frames, save revisões/receipts, preservação de UID/equipe e ausência de capturas artificiais.

**Relatório no CI:** `D064BA_STARTER_COHORT_REPORT` com proporção agregada de vitórias e vitórias nas primeiras24/últimas72 tentativas, média dos níveis finais, ocorrência e mediana (quando atingido) da primeira vitória, nível2 do Pokémon, nível6 do treinador, nível16 do Pokémon, primeira evolução e acesso real à região2.

## Política de decisão

Não impor vitória de 50%, não modificar stats iniciais, IA, nível dos selvagens ou curva de XP sem analisar os dados por perfil e política. A avaliação identifica sinais de desequilíbrio e ritmo de jogo; a conclusão depende de mais seeds, equipes e da estratégia de golpes/atributos quando necessário.

**Não alterar:** captura, economia, lendários, TM09, catálogo FRLG, raridade, expedições, versões de save, sprites GIF nem `isaquesan7/pokedex`.

**Próxima D-064BB:** teste de sensibilidade com loadouts aprendidos e equipes efetivamente capturadas, decisão de tutorial/XP/nível da região2 baseada nos dados, sem concessões ou reequilíbrio artificial.


## Resultados efetivamente observados na CI (HEAD `510946b73c465ef6234ee9833e84fafa955bd0e7`)

`D064BA_STARTER_COHORT_REPORT`: testes de writer passaram na regressão `44967852458` sem erros. São seis jornadas independentes por inicial e política; cada linha resume **576 batalhas** (96 por perfil, total de 3.456).

| Inicial | Política | Vitórias | Nv Pokémon médio final | Nv treinador médio final | Evoluções Nv16 | Região2 liberada |
|---|---|---:|---:|---:|---:|---:|
| Bulbasaur | Somente combate | 216/576 (37,50%) | 10,33 | 7,33 | 0/6 | 5/6 |
| Bulbasaur | Com expedições | 406/576 (70,49%) | 25,67 | 13,67 | 6/6 | 6/6 |
| Charmander | Somente combate | 290/576 (50,35%) | 13,50 | 8,67 | 2/6 | 6/6 |
| Charmander | Com expedições | 433/576 (75,17%) | 26,00 | 14,00 | 6/6 | 6/6 |
| Squirtle | Somente combate | 183/576 (31,77%) | 9,17 | 6,50 | 0/6 | 5/6 |
| Squirtle | Com expedições | 406/576 (70,49%) | 25,67 | 13,67 | 6/6 | 6/6 |

**Marcos (mediana em tentativa de batalha; apenas perfis que chegaram ao marco):**

| Inicial | Política | Primeiro Nv2 | Treinador Nv6 | Primeiro Nv16 / evolução |
|---|---|---:|---:|---:|
| Bulbasaur | Só combate | 4 | 71 (5/6) | não alcançou |
| Bulbasaur | Expedições | 4 | 34,5 | 52 |
| Charmander | Só combate | 4 | 58 | 95 (2/6) |
| Charmander | Expedições | 4 | 31 | 50 |
| Squirtle | Só combate | 4 | 76 (5/6) | não alcançou |
| Squirtle | Expedições | 4 | 35,5 | 52,5 |

**Leitura crítica:**
- Sem expedições, o Charmander venceu **50,35%**, versus Bulbasaur **37,50%** e Squirtle **31,77%** nas seeds escolhidas. Diferença de até **18,58 pontos percentuais** entre Charmander e Squirtle. Isso justifica um estudo separado de matchups e golpes, **não buff/nerf imediato**.
- Com 120 minutos totais de expedição por perfil (8×15 min), 18/18 alcançaram Nv16 e abriram R2. Sem expedições, 2/18 alcançaram Nv16 e 16/18 abriram R2 dentro de 96 combates. A jornada só de combate é visivelmente mais lenta, mas o tempo de interação por batalha **não foi medido** nesta auditoria.
- Os 36 perfis chegam ao Nv2 **na quarta tentativa** independentemente do inicial, demonstrando que o piso de aprendizado de D064AZ impede o softlock. Eles não começaram com golpe novo equipado, não investiram pontos e não utilizaram capturas ou equipamento; portanto, o resultado **não é avaliação máxima de potencial dos iniciais**.
- O ganho da expedição é contabilizado pelo motor como ciclos de 10 segundos; os minutos usados são **simulação de relógio** para testar regras. Não confundir 120 minutos simulados com o tempo real gasto pelo usuário nem afirmar que o ganho de XP é um tuning já aprovado.
- Primeira evolução foi uma ação explícita de writer, com UID/nível/XP preservados. A R2 foi confirmada por batalha aceita somente após treinador Nv6. Nenhuma região foi desbloqueada por injeção de níveis.

**Decisão D064BA:** preservar os parâmetros publicados e priorizar D064BB: comparar golpes equipáveis legítimos por nível e composição de equipes capturadas (sem presumir compra/captura), explorar evolução manual e cadência de expedições antes de propor mudanças de força ou XP.

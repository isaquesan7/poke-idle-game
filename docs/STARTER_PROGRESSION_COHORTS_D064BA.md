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

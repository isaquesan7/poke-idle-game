# D-064AX — progressão via writers + tempo real de replay

**21/11/2026 — testes de diagnóstico; nenhuma regra funcional alterada.**

## Contexto
D064AW PR #124 integrou 2.880 simulações comparando IA selvagem de golpe único à IA de movesets FRLG legais. O relatório identificou vitória agregada de 73,89% para a IA antiga versus 66,94% para a atual, com foco especial na região 9. São cenários hipotéticos: líderes evoluídos e treinados diretamente pela fixture sem comprovar posse nem XP adquiridos por ações de jogador.

## Parte 1 — writers reais
Arquivo `apps/web/src/play/d064ax-writer-progression.test.ts`:
- Para os três iniciais no **modo demonstração autorizado** (nível20), cria save por `createPlaySave`, solicita evolução pelo writer `updatePlaySave`, respeita UID e espécie/nível, verifica que destino ilegítimo é rejeitado sem incremento de revisão.
- Investe pontos de treinador/Pokémon somente pelo writer com revisão, faz 12 encontros por inicial no Bosque Inicial através do *writer regional real*, verifica frames/logs/receipts, progressão de níveis, UID, equipe e consistência da taxa de vitórias com `regionWins`. Não inventa capturas nem aquisição de Pokémon.
- Para um perfil **normal nível5**, confirma evolução prematura e região 9 bloqueadas, depois registra encontro real da região1 sem alteração de dados de terceiros.
- **Limitação:** demo começa no nível20 e não valida horas de grind do nível1 nem obtenção de pedras ou espécies de regiões tardias; o teste normal mede apenas primeiro encontro. Não chamar isso de comprovação de acesso às regiões 8–10. Não há telemetria real de jogadores.

## Parte 2 — tempo de replay
A integração Playwright já executada pela CI em `apps/web/tests/e2e/playable-route.mjs` passa a coletar relógio `performance.now()` no Chromium pelo `MutationObserver`, registrando intervalos visíveis de 1× e 2× em **desktop (1365×768) e celular (390×844)**. Permanece o teste de pausa, avanço manual, teclado e preservação de HP/SP/GIFs, com confirmação de que reassistir não muda localStorage, recibos ou recompensas. Marcador de log `D064AX_BROWSER_PLAYBACK` contém medições efetivas com dispositivo, velocidade e intervalos. Os limites de teste são deliberadamente tolerantes à variação de recursos em CI; números reais têm de ser lidos em logs, não estimados pela equação 900ms/linha.

## Exclusões e próxima análise
Nenhum parâmetro de força, seleção de IA, PP/SP, XP/nível, captura, equipe, catálogo TM, expedição, região ou sistema de save foi alterado. Os writers e browser tests operam em memória/perfis isolados de teste.

Próxima **D064AY**: reproduzir trajetória de progressão sem demo incluindo expedições, aquisição com Pokébolas ganhas e evoluções legais, traçando os desbloqueios por nível do treinador. Só considerar rebalancear região9 após esse diagnóstico, sem alterar a raridade dos lendários por hipótese.


## Medições confirmadas no CI (HEAD `0a6246c65301e1c6c13e2cf6df24f38306e89dc0`)

Regressão `44963114387 SUCCESS`, Playwright isolado `44963114443 SUCCESS`, Docker/HTTP `44963114382 SUCCESS`. No teste jogável `/play`, timestamps foram coletados pelo Chromium via `performance.now()`, medindo 2 intervalos consecutivos por dispositivo e velocidade:

| Browser / viewport | Velocidade | Intervalos medidos | Média |
|---|---:|---|---:|
| Chromium desktop 1365×768 | 1× | 892, 900 ms | **896 ms** |
| Chromium desktop 1365×768 | 2× | 445, 451 ms | **448 ms** |
| Chromium mobile 390×844 | 1× | 898, 900 ms | **899 ms** |
| Chromium mobile 390×844 | 2× | 448, 451 ms | **449 ms** |

Os timings 2× são aproximadamente metade dos 1×. Pausa, passo manual, teclado, HP/SP/GIF persistentes e replay read-only continuam cobertos pela mesma suíte. São poucas observações em Chromium automatizado, não benchmark de hardware real diverso; não extrapolar para telefones de baixo desempenho.

O teste dos writers passou no core web Vitest: três starters em modo demo nível20, evolução para estágio 2, investimento batch e 12 batalhas regionais cada; em modo não demo nível5, bloqueios de evolução/região9 e primeiro encontro regional com UID/receipts íntegros. Não mede trajetória normal até R9 nem troca em equipe.

# AGENTS.md — continuidade obrigatória do Poke Idle Game

> PONTO DE ENTRADA PARA NOVOS CHATS E AGENTES. Leia este arquivo antes de planejar ou alterar código.
> Atualizado em 2026-11-17. A fonte final do estado técnico é o próprio GitHub/Railway; confira sempre os dados ao vivo.
> **RELEASE MAIS RECENTE CONFIRMADA (17/11/2026):** PR #50 https://github.com/isaquesan7/poke-idle-game/pull/50 **MERGED** em main código SHA **0b8e73ad8e8b79ea218e9309085e175f4c1106bc**. CI PR **44217630211 completed/success** e CI pós-merge main **44217888940 completed/success** (TypeScript, Vitest, build, Node legado, 151 GIFs, E2E Chromium v0.1 e /play desktop/mobile). Railway deploy **59233a8f-47cc-4572-bf0d-3d0d45a709bd SUCCESS** no SHA exato, build Vite 1.19s, runtime Node porta 8080 e healthcheck INTERNO **/health succeeded!**. **D-038:** custo SP híbrido a partir de PP oficial versionado da PokéAPI para os 29 golpes da Arena (snapshot PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a, moves.csv blob a55116329ca22f230fea953de94c2d1dffe2ad0e), potência e efeitos; capacidade por espécie e nível (40–100 SP) usando Sp. Atk/Sp. Def/HP base; Concentrar abdica de atacar e recupera até 30% SP, máximo 2 usos/combate e 4 turnos entre usos, sem regeneração passiva; ataque básico gratuito neutro sem STAB, atinge Ghost, Normais equipados continuam imunes. UI mostra PP oficial distinto de SP do jogo, custo e concentração sincronizada ao replay/HP/SP, reduced motion. Testes incluem **1.152 duelos determinísticos** (18 espécies × 4 níveis × 16 seeds), 151 capacidades por espécie, SP nunca negativo, concentrações limitadas e Ghost. D-037 salva HP/SP histórico e D-036 salva HP; replays antigos não recalculados, sem reset de save v0.2 schema2/key, sem novos prêmios/writers. Sem usuários reais, backend, contas ou antifraude; / v0.1 e repositório isaquesan7/pokedex preservados. **PRÓXIMO:** revisar acessibilidade teclado/leitor de tela e UX Arena, analisar npm audit, simular balanceamento mais amplo de status e cooldown antes de beta. GET público externo /play não verificado; healthcheck interno e E2E local aprovados. Ver último bloco docs/PROJECT_STATE.md.

## Identidade e limites
- Projeto: **Poke Idle Game / Kanto Idle LAB** (protótipo v0.1; Season 1: Pokémon #001–#151).
- **Único repositório autorizado para este jogo:** https://github.com/isaquesan7/poke-idle-game
- **NÃO modificar** o repositório original https://github.com/isaquesan7/pokedex — nem branches, commits, PRs ou arquivos — sem autorização expressa e específica do usuário.
- Ambiente de produção: https://kanto-idle-web-production.up.railway.app/
- A branch `main` está conectada ao Railway: novos pushes podem disparar deploy.
- Pokémon e sprites são propriedade de seus titulares. PokéAPI fornece dados, não licença de exploração comercial. Projeto experimental não oficial.
- Não assumir que informações neste arquivo substituem verificações dos arquivos atuais, da branch, do deploy, dos testes ou da configuração remota.

## Leitura inicial obrigatória
1. `docs/PROJECT_STATE.md`: estado implementado, infraestrutura, testes, pendências e próximo passo.
2. `docs/GDD.md`: regras acertadas com o usuário e distinção entre decisões e propostas.
3. `docs/DECISIONS.md`: decisões arquiteturais e de produto com razões.
4. `docs/ARCHITECTURE.md` e `docs/DESIGN_SYSTEM.md`: estrutura-alvo e identidade visual.
5. `docs/CONVENTIONS.md`, `docs/RELEASE_CHECKLIST.md` e `CHANGELOG.md`.
6. Ler o código atual antes de editar: hoje `index.html` contém lógica/UI e `server.mjs` serve a página.

## Regras críticas de negócio
- Base PokéAPI é referência da espécie e não recebe pontos manuais.
- Cada Pokémon capturado tem ID/estado individual, nível, XP, afinidade e pontos próprios.
- Treinador: limite de **40 pontos distribuídos manualmente por atributo**, NÃO limite de status total. Pontos de itens, título ativo e **todas** as insígnias conquistadas são adicionais e cumulativos por fonte.
- Bônus para cada atributo do Pokémon: `floor(atributoTotalTreinador * (0.08 + 0.02 * afinidade/100))`. É ADIÇÃO EM PONTOS ao status do Pokémon, NÃO multiplicação do status do Pokémon por 8–10%.
- Afinidade individual de 0 a 100; 0 dá taxa 8% e 100 dá 10%. Afinidade acompanha a instância do Pokémon e deve sobreviver à evolução.
- Atributos: HP, Attack, Defense, Special Attack, Special Defense, Speed.
- Um título ativo; insígnias NÃO possuem slot ativo: todos os bônus de insígnias adquiridas se acumulam.
- Itens: 9 slots (chapéu, jaqueta, luvas, calça, sapatos, colar, anel 1, anel 2, brincos). Raridades e catálogo definitivo PENDENTES.
- Outras constantes da v0.1 são PROVISÓRIAS; conferir em `docs/GDD.md`.

## Instruções operacionais
- Antes de iniciar tarefa: verificar branch, HEAD, arquivos, deploy, possíveis mudanças de terceiros e documentação. Não presumir que o estado de 2026-11-16 continua atual.
- **Preferir branch de trabalho + PR** para alterações de código. A `main` publica automaticamente. Não fazer alterações destrutivas nem forçar push.
- Nunca publicar sem testes; monitorar resultado terminal `SUCCESS` do novo deploy, healthcheck e teste do site.
- **Revisão D-027 (pré-lançamento sem jogadores reais):** é permitido reiniciar dados de TESTE v0.2 com confirmação, e não é obrigatória migração de progresso legado para a nova experiência. A chave legada `kanto-idle-lab-save-v01` permanece separada por enquanto; nunca usar `localStorage.clear()` nem apagar outros dados do navegador. Antes do lançamento com jogadores, redefinir política de compatibilidade, backup e persistência.
- Não apagar nenhum dado automaticamente para “corrigir” problemas; reinicialização de dados **de teste** v0.2 requer ação/confirmacão visível. Quando existirem jogadores reais, proteger persistência com política própria antes de mudanças incompatíveis.
- Sem contas/backend atualmente: não descrever salvamento local como seguro ou persistência de servidor.
- Não inserir segredos, tokens, e-mails pessoais ou credenciais no repositório.
- Se não for possível completar uma ação, registrar pendência honestamente, sem afirmar que foi concluída.

## REGRA DE DOCUMENTAÇÃO A CADA ALTERAÇÃO
Toda alteração funcional, visual, arquitetural, de infraestrutura ou regra de negócio DEVE atualizar, no MESMO PR/commit quando possível:
1. `CHANGELOG.md` — o que mudou, por que e se houve deploy;
2. `docs/PROJECT_STATE.md` — estado verificado, HEAD, ambiente, o que funciona, pendências e **próxima ação concreta**;
3. `docs/DECISIONS.md` — se houver nova decisão, mudança ou revogação de regra;
4. `docs/GDD.md` — se mudar mecânica, números ou balanceamento;
5. `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/CONVENTIONS.md` — se aplicáveis.
Não apagar histórico: marcar decisões superadas, preservando razão e data. Se documentação e código divergirem, registrar a divergência e verificar antes de alterar.

## Protocolo de troca de chat
A pessoa pode dizer: **“Continue o Poke Idle Game pelo AGENTS.md e docs/PROJECT_STATE.md do GitHub.”**
O novo chat deve ler os arquivos acima, verificar a situação real no GitHub/Railway, explicar brevemente o último estado e dar continuidade SEM pedir ao usuário que reconte o projeto.

> **Histórico de implementação (2026-11-17):** trabalho inicialmente feito em `feat/v02-evolution-by-uid`; PR #40 integrada; consulte os registros cronológicos em `docs/PROJECT_STATE.md`.

> **Histórico de branch (17/11/2026):** `feat/v02-combat-status-secondary` foi integrada pela PR #42; histórico de CI/merge/deploy confirmado no último registro de `docs/PROJECT_STATE.md`.

> **Histórico da etapa (17/11/2026):** branch `feat/v02-multi-moves-support-ai` publicada na PR #44. O último bloco de `docs/PROJECT_STATE.md` contém CI e Railway confirmados; próxima fase: HP/ataques animados.


> Histórico da etapa (17/11/2026): feat/v02-animated-hp-battle-stage foi integrada pela PR #46. CI e Railway confirmados no último bloco de docs/PROJECT_STATE.md; próximo passo: efeitos visuais por tipo/crítico e acessibilidade.

> **Histórico D-037 (2026-11-17):** `feat/v02-sp-budget-and-battle-feedback` publicada pela PR #48; consulte estado verificado de CI e Railway no final de `docs/PROJECT_STATE.md`.

> **D-039 EM BRANCH (ainda NÃO publicada; atualização da etapa 2026-11-17):** `feat/v02-arena-accessibility-balance-d039`. Prepara custo de SP para /move/{id} futuros sem desbloquear golpes: `kantoPreviewMoveSpCost` normaliza `power:null`, trata cura `meta.category.name='heal'` com +18 SP (Recover 5PP = 36 SP), multiplica poder de multi-hit (2..5 usa estimativa 2.5; hits fixos exatos) e valida faixas; catálogo executável e combate continuam apenas com os 29 movimentos conhecidos. SPmax D-038 ajustado para `clamp(50,100,36+floor(level/3)+floor((SpAtk_base+SpDef_base)/14)+floor(HP_base/20))` → piso50 cobre qualquer ataque com custo <=40 e mantém diferenciação de espécie no nível20. Arena: teclado Tab/Espaço/ArrowRight, botão de avanço linha única, leitura assistiva opcional com 3s/linha e live region dedicada, timer/log com anúncios controlados; Concentrar tem banner "+SP", medidor realçado e reduced-motion; reprodução continua read-only com saves antigos intactos. Matriz de equilíbrio 1.152 duelos + 768 de suporte = **1.920** seeds/combinações, cobertura de todos 151 SP, cura/multi-hit futuros e E2E acessibilidade desktop/mobile. **Não afirmar merge/CI/produção** até verificar status terminal e atualizar o último PROJECT_STATE. Próxima etapa depois: revisão real com leitores de tela/usuários, expansão do motor para cura/multi-hit com catálogo e testes de equilíbrio e classificação npm audit antes da beta.

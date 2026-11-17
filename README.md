# Poke Idle Game — Kanto Idle / LAB v0.1

Protótipo experimental **não oficial** de RPG idle com Pokémon da região de Kanto, utilizando dados da [PokéAPI](https://pokeapi.co/docs/v2).

## Links oficiais deste projeto
- **Repositório de desenvolvimento:** https://github.com/isaquesan7/poke-idle-game
- **Jogo online:** https://kanto-idle-web-production.up.railway.app/
- **Ponto de entrada para novos chats/agentes:** [AGENTS.md](AGENTS.md)
- **Estado atual / próximos passos:** [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md)
- **Histórico de atualizações:** [CHANGELOG.md](CHANGELOG.md)

## Documentação do projeto
| Arquivo | Conteúdo |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Regras de continuidade e atualização obrigatória para novos chats |
| [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) | Implementado, infraestrutura, pendências, próximo passo |
| [docs/GDD.md](docs/GDD.md) | Mecânicas acordadas vs. propostas e fórmulas |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Registro de decisões e regras substituídas |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura atual e migração planejada |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Paleta Kanto Dark e componentes |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Padrões de código, comentários e testes |
| [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) | Checklist antes de merges, deploys e troca de chats |
| [assets/README.md](assets/README.md) | Diretrizes para futuros assets visuais |

## Executar localmente
Requer Node.js >=18.
```bash
npm start
# abrir http://localhost:3000
```
Opcionalmente, abrir `index.html` diretamente no navegador com internet.

## Estilos organizados (revisão em branch)
Na branch `refactor/css-tokens-comments-v01` a camada visual foi dividida em `styles/tokens.css` (variáveis globais) e `styles/app.css` (classes comentadas e organizadas). A mudança permanece em revisão até ser aprovada/mesclada. Detalhes em [Design System](docs/DESIGN_SYSTEM.md) e [Estado](docs/PROJECT_STATE.md).

## Como está publicada a versão atual
- A branch **`main` está conectada ao Railway**, e novos pushes podem iniciar deploys automáticos.
- Serviço: `kanto-idle-web`; start: `npm start`; healthcheck `/health`.
- Mudanças na `main` precisam de testes e validação; preferir branch + PR para código.
- Nenhum backend ou banco de dados está presente no protótipo: progresso salvo no `localStorage` do navegador.
- A arquitetura React/TypeScript/Vite é **plano para v0.2**, ainda não implementada.

## Funcionalidades da v0.1
- Catálogo 151 Pokémon Kanto sob consulta à PokéAPI e inicial Bulbasaur/Charmander/Squirtle.
- Treinador com nível/XP, atributos distribuíveis e bônus de equipamentos, título e **todas** as insígnias.
- Pokémon com nível/XP, treino individual, afinidade, golpe melhorável e instâncias únicas.
- Transferência de 8%–10% dos atributos totais do treinador em **pontos adicionais** para cada Pokémon, segundo afinidade.
- Pokédex, Arena simplificada, captura experimental e expedição idle com limite de 8h por resgate.
- Modo de teste e salvamento local.

## Limitações e propriedade intelectual
- Regras de combate, drops, itens e economia são de laboratório; não existe antifraude de servidor.
- Nenhum sincronismo entre dispositivos; excluir dados do navegador apaga progresso.
- Requer internet para PokéAPI e sprites remotos (alguns dados dos iniciais têm fallback).
- Pokémon, personagens e marcas pertencem aos respectivos titulares. A PokéAPI fornece dados, mas **não licencia o uso comercial da franquia**.

## Repositório original intocado
`isaquesan7/pokedex` é projeto separado de referência. **Não modificar** sem autorização expressa e específica.


## GIFs animados de Kanto — [PR #2 em revisão](https://github.com/isaquesan7/poke-idle-game/pull/2)
Na branch `feat/kanto-animated-gifs-v01`, as imagens de Pokémon #001–#151
passam a apontar para `assets/pokemon-gifs/poke_ID.gif`; se o GIF não estiver
disponível, a interface utiliza a arte estática da PokéAPI como fallback.
O repositório original `isaquesan7/pokedex` é usado SOMENTE como fonte de leitura.
Os 151 arquivos binários (56.582.531 bytes) foram importados na branch
pelo workflow GitHub Actions `43965699462`, concluído com sucesso.

Com Node >=18: `npm run sync:gifs`, `npm run verify:gifs`, `npm test`.
A integração depende da PR #1 (tokens CSS); não publicar na `main` sem revisão
e testes. A licença e os direitos sobre Pokémon e ilustrações continuam dos
respectivos titulares, não havendo permissão comercial implícita.


## Foundation v0.2 (branch de desenvolvimento)
- Pacote `packages/game-core`: TypeScript puro, regras de status, afinidade, XP e recompensas; sem acesso ao navegador.
- Com Node 22 para testes: `npm ci`, `npm run typecheck:core`, `npm run test:core`, `npm test`.
- A página pública v0.1 continua servida por `server.mjs`; este pacote ainda não está ligado à interface.
- PRs #1 e #2 já foram integradas à `main` e os GIFs estão em produção (Railway `SUCCESS`). Os parágrafos anteriores sobre revisão descrevem o histórico das PRs.


## Prévia React independente (trabalho em branch)
`npm run dev:web` inicia o workspace `apps/web` (Node 22); `npm run typecheck:web`, `npm run test:web` e `npm run build:web` validam os contratos. A UI atual ainda é o `index.html` legado e não é substituída por essa prévia. Para o backup de save v0.1, a prévia apenas lê e exporta o JSON; dados de domínios distintos não são compartilhados.


### Situação de validação da Foundation
PR #3 e PR #4 permanecem em revisão, com GitHub Actions aprovado para core, build React e regressão Chromium do backup de save v0.1. A `main`/Railway ainda executa o jogo v0.1 com GIFs. Ver `docs/PROJECT_STATE.md` para commits, runs e próxima etapa.


## Visão geral e treinador na prévia v0.2
A branch `feat/react-trainer-overview-v02` prepara as telas React alimentadas pelo `@kanto/game-core`, mantendo os bônus, o limite manual e a afinidade da v0.1. `npm run dev:web` abre a prévia somente leitura do save/cache da própria origem. Não há treino, equipamento, resgate ou migração de dados; o pipeline está em `.github/workflows/trainer-overview-parity.yml`.

Validação confirmada da PR #5: workflow `43975797448` (`SUCCESS`) e lockfile sincronizado na branch. A produção v0.1 permanece inalterada; migrar comandos de escrita requer desenho posterior de persistência versionada.


## Simulação versionada v0.2 (somente branch de revisão)
A branch `feat/versioned-trainer-drafts-v02` adiciona rascunho experimental separado para testar atributos e equipamentos no React. O progresso de verdade v0.1 nunca é escrito pela nova interface. Rascunho: `kanto-idle-lab-save-v02-draft` com versão, revisão e cópia original; pode ser descartado explicitamente. Web Locks controlam as edições; sem essa API, a interface deixa de editar. Não existe sincronização de dispositivos nem promoção automática da simulação ao jogo publicado. Testes no CI `draft-persistence.yml`.

Validação da simulação versionada: [GitHub Actions #43978606016](https://github.com/isaquesan7/poke-idle-game/actions/runs/43978606016), `SUCCESS`. Não há migração de progresso nem publicação desta PR na `main`.


## Pré-verificação de migração e proteção do progresso
A branch `feat/v02-migration-preflight` adiciona diagnóstico **somente leitura** do save v0.1, sem botão de migração. O plano detalhado de backup, coordenação de writers e rollback está em `docs/SAVE_MIGRATION_PLAN.md`. A validade estrutural não significa que abas antigas tenham parado de gravar; migração real permanece bloqueada até projeto separado. Workflow `.github/workflows/main-regression.yml` verificará continuamente main e PRs quando integrado.

Estado 2026-11-16: PRs #3–#6 já foram integradas à main e os deploys Railway confirmaram SUCCESS. O jogo publicado continua v0.1; React ainda é workspace experimental sem rota pública.


### Handoff de release — 2026-11-16
As PRs #3 a #7 da Foundation foram integradas à `main` (SHA `b099e750`) com deploy Railway `SUCCESS` e testes de `main` aprovados em [GitHub Actions #43982463671](https://github.com/isaquesan7/poke-idle-game/actions/runs/43982463671). O público continua jogando a v0.1; as novas telas React, simulação e preflight não substituem nem alteram o save real. Próximo trabalho: contrato de save oficial v0.2 e backup recuperável, segundo `docs/SAVE_MIGRATION_PLAN.md`.


## Ensaio do save oficial v0.2 e backup (sem migração real)
A branch `feat/v02-official-save-backup-contract` prepara os contratos `OfficialSaveV02`, `OriginBackupV02` e `RecoveryBundleV02` e o plano de journal de recuperação, **somente em funções e testes**. O progresso do jogador não é movido e `kanto-idle-lab-save-v01` não recebe writes. O futuro snapshot v0.2 carrega o payload legado completo até que todas as mecânicas tenham sido portadas; backups preservam bytes exatos e podem ser inspecionados/extrair texto sem alterar dados. Execução de testes: `npm run typecheck:web` e `npm run test:web`. Ver limites em `docs/SAVE_MIGRATION_PLAN.md`.

Validação do contrato de backup na PR #9: [GitHub Actions #43983797980](https://github.com/isaquesan7/poke-idle-game/actions/runs/43983797980) `SUCCESS`. A implementação continua sem `setItem`/`removeItem` e sem migração automática.


### Handoff de backup v0.2 — 2026-11-16
A PR #9 foi integrada ao repositório no commit `bd530666`, com GitHub Actions [43984189208](https://github.com/isaquesan7/poke-idle-game/actions/runs/43984189208) em `SUCCESS` e deploy Railway `dfca3072-3ef3-4c5f-8113-f525abebc4b1` em `SUCCESS`. O jogo público continua na v0.1; os contratos de backup/journal não escrevem saves. Próxima etapa: writer único, importação/recuperação opt-in e testes de quota/concorrência. Ver a última seção de `docs/PROJECT_STATE.md`.


### Pacote de recuperação verificável (somente prévia React)
Na branch `feat/v02-writer-coordination-and-recovery-export`, a interface React experimental permite baixar um pacote JSON com SHA-256 e conferir um arquivo externo sem importá-lo. O fluxo preserva os bytes do save v0.1; a v0.1 publicada não é interrompida. O novo contrato de Web Locks limita-se às futuras abas v0.2 cooperativas, **não** pode bloquear instâncias legadas já abertas. Decisão D-019 e próxima etapa de laboratório em `docs/SAVE_MIGRATION_PLAN.md`.


### Handoff da PR #11 — 2026-11-16
A PR #11 foi integrada na `main` (`9369e4a4`), com Railway `SUCCESS`. Backup SHA-256 + conferência de arquivo são recursos SOMENTE da prévia React, sem migração ou escrita no save real. O CI pós-merge apresentou um timeout intermitente de fallback de GIF #25 no E2E legado devido ao cache do Chromium; a correção instala a interceptação antes de carregar a Pokédex (`fix/legacy-e2e-fallback-cache-and-handoff`). Acompanhar novo CI antes de declarar regressão resolvida; detalhes no final de `docs/PROJECT_STATE.md`.


### Handoff validado — writers e recuperação (2026-11-16)
PRs #11 e #12 integradas à `main` no SHA `db10572b`, com deploy Railway `293781a0` `SUCCESS` e teste completo em [GitHub Actions #43987571827](https://github.com/isaquesan7/poke-idle-game/actions/runs/43987571827) `SUCCESS`. A PR #12 corrigiu a intermitência de fallback do GIF #25 nos E2E. A prévia React exporta/confere pacotes SHA-256 **sem restaurar**, o protocolo de writer v0.2 segue **somente experimental** e o jogo online continua v0.1. Próximo trabalho: cutover opt-in e recuperação testados em storage temporário, não no progresso real. Consulte a última seção de `docs/PROJECT_STATE.md`.


### Laboratório de migração opt-in (experimental)
A branch `feat/v02-cutover-memory-laboratory` introduz uma simulação de migração com `MigrationMemoryLab` usando somente um `Map` em RAM. Na prévia React é possível selecionar quota, crash, divergência da aba legada e execução íntegra, após consentimento explícito. A simulação NUNCA importa, restaura ou grava o progresso real, e o Railway segue servindo a v0.1. Testes: `npm run test:web`, `npm run typecheck:web` e E2E desktop/mobile em CI. Consulte `docs/SAVE_MIGRATION_PLAN.md`.


### Estado confirmado — laboratório RAM v0.2 (2026-11-16)
A PR #14 integrou o laboratório opt-in ao código da `main` SHA `455c29a9`, com [CI final #43989615947](https://github.com/isaquesan7/poke-idle-game/actions/runs/43989615947) `SUCCESS` e deploy Railway `b621615b` `SUCCESS`. A simulação roda em `Map` privado, incluindo crashes, quota e divergência; a UI React ainda não é exposta na página publicada. A v0.1 e os saves reais estão preservados. Próxima prioridade: coordenação de um único writer, cutover opt-in e rollback, conforme `docs/SAVE_MIGRATION_PLAN.md`.


### Teste real de browser isolado (não disponível no jogo público)
A branch `feat/v02-isolated-browser-cutover-tests` adiciona `browserSandboxCutover.ts` e E2E Chromium usando Vite na origem localhost:5174, rota `/__kanto_v02_browser_lab__` e chaves exclusivas `__kanto_lab__*`. Exercita erros reais de quota, Web Locks entre abas, crash/reload e rollback somente do candidato de teste. **Não é migração real nem backend de save**: o runtime online permanece v0.1 e as chaves oficiais nunca são acessadas por esse laboratório. Ver `docs/SAVE_MIGRATION_PLAN.md` e decisão D-021.


### Handoff de testes reais de migração — 2026-11-16
A PR #16 integrou o laboratório de browser isolado à `main` (SHA `977d14a9`). O deploy Railway `54ccff55` e [GitHub Actions pós-merge #43991985570](https://github.com/isaquesan7/poke-idle-game/actions/runs/43991985570) ficaram em `SUCCESS`. A função testa storage nativo em localhost, sem gravar nenhum save oficial; o jogo online continua v0.1. Para o próximo ciclo, ver `docs/CUTOVER_AUTHORITY_PROPOSAL.md` e a última seção de `docs/PROJECT_STATE.md`.


### Auditoria de migração e ações legadas (em revisão)
A branch `feat/v02-fail-closed-cutover-gate-and-mutation-audit` acrescenta um diagnóstico React que **sempre bloqueia** cutover oficial da v0.1 para v0.2, mesmo com save válido/Web Locks. O inventário em [`docs/LEGACY_MUTATION_MATRIX.md`](docs/LEGACY_MUTATION_MATRIX.md) cobre os 21 handlers e os escritores indiretos do protótipo. Nenhum botão de migração nem writer oficial foi criado; runtime público v0.1 permanece inalterado. Testes de gate em Vitest e de auditoria em Node/E2E fazem parte do workflow permanente.

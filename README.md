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

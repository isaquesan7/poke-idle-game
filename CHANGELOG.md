# CHANGELOG — Poke Idle Game
Histórico de entregas. **Toda atualização futura deve acrescentar uma entrada aqui** e atualizar `docs/PROJECT_STATE.md` no mesmo trabalho. Não reescrever/ocultar histórico. Use data, escopo, commit, testes, deploy e pendências.

## [Unreleased]
- **2026-11-16 · PR de GIFs Kanto em preparação:** branch \`feat/kanto-animated-gifs-v01\`
  empilhada sobre a PR #1 de CSS. A interface passa a preferir
  \`assets/pokemon-gifs/poke_ID.gif\` para #001–#151; fallback estático,
  rota HTTP allowlist, importador fixado em SHA, testes, verificador e
  GitHub Actions para copiar os arquivos na branch. A importação dos
  **151 binários precisa ser confirmada após o workflow**.
  Salvas locais intocadas. **Deploy:** nenhum para esta branch.
  **Próxima ação:** validar o workflow, testes e as duas PRs antes de merge.
- PR em revisão na branch `refactor/css-tokens-comments-v01`: CSS retirado do HTML, `:root` com tokens de cores/sombras/raios/espaçamentos, classes documentadas, rotas CSS explícitas e testes de contrato; sem alteração de lógica de jogo, sem deploy na `main`.
- Planejada a refatoração v0.2 Foundation: módulos, React/TS/Vite, game-core e testes; **nenhum código de v0.2 implantado ainda**.
- Catálogo de raridades de itens, evolução, ginásios, motor completo de combate e backend pendentes.

## [docs-1.0] — 2026-11-16
**Escopo:** somente documentação e continuidade, sem mudanças de mecânica, JavaScript ou servidor.
- Adicionado `AGENTS.md` como guia obrigatório para novos chats.
- Adicionados documentos de estado, GDD, decisões, arquitetura, design system, convenções e checklist de release.
- Criada referência `assets/README.md` para futuros ativos visuais.
- Atualizado README para corrigir informação antiga: GitHub `main` **já está conectado** ao Railway.
- Registro das diferenças entre o jogo v0.1 implementado e funcionalidades apenas planejadas.
- **Testes desta entrega:** verificação documental e dos arquivos/serviço atuais; nenhum teste funcional novo.
- **Deploy:** verificar resultado terminal da implantação documental e registrar em `docs/PROJECT_STATE.md` no próximo registro de trabalho; não confundir alteração de documentação com nova versão jogável.

## [v0.1.0] — 2026-11-16
- Protótipo HTML/CSS/JS com treinador e Pokémon, stats distribuíveis, afinidade, itens/título/insígnias, Pokédex Kanto, Arena e expedições idle.
- Dados de espécies e golpes pela PokéAPI, com fallback mínimo dos iniciais.
- Primeiro projeto de hospedagem Railway `kanto-idle-lab` e URL pública.
- Usuário confirmou que protótipo está funcional.
- Criado repositório independente `isaquesan7/poke-idle-game`, primeiro commit de publicação `227a079ba3e7bce5740606321b2efa2bb20427a9`.
- GitHub `main` conectado ao serviço Railway; primeira implantação pela fonte GitHub `51d7a571-0adc-4339-ad11-c8fb02343d8e` em `SUCCESS`, com `/health` HTTP 200; commit `9076a3e745ee58a34c5a40e338fc9e45002d9753`.
- Sem backend, sem testes automatizados reais do jogo, sem preservação entre dispositivos; código ainda centralizado em `index.html`.

## Modelo para próximas entradas
```md
## [vX.Y.Z] — AAAA-MM-DD
- Objetivo:
- Alterações (arquivos/funcionalidades):
- Regras ou decisões alteradas:
- Testes executados / não executados:
- Branch e commit:
- Deploy Railway: status e ID (se aplicável):
- Pendências/alertas:
- Próxima ação:
```

# Estado do projeto e handoff para o próximo chat

**Última revisão:** 2026-11-16  
**Repositório:** https://github.com/isaquesan7/poke-idle-game  
**Branch de produção:** `main`  
**Site:** https://kanto-idle-web-production.up.railway.app/  
**Status de código:** protótipo jogável v0.1; *arquitetura v0.2 apenas planejada, ainda não migrada*.  
**Importante:** revise `AGENTS.md` e confira o HEAD/deploy atuais antes de continuar.

## Infraestrutura verificada em 2026-11-16
- Railway project `kanto-idle-lab`: `d4867d1e-3f02-4b3d-a52a-bc4be07d46ab`.
- Environment `production`: `dffdf664-9fc0-42c1-a16d-a9182cc91ea9`.
- Service `kanto-idle-web`: `203a6bdd-b6b7-4016-b7b9-208e390af794`.
- Branch conectada: `isaquesan7/poke-idle-game:main`, sem SHA fixado, deploy por push.
- Comando de início: `npm start`. Healthcheck: `/health`.
- Deploy anterior à documentação: `51d7a571-0adc-4339-ad11-c8fb02343d8e`, `SUCCESS`, commit `9076a3e745ee58a34c5a40e338fc9e45002d9753`; `/health` respondeu HTTP 200.
- **Reverificar o deploy após o commit documental e antes de informar status futuro.**
- O endereço online deve permanecer o mesmo; Railway pode ter custos conforme o plano.
- O projeto `isaquesan7/pokedex` é original de referência e deve permanecer INTACTO.

## Código que existe agora (v0.1)
```text
.gitignore
README.md
index.html        ← HTML + CSS + 55 funções JS em um arquivo, ~58 KB
package.json      ← Node >=18, npm start, teste apenas sintático do servidor
server.mjs        ← servidor HTTP de arquivo único e /health
AGENTS.md, docs/* e CHANGELOG.md ← governança/documentação
```
- `index.html`: dados PokéAPI, seleção de inicial Bulbasaur/Charmander/Squirtle, modo normal e demo; telas de visão geral, treinador, meus Pokémon, Pokédex e Arena; treinamento, equipamentos, títulos, insígnias, afinidade, combate e expedições.
- Pokédex: catálogo dos IDs 1–151, consulta da PokéAPI; snapshots locais somente dos 3 iniciais para fallback.
- Time: até 3 integrantes; combate simplificado hoje utiliza o Pokémon ativo, não o motor completo de combate por equipe.
- Pokémons capturados são instâncias com UID; há captura probabilística de inimigos após vitória (regras provisórias).
- Treinador e Pokémon: nível máximo **100 no protótipo**, +2 pontos por nível, máx. 40 investidos manualmente em cada atributo do treinador; pontos extras de equipamentos/título/insígnias **não são limitados a 40**.
- Bônus: `floor(trainerTotal[stat] * (0.08 + 0.02 * affinity/100))`, adicionado ao status correspondente do Pokémon.
- Afinidade: individual, 0–100; aumenta em combate e expedições; começa em 0.
- Títulos: um ativo; insígnias: **todas as conquistadas acumulam atributos**. No protótipo as 8 insígnias são desbloqueadas por número de vitórias (1,3,5,8,11,15,19,24), NÃO pelos ginásios reais.
- 9 slots de equipamento: hat, jacket, gloves, pants, shoes, necklace, ring1, ring2, earrings. Itens e atributos ainda são amostras sem raridades finais.
- Movimentos: um golpe ativo no combate atual, rank de aprimoramento, +5% de poder por rank (mecânica preliminar); sistema de 4 golpes, efeitos completos e AI de batalha são planejamento futuro.
- Expedição: 1 ciclo/10s; máximo de 2880 ciclos (8h) por resgate; recompensa de exemplo 7 moedas, 4 XP treinador, 5 XP Pokémon/ciclo; sem servidor antifraude.
- Dados salvos somente no navegador: `localStorage['kanto-idle-lab-save-v01']`, cache `localStorage['kanto-idle-lab-cache-v01']`. **Não apagar nem sobrescrever em migrações**.
- Fórmulas de XP/progresso e combate detalhadas em `docs/GDD.md`.
- Não existem autenticação, persistência entre dispositivos, PostgreSQL, API própria, pipeline CI, React, TypeScript, Vite ou suíte real de testes nesta v0.1.

## Decisões aprovadas pelo usuário
1. Season 1 com os 151 Pokémon originais, dados de espécie da PokéAPI.
2. Pokémon ganham níveis, distribuem atributos próprios e melhoram movimentos.
3. Treinador possui perfil, XP, nível e pontos de status.
4. Pontos de treinador + itens + um título ativo + **todas** as insígnias conquistadas somam o total do treinador; limite 40 somente na alocação manual.
5. Transferência aditiva de 8%–10% do status TOTAL do treinador ao Pokémon, conforme afinidade individual.
6. Equipamentos com 9 slots; raridades e itens finais a desenhar posteriormente.
7. Padrão técnico futuro: React + TypeScript + Vite, CSS Modules + tokens, `game-core` independente, Vitest, Playwright, backend Node/PostgreSQL somente quando necessário.
8. Visual Kanto Dark (cores em `docs/DESIGN_SYSTEM.md`).
9. Github original `isaquesan7/pokedex` sempre intocado.

## Atenção: o que NÃO está concluído
- Refatoração de `index.html` para módulos, React ou TypeScript.
- Automatização de testes, CI, branch protection.
- Regras de raridades, drop, itens definitivos, inventário de produção.
- Evolução de espécies, ginásios reais, golpes múltiplos/efeitos e controle avançado de batalha.
- Salvar em servidor, autenticação, anticheat e persistência de múltiplos usuários.
- Uso comercial/autorização de personagens e sprites.
- Auditoria completa de qualidade/balanceamento.

## Próxima etapa recomendada
**v0.2 Foundation (refatoração preservando funcionalidade).**
1. Registrar baseline da `main` e garantir backup/exportação de um save v0.1 em testes.
2. Criar branch `refactor/foundation-v0.2` (ou equivalente), sem publicar diretamente na `main`.
3. Introduzir estrutura `apps/web` e `packages/game-core`, TypeScript + Vite/React, lint/format e Vitest.
4. Primeiro extrair em funções puras o cálculo de status treinador/Pokémon, afinidade, XP e recompensas; testes com casos limite.
5. Migrar UI gradualmente sem perder Pokédex, Arena, expedições e save local; manter compatibilidade do armazenamento.
6. Criar verificação CI + Playwright, testar desktop/mobile, só então PR/merge e monitorar Railway `SUCCESS`.
7. Atualizar ESTE documento/CHANGELOG/decisões no mesmo trabalho.

## Registro da sessão atual
- Usuário aprovou a proposta de estrutura/cores/limpeza, pediu um ativo documental para novos chats e atualização contínua.
- Esta entrega é SOMENTE documentação e governança; **não implementa a arquitetura v0.2**.
- Após cada entrega futura, registrar: data, branch, commit, escopo, testes realizados, deploy observado, pendências, próxima tarefa. Não afirmar `SUCCESS` sem verificá-lo.

## Trabalho em revisão — CSS modular e tokens (2026-11-16)
- Branch de trabalho: `refactor/css-tokens-comments-v01`, derivada de `main` em `49f22f64`.
- CSS extraído do `index.html` para `styles/tokens.css` (cores, sombras, raios, espaçamentos e tipografia) e `styles/app.css` (classes documentadas individualmente e agrupadas por tela/componente).
- `server.mjs` passou a disponibilizar as duas rotas CSS por allowlist; `index.html` mantém toda a lógica JS e chave de save sem mudanças.
- Testes adicionados: `tests/style-contract.test.mjs` e script `npm test` para integridade de tokens/classes/rotas.
- Teste local preparatório: CSS analisado por parser, screenshots comparados no desktop (1365px) e mobile (390px), idênticos pixel a pixel em sessão de comparação de estilos; verificar novamente após revisão/merge.
- **Status: PR pendente; não publicado em produção.** A branch `main` e o site Railway permanecem na versão jogável anterior. Conferir HEAD/deploy antes de retomar.
- Próxima ação: revisar o PR, rodar `npm test`, validar CSS servido via HTTP e então, com aprovação, mesclar na `main` e observar deploy `SUCCESS`.

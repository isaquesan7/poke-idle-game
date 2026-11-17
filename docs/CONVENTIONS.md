# Convenções de código, comentários e documentação

## Código limpo
- TypeScript com `strict` (na v0.2), interfaces/contratos explícitos e sem `any` generalizado.
- Funções pequenas com responsabilidade única; cálculo de jogo em módulos puros separados da UI.
- Preferir imutabilidade e entradas validadas em limites de sistema; nunca confiar no cliente para recompensas.
- Evitar módulos gigantes, duplicação, números mágicos, condicionais complexas sem teste e dependências circulares.
- Reuso onde há repetição real; evitar abstração especulativa.
- Sem `console.log` de depuração, trechos comentados antigos ou segredos em commits de produção.
- Código morto deve ser excluído; histórico fica no Git, não em comentários inativos.

## Nomes
- Código em inglês: `camelCase` para funções/variáveis; `PascalCase` para tipos, classes e componentes React; `UPPER_SNAKE_CASE` para constantes globais.
- Arquivos: `PokemonCard.tsx`, `calculateDamage.ts`, `trainer.types.ts`.
- Interfaces do jogador e documentação: português brasileiro, com mensagens preparadas para tradução.
- Branches: `feat/tema`, `fix/tema`, `refactor/tema`, `docs/tema`.
- Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.

## Comentários
- Comentários relevantes em português para **motivo, regra de negócio, invariante, arredondamento, exceção, compatibilidade e decisões difíceis**; não narrar instruções óbvias.
- Usar JSDoc/TSDoc para funções públicas do `game-core` (parâmetros, unidade, limites e retorno).
- Quando houver fórmula, vincular à seção do `docs/GDD.md` e adicionar testes de limites.
- TODOs com descrição verificável e, se possível, issue; não esconder bugs sem rastreamento.
- Documentar TODOs que condicionam segurança, publicação ou migração de save.

## Testes que cada mudança deve considerar
- Unitários Vitest: bônus 8–10%, arredondamento, cap 40 de pontos manuais, bônus extras acima de 40, 8 insígnias cumulativas, título único, status de espécies, nível/XP, golpe/tipo/imunidade, recompensas e limites.
- Integração: PokéAPI indisponível, fallback, normalização, cache, salvar/carregar e migração de chave v0.1.
- E2E Playwright: inicial, modo demo/normal, treinador, Pokémon, arena, expedição, Pokédex, salvar/recarregar, mobile.
- Sempre que possível travar entradas aleatórias via seed/fake para testes determinísticos.
- `npm test` da v0.1 **não é suíte de testes do jogo**: hoje apenas valida sintaxe de `server.mjs`.

## Critérios para considerar entrega concluída
1. Escopo implementado sem funcionalidades regressivas.
2. Testes relevantes executados, riscos documentados.
3. Sem ruptura silenciosa de saves existentes.
4. `CHANGELOG.md` e `docs/PROJECT_STATE.md` atualizados; outros docs relevantes atualizados.
5. PR revisado antes do merge para mudanças de código.
6. Deploy monitorado até estado terminal; monitorar healthcheck e navegação.
7. Informar exatamente o que foi feito, o que não foi e o próximo passo.

## CSS e estilos — regra obrigatória (2026-11-16)
- Tokens compartilhados ficam exclusivamente em `styles/tokens.css` no `:root`: cores, fundos/gradientes, sombras, bordas/raios, espaçamentos, tipografia, transições e limites.
- `styles/app.css` e futuros CSS Modules devem usar `var(--token-semântico)`. Evitar códigos hexadecimais ou `rgb()/rgba()` fora de tokens.
- Documentar cada seletor com um comentário curto e funcional em português: **o que controla**, e não a repetição literal de suas propriedades.
- Agrupar estilos por área: base, navegação, componentes, treinador, Pokémon, Pokédex, combate, modais e responsividade.
- Não mudar pixels/estados sem validar desktop/mobile; usar comparação visual e `npm test`.


## E2E de imagens no Chromium — correção de flakiness (2026-11-16)
Quando testar fallback de sprite via `page.route` para simular HTTP 404, instalar a rota **antes do primeiro carregamento** da página/Pokédex: uma rota instalada após o navegador já ter cacheado a imagem pode não interceptar o recurso, tornando o teste dependente do cache. Usar resultado verificável (src de PNG após erro) e preservar o runtime de sprites inalterado.

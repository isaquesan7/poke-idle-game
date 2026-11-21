# D-064AE — Release candidate de regiões SOMENTE LEITURA

> PR independente criada a partir da `main` D063. Não depende das branches empilhadas D064 nem inclui writer, captura, XP, evolução ou economia regional. **Não fazer merge/deploy sem aceite, testes e revisão visual**.

## Entrega

- Nova rota pública `/regions` (e `/regions/`) com as dez áreas previstas de Kanto. Tabela de nível e espécies de exemplo, claramente identificadas como prévia de balanceamento.
- Link “Regiões (prévia)” na navegação da rota `/play`.
- Os nomes, faixas, desbloqueios e amostras foram copiados do catálogo **proposto** D064; não existe cálculo regional de encontro no código publicado, e qualquer mudança futura no catálogo terá de sincronizar com esta prévia.
- Dados da página são estáticos. Não existe `PlayAction`, leitura ou escrita de `localStorage` nem imports de novos laboratórios experimentais.
- Cores e espaços vêm dos tokens CSS Kanto Dark; estados de foco/teclado e `aria-pressed` para a região selecionada; mobile e desktop cobertos.

## Critérios automáticos

1. `apps/web/tests/regions-preview.test.tsx`: dez regiões, IDs e faixas crescentes, espécies válidas, renderização SSR; nenhuma interface que prometa captura ou recompensa.
2. `apps/web/tests/e2e/regions-preview.mjs`: abre `/regions` no servidor REAL `server.mjs` em desktop e mobile, aciona botões por clique e teclado, confirma 10 regiões, ausência de scroll horizontal, zero erro de página, e **snapshot byte a byte de todo o localStorage antes/depois** de navegar (inclui save v0.1 e v0.2 como sentinelas).
3. `.github/workflows/main-regression.yml`: chama o E2E regional e guarda screenshots `artifacts/regions/preview-desktop.png` e `preview-mobile.png`. Builds e regressões anteriores v0.1/v0.2 continuam obrigatórios.
4. GitHub Actions deve mostrar TypeScript core/web, Vitest, E2E desktop/mobile, GIFs e Docker D044 SUCCESS no SHA da PR final. Revisar screenshots e testar /play, /regions e / no runtime de release.
5. Railway: após autorização de merge/publicação, confirmar SHA exato do deploy e GET /health; conferir também manualmente GET /regions no URL público. Rollback via release anterior, não resetar saves.

## Fora do escopo

- Nada de batalhas regionais jogáveis, compra/consumo de bolas, raridade garantida, unlock dependente do save ou novas fontes de XP e coins.
- Nenhuma alteração em chave/schema de storage, recibos, equipe existente, app v0.1, fonte de GIFs ou repositório `isaquesan7/pokedex`.
- Corte B e C seguem bloqueados até resolução de segurança/autoridade e balanceamento conforme `docs/REGIONAL_RELEASE_GATES_D064AD.md` na branch experimental.

## Critério de produto

Este corte entrega exploração **visual e informativa** do planejamento de regiões, não o mapa jogável final. É um passo para publicar com menor risco e colher feedback, sem insinuar que os Pokémon já podem ser capturados ali.

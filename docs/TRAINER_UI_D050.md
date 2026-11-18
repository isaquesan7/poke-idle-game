# D-050 — Reformulação da tela Treinador (primeira etapa)

## Implementado na branch
- Novo `TrainerScreen.tsx` e CSS Module dedicado: perfil, equipamentos e mochila, componentes responsivos, badges e título dentro do perfil. Layout usa exclusivamente `styles/tokens.css` (sem duplicar root).
- Equipamentos no perfil exibem nome/ícone; bônus apenas no hover, foco do teclado e toque por foco. A seleção fica na aba Equipamentos e usa o writer existente, sem inventar inventário de propriedade.
- Pontos de atributos são **pré-visualizados no estado React sem qualquer escrita**; confirmação envia um único `trainer-invest-batch` validado pelo game-core e aplicado como **um commit/revisão**, ou rollback integral. Botão cancelar descarta prévia. Um draft antigo é ignorado se a revisão mudar.
- Mochila lista apenas pedras de evolução realmente presentes no save; consumíveis/Pokébolas/TMs ainda indisponíveis, não cria estoque.
- Mensagem de sucesso "Progresso salvo neste navegador." removida; mensagens reais de erro mantidas. Novo selo consultando `GET /health` mostra Servidor Online/indisponível, não estado da PokéAPI.
- Testes de gravação única, limites e rollback de atributos.

## Dependência de arte binária
**Arte original do usuário** disponível como anexo da conversa, ainda não comitada: `image(7).png` deve ser copiada **sem alterações** para `apps/web/public/assets/trainer-original.png`. O JSX já aponta para essa rota, com fallback acessível temporário. O conector de escrita do GitHub utilizado aceita texto UTF-8, não transfere automaticamente os bytes PNG da conversa; não alegar que a imagem já foi integrada. A pasta `apps/web/public/assets/` é copiada pelo Vite para `apps/web/dist/assets/`, já servida pelo `server.mjs` e Docker sem novos endpoints. Quando transferida, verificar hash/rota servida pelo Docker e navegador desktop/mobile, e remover fallback se apropriado.

## Não mexer
Nenhuma alteração às mecânicas de TMs, status, combate, save chave/schema, 151 GIFs, assets de `isaquesan7/pokedex`, v0.1 `/`. D049B PR73 separada (sua regressão geral teve falha em E2E; não misturar). Não fazer merge nem deploy sem CI e arte original funcional.

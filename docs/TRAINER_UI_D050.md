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

- D050 UI compatível da rota legada `/`: retirado somente o card informativo de protótipo (botão de reinício continua presente), o selo "Dados locais" e o rótulo "PokéAPI conectada"; a disponibilidade do servidor agora vem de `GET /health`, independente da PokéAPI. O loop, ações e saves da v0.1 não foram modificados.

### Proveniência verificável da arte original enviada pelo usuário
- Anexo original: `image(7).png`, **1024×1536, RGBA**, sem fundo; cópia local preservada sem reamostrar, SHA-256 do PNG: `661fec876c4305f55cd9b6a0321bdaec74cdc908166cd14e05dafe0cf18435f3`.
- Destino obrigatório do arquivo **idêntico**: `apps/web/public/assets/trainer-original.png` (Vite copia para `apps/web/dist/assets/trainer-original.png`; servidor já permite a rota pública `/assets/trainer-original.png`).
- O usuário forneceu a arte para uso no jogo. **NÃO** substituir por outra ilustração/geração, não criar derivado aproximado; verificar SHA-256 após copiar antes de aprovar. A imagem binária não está presente nesta branch porque o conector de escrita usado não aceita cópia direta dos bytes do anexo.

- Gate de release D-050: `tests/trainer-original-image.test.mjs` exige presença do PNG original em `apps/web/public/assets/trainer-original.png` e SHA-256 `661fec876c4305f55cd9b6a0321bdaec74cdc908166cd14e05dafe0cf18435f3`. O teste **DEVE FALHAR** enquanto o binário ainda não estiver versionado; não contornar, modificar checksum nem aprovar merge com fallback. A rota `/assets/trainer-original.png` é coberta pelo servidor Vite/Docker depois do arquivo copiado. Pacote ZIP local com PNG original preparado para transferência.

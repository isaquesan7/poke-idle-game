# D064BP — fundação da loja e ciclo fechado de foco do combate (22/11/2026)

**Status:** em PR; CI, merge e Railway pendentes. Esta fase prepara o catálogo e a validação de compra sem **ativar preços ou cobranças** que não foram aprovados. Separadamente, aplica a correção imediata solicitada para o foco depois do combate e da Pokébola.

## Fluxo de batalha e captura — decisão explícita

1. **Entrou/iniciou novo combate, replay pendente ou reassistir:** trazer o **palco com os Pokémon** ao viewport e foco acessível.
2. **Terminou uma vitória com opção de captura disponível:** focar **seção de Pokébolas/captura**.
3. **Jogou Pokébola e capturou ou falhou, ou clicou “Seguir sem capturar”:** focar o **botão “Batalhar na região”** (com ele visível no viewport), para recomeçar facilmente.
4. **Perdeu ou empatou, logo não há captura:** focar diretamente o **botão “Batalhar na região”**.
5. Ao clicar novamente no botão, ir ao **palco dos Pokémon**. Nenhum foco extra durante revelação de linhas/cronômetro; nenhuma rolagem obrigatória em outras telas.

Implementação: `PlayApp.tsx` cria `battleAgainFocusRef` ligado ao botão real (`data-testid="battle-again-button"`), escolhe alvo entre **palco/captura/botão** pelo status persistido e `battlePlaying`. Revisa `busy`/estado `disabled` para **não tentar focar botão indisponível** no meio de um commit; só grava chave de foco quando o alvo está disponível. Usar `focus({preventScroll:true})` e `scrollIntoView({block:'center',inline:'nearest',behavior:'auto'})`, não `scrollTo(0,0)`. Em telas estreitas o elemento é trazido para a janela sem saltar ao topo da página. A11y: foco real no botão, tecla Enter pronta para próximo encontro.

**Cobertura:** `regional-writer-bridge.mjs` valida 1440×900 e 390×844, início→palco, vitória→captura, sucesso/escape→botão, e após settlement de novo nível → botão. `regions-preview.mjs` valida captura→skip→botão e derrota/empate→botão se ocorrer sem captura; nenhuma atualização do save apenas por foco. Ficam intactas premiações, log/replay, HP/SP/IA e animação `LEVEL UP!` sobre o parceiro.

## Loja em preparação: decisões técnicas sem preço improvisado

Catálogo puro `packages/game-core/src/shop/ballShop.ts`:
- Poké Ball: nível do treinador **1**, máximo técnico de **50** unidades por transação.
- Great Ball: treinador nível **20** (desbloqueio de R4), máximo de **25** por transação.
- Ultra Ball: treinador nível **55** (desbloqueio de R7), máximo de **10** por transação.
- Master Ball **excluída** de venda convencional; máximo de **100.000** unidades por tipo no bolso existente. Limites são regras **técnicas propostas de estoque/lote**, não preços, e não mudam drops de batalha/expedição.
- `KANTO_BALL_SHOP_STATUS='pricing-pending'` — impede interpretação de “loja disponível”. Interface tem aba **Loja** com os três produtos, nível de desbloqueio, estoque real da mochila, saldo real e o texto **“Preço a definir”**. Não há botão “Comprar”, alteração no localStorage ou dinheiro debitado.

`quoteKantoBallShopPurchase(input, trustedPolicy)` é puro e verifica saldo/nivel/lote/tipo/bolso/cap/preço inteiro seguro sem mutar os objetos recebidos. Retorna custo, saldo final e bolso projetado **somente** se receber uma política de preços explícita de código confiável e validada. `null` é bloqueado. **Nenhuma política confiável de preço é definida no aplicativo**, portanto não existe caminho de compra real e não se aceita preço do UI. O futuro writer deverá carregar preço **de sua própria versão de catálogo**, calcular débito de moedas + crédito de item em **uma revisão** e anexar recibo anti-replay; abortar tudo em erro ou revisão antiga e usar Web Lock/CAS. O contrato de modelagem não fornece defesa anti-fraude de servidor: alfa atual persiste em localStorage.

### Sensibilidade econômica — preços meramente hipotéticos, NÃO OFICIAIS

| Hipótese técnica no teste | Preço meramente fictício por unidade | Compras máximas com 8.039 moedas do primeiro resgate 8h |
|---|---:|---:|
| Poké Ball | 600 | 13 |
| Great Ball | 2.400 | 3 (ainda bloqueada no treinador Lv10) |
| Ultra Ball | 16.000 | 0 (bloqueada até Lv55) |

As quantidades acima são só divisão monetária **antes** dos bloqueios de progressão, compras concorrentes, reserva de recursos e usos; não constituem preços propostos para lançamento. Um jogador de R10 no cap pode obter 46.080 moedas a cada 8h elegíveis, sem os gastos da loja; o endgame também recebe Ultra por combate R7+ (**1 a cada 15 vitórias válidas de cada região**) e por expedição só R9–R10 (**1 a cada 24h elegíveis**). Comparar várias políticas antes de escolher preços, estoque e outras despesas. A versão anterior da auditoria que dizia "Ultra só por expedição" foi errata e **não deve ser reintroduzida**.

## Gates e próxima etapa

1. CI: core Vitest, TS e Web, E2E de foco e vitrine em viewport desktop/mobile, Docker, Playwright.
2. PR merge squash **somente se CI verde**; confirmar deployment Railway SUCCESS no SHA e healthcheck interno.
3. **D064BQ**, após validar política de preços e outras fontes/gastos: conectar catálogo a um writer idempotente, UI com controles de quantidade/confirmação, testes de saldo insuficiente, cap, compras duplicadas, duas abas, rollback e idempotência do receipt. Nunca confiar em preço fornecido pela UI. Nenhuma alteração em `isaquesan7/pokedex`.


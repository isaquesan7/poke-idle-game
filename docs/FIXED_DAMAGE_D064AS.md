# D-064AS — Night Shade: dano fixo por nível

**Data:** 21/11/2026. **Estado:** branch/PR, não publicado.

## Origem e contrato
O snapshot estático PokéAPI `PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a`, grupo7, método1, contém `night-shade` (move ID101, effect88, `power:null`, `PP15`, `accuracy100`). Gastly/Haunter/Gengar aprendem por level-up; apenas espécies e níveis constantes do snapshot podem equipar por writer de UID. O registro FRLG permanece classificado `executable:false` pelo catálogo genérico de dano convencional; uma exceção explícita, auditável e fechada permite a execução via `kantoLevelMoves`, com `power:0` como marcador tipado e imutável.

## Regra de dano
Night Shade causa dano **igual ao nível do atacante**, independentemente de Defesa, Ataque Especial, afinidade, rank, STAB, sorteio de crítico, variância ou multiplicadores de efetividade. **Imunidade Ghost × Normal permanece**: alvos com multiplicador zero recebem dano zero; vantagens/resistências não aumentam ou diminuem a quantidade, e o replay indica 'Dano fixo' em vez de 'Super efetivo'. Não há dano após KO. O frame de dano mostra apenas HP efetivamente removido. Não introduzir TMs, Night Shade moderno com power fictício ou dano negativo.

## Energia e seleção de golpes
Custo de SP calculado com escassez de PP mais peso fixo 12 (PP15 → arredondamento da fórmula); o custo é pago na ação antes de acertar, uma vez por ataque. A IA estima pontuação de Night Shade por `nível × precisão`, sem confundir `power:0` com golpe inofensivo e sem escolher o golpe contra imunidade. Continua alternando ataque básico nos turnos pares e respeita regras de Concentrar, limites de SP, turns e todas as demais habilidades.

## Regressão e limites
`d064as-night-shade.test.ts` cobre levelup Lv16 de Gengar, rejeição por writer antecipado, metadados verificáveis, imunidade Normal, independência de defesas/críticos/variância, SP, seed, log/frame e determinismo. D064AO atualiza o teste que exigia Night Shade não elegível no Lv25; Shadow Ball e Bullet Seed seguem bloqueados.

**Gates:** TypeScript/Vitest e testes v0.1, E2E React /play /regions desktop/mobile, Playwright isolado, Docker runtime mínimo/HTTP. Não mesclar até CI verde e revisar eventual conflito. Depois do merge, verificar Railway deployment `SUCCESS` no SHA exato.

Próxima D064AT: planejar implementação separada de múltiplos acertos FRLG, distinguindo distribuição de impactos, contrato de SP/precisão, hits por frame, PP e compatibilidade TM09 ainda bloqueada. Retomar simulação de progressão real por escritor e medição de BattlePlayback em dispositivos.

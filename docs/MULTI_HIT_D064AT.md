# D-064AT — ataques de múltiplos impactos FRLG

**Data:** 21/11/2026. **Estado:** branch/PR, até validação e merge.

## Fonte e elegibilidade
Snapshot congelado `PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a` — version_group_id 7 (FireRed/LeafGreen), aprendizado por nível. Uma whitelist fechada de onze golpes é liberada apenas quando constam espécie/nível do snapshot:

- **2–5 impactos (effectId30):** Double Slap, Comet Punch, Fury Attack, Pin Missile, Spike Cannon, Barrage, Fury Swipes, Bone Rush, Icicle Spear, Rock Blast.
- **2 impactos fixos (effectId45):** Bonemerang. Double Kick (D045) mantém seus dois impactos fixos anteriores.

Não habilitar Twineedle (effectId78: efeito adicional por golpe ainda não modelado) nem Bullet Seed (TM09; sem level-up Kanto FRLG nesse snapshot), apesar dos respectivos metadados da PokéAPI em outras consultas. TM09 e restantes das TMs continuam sem ensino.

## Regras de resolução
- Após UMA checagem de precisão (e de pagar UMA vez o custo SP, mesmo em erro), a quantidade de impactos dos golpes 2–5 é sorteada **uma vez** pelo LCG da batalha. Pesos de Kanto Idle alinhados ao modelo Gen III: 2 acertos 37,5%; 3 acertos 37,5%; 4 acertos 12,5%; 5 acertos 12,5%. Ataques fixos de dois hits não gastam um sorteio extra.
- Cada impacto executa seu dano próprio e rolagem de crítico/variação, gera UMA linha e UM `frame` sincronizado, com `hitIndex` e `hitTotal`. O primeiro impacto contém o custo SP, os seguintes têm `spCost:0`. Acaba imediatamente em KO ou imunidade.
- IA calcula dano esperado com **3** impactos para golpes variáveis ou **2** para fixos, sem alterar regra de alternar ataque básico. Custo de SP usa o mesmo número de impactos esperado, aplicação única por ação, clamp de 8–40. PP vem do snapshot PokéAPI, não de contadores persistentes.
- Integridade: movimentos multi-hit devem coincidir integralmente com ficha canônica (tipo, categoria, poder, precisão e prioridade). Não aceitar `power` adulterado como multiplicador de impactos.
- Algoritmo é determinístico via seed, sem `Math.random`, relógio, rede ou save. O replay lê frames sem recalcular a batalha. Dados de captura, XP, afinidade, expedição, animações, inventário, schema2 e distribuição de 151 Pokémon inalterados.

## Testes
`packages/game-core/tests/d064at-frlg-multi-hit.test.ts` testa whitelist e PP, níveis e writer UID, TM09 bloqueada, distribuição dos limiares, não consumir RNG extra em golpes fixos, identidade do replay, linha/frame/impacto, SP único, KO e adulteração. Regressão completa TypeScript/Vitest, web E2E desktop/mobile, Playwright e Docker/HTTP obrigatórios no HEAD do PR antes do merge. Após merge exigir Railway SUCCESS no SHA correspondente para alegar publicação.

## Continuidade
D064AU: Twineedle — envenenamento com semântica por impacto, categoria de dano com efeito secundário, limites e reprodução — e outros efeitos combinados; depois mecânicas especiais de múltiplos impactos que não sejam FRLG level-up. A auditoria de progressão real/expedições e tempos de BattlePlayback em browser ainda requer estudo.

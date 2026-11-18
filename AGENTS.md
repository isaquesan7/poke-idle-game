# AGENTS.md — continuidade obrigatória do Poke Idle Game

> PONTO DE ENTRADA PARA NOVOS CHATS E AGENTES. Leia este arquivo antes de planejar ou alterar código.
> Atualizado em 2026-11-18. A fonte final do estado técnico é o próprio GitHub/Railway; confira sempre os dados ao vivo.
> **CÓDIGO MAIS RECENTE CONFIRMADO (D-042, 18/11/2026):** PR #58 MERGED em `main` SHA `7c170589ce7a274eb49ca77c056b7b517c21d730`, CI `44302672917` e `44302672967` SUCCESS, Railway `71eedcbe-5210-4c47-9194-ae8eeaaf6201 SUCCESS` com healthcheck interno /health. Na Arena, animações estão SEMPRE ativas em PC/mobile via `data-motion="full"` fixo, sem opções para jogador, inclusive sob SO reduced-motion; preferência antiga ignorada sem apagar. GIFs e save schema2 preservados. 384 duelos artificiais fortificados: média 27,86 turnos, p95 30, 88,8% no cap, NÃO são estatísticas reais nem mudanças de regra. **D-043 EM BRANCH:** `chore/v02-d043-vitest-security-upgrade` propõe Vitest 4.1.12 nos dois workspaces, atualização do lockfile por npm em workflow TEMPORÁRIO com permissão write SOMENTE do branch — remover esse workflow antes de merge! Picomatch 4.0.7 ReDoS sem patch oficial publicado em 18/11/2026; nenhum `npm audit fix --force`. Aguardar PR/CI/Audit/Railway para afirmar D043 publicada. Próxima: compatibilidade Vitest, advisories residuais, NVDA/VoiceOver real e cura/multi-hit só com motor próprio. `isaquesan7/pokedex` intocado.

## Identidade e limites
- Projeto: **Poke Idle Game / Kanto Idle LAB** (protótipo v0.1; Season 1: Pokémon #001–#151).
- **Único repositório autorizado para este jogo:** https://github.com/isaquesan7/poke-idle-game
- **NÃO modificar** o repositório original https://github.com/isaquesan7/pokedex — nem branches, commits, PRs ou arquivos — sem autorização expressa e específica do usuário.
- Ambiente de produção: https://kanto-idle-web-production.up.railway.app/
- A branch `main` está conectada ao Railway: novos pushes podem disparar deploy.
- Pokémon e sprites são propriedade de seus titulares. PokéAPI fornece dados, não licença de exploração comercial. Projeto experimental não oficial.
- Não assumir que informações neste arquivo substituem verificações dos arquivos atuais, da branch, do deploy, dos testes ou da configuração remota.

## Leitura inicial obrigatória
1. `docs/PROJECT_STATE.md`: estado implementado, infraestrutura, testes, pendências e próximo passo.
2. `docs/GDD.md`: regras acertadas com o usuário e distinção entre decisões e propostas.
3. `docs/DECISIONS.md`: decisões arquiteturais e de produto com razões.
4. `docs/ARCHITECTURE.md` e `docs/DESIGN_SYSTEM.md`: estrutura-alvo e identidade visual.
5. `docs/CONVENTIONS.md`, `docs/RELEASE_CHECKLIST.md` e `CHANGELOG.md`.
6. Ler o código atual antes de editar: hoje `index.html` contém lógica/UI e `server.mjs` serve a página.

## Regras críticas de negócio
- Base PokéAPI é referência da espécie e não recebe pontos manuais.
- Cada Pokémon capturado tem ID/estado individual, nível, XP, afinidade e pontos próprios.
- Treinador: limite de **40 pontos distribuídos manualmente por atributo**, NÃO limite de status total. Pontos de itens, título ativo e **todas** as insígnias conquistadas são adicionais e cumulativos por fonte.
- Bônus para cada atributo do Pokémon: `floor(atributoTotalTreinador * (0.08 + 0.02 * afinidade/100))`. É ADIÇÃO EM PONTOS ao status do Pokémon, NÃO multiplicação do status do Pokémon por 8–10%.
- Afinidade individual de 0 a 100; 0 dá taxa 8% e 100 dá 10%. Afinidade acompanha a instância do Pokémon e deve sobreviver à evolução.
- Atributos: HP, Attack, Defense, Special Attack, Special Defense, Speed.
- Um título ativo; insígnias NÃO possuem slot ativo: todos os bônus de insígnias adquiridas se acumulam.
- Itens: 9 slots (chapéu, jaqueta, luvas, calça, sapatos, colar, anel 1, anel 2, brincos). Raridades e catálogo definitivo PENDENTES.
- Outras constantes da v0.1 são PROVISÓRIAS; conferir em `docs/GDD.md`.

## Instruções operacionais
- Antes de iniciar tarefa: verificar branch, HEAD, arquivos, deploy, possíveis mudanças de terceiros e documentação. Não presumir que o estado de 2026-11-16 continua atual.
- **Preferir branch de trabalho + PR** para alterações de código. A `main` publica automaticamente. Não fazer alterações destrutivas nem forçar push.
- Nunca publicar sem testes; monitorar resultado terminal `SUCCESS` do novo deploy, healthcheck e teste do site.
- **Revisão D-027 (pré-lançamento sem jogadores reais):** é permitido reiniciar dados de TESTE v0.2 com confirmação, e não é obrigatória migração de progresso legado para a nova experiência. A chave legada `kanto-idle-lab-save-v01` permanece separada por enquanto; nunca usar `localStorage.clear()` nem apagar outros dados do navegador. Antes do lançamento com jogadores, redefinir política de compatibilidade, backup e persistência.
- Não apagar nenhum dado automaticamente para “corrigir” problemas; reinicialização de dados **de teste** v0.2 requer ação/confirmacão visível. Quando existirem jogadores reais, proteger persistência com política própria antes de mudanças incompatíveis.
- Sem contas/backend atualmente: não descrever salvamento local como seguro ou persistência de servidor.
- Não inserir segredos, tokens, e-mails pessoais ou credenciais no repositório.
- Se não for possível completar uma ação, registrar pendência honestamente, sem afirmar que foi concluída.

## REGRA DE DOCUMENTAÇÃO A CADA ALTERAÇÃO
Toda alteração funcional, visual, arquitetural, de infraestrutura ou regra de negócio DEVE atualizar, no MESMO PR/commit quando possível:
1. `CHANGELOG.md` — o que mudou, por que e se houve deploy;
2. `docs/PROJECT_STATE.md` — estado verificado, HEAD, ambiente, o que funciona, pendências e **próxima ação concreta**;
3. `docs/DECISIONS.md` — se houver nova decisão, mudança ou revogação de regra;
4. `docs/GDD.md` — se mudar mecânica, números ou balanceamento;
5. `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/CONVENTIONS.md` — se aplicáveis.
Não apagar histórico: marcar decisões superadas, preservando razão e data. Se documentação e código divergirem, registrar a divergência e verificar antes de alterar.

## Protocolo de troca de chat
A pessoa pode dizer: **“Continue o Poke Idle Game pelo AGENTS.md e docs/PROJECT_STATE.md do GitHub.”**
O novo chat deve ler os arquivos acima, verificar a situação real no GitHub/Railway, explicar brevemente o último estado e dar continuidade SEM pedir ao usuário que reconte o projeto.

> **Histórico de implementação (2026-11-17):** trabalho inicialmente feito em `feat/v02-evolution-by-uid`; PR #40 integrada; consulte os registros cronológicos em `docs/PROJECT_STATE.md`.

> **Histórico de branch (17/11/2026):** `feat/v02-combat-status-secondary` foi integrada pela PR #42; histórico de CI/merge/deploy confirmado no último registro de `docs/PROJECT_STATE.md`.

> **Histórico da etapa (17/11/2026):** branch `feat/v02-multi-moves-support-ai` publicada na PR #44. O último bloco de `docs/PROJECT_STATE.md` contém CI e Railway confirmados; próxima fase: HP/ataques animados.


> Histórico da etapa (17/11/2026): feat/v02-animated-hp-battle-stage foi integrada pela PR #46. CI e Railway confirmados no último bloco de docs/PROJECT_STATE.md; próximo passo: efeitos visuais por tipo/crítico e acessibilidade.

> **Histórico D-037 (2026-11-17):** `feat/v02-sp-budget-and-battle-feedback` publicada pela PR #48; consulte estado verificado de CI e Railway no final de `docs/PROJECT_STATE.md`.

> **D-039 EM BRANCH (ainda NÃO publicada; atualização da etapa 2026-11-17):** `feat/v02-arena-accessibility-balance-d039`. Prepara custo de SP para /move/{id} futuros sem desbloquear golpes: `kantoPreviewMoveSpCost` normaliza `power:null`, trata cura `meta.category.name='heal'` com +18 SP (Recover 5PP = 36 SP), multiplica poder de multi-hit (2..5 usa estimativa 2.5; hits fixos exatos) e valida faixas; catálogo executável e combate continuam apenas com os 29 movimentos conhecidos. SPmax D-038 ajustado para `clamp(50,100,36+floor(level/3)+floor((SpAtk_base+SpDef_base)/14)+floor(HP_base/20))` → piso50 cobre qualquer ataque com custo <=40 e mantém diferenciação de espécie no nível20. Arena: teclado Tab/Espaço/ArrowRight, botão de avanço linha única, leitura assistiva opcional com 3s/linha e live region dedicada, timer/log com anúncios controlados; Concentrar tem banner "+SP", medidor realçado e reduced-motion; reprodução continua read-only com saves antigos intactos. Matriz de equilíbrio 1.152 duelos + 768 de suporte = **1.920** seeds/combinações, cobertura de todos 151 SP, cura/multi-hit futuros e E2E acessibilidade desktop/mobile. **Não afirmar merge/CI/produção** até verificar status terminal e atualizar o último PROJECT_STATE. Próxima etapa depois: revisão real com leitores de tela/usuários, expansão do motor para cura/multi-hit com catálogo e testes de equilíbrio e classificação npm audit antes da beta.

> **D-040 EM BRANCH (18/11/2026; ainda não publicada):** `chore/v02-prebeta-audit-balance-d040` adiciona relatório determinístico dos mesmos 1.920 duelos da D-039, distribuídos por cenário/nível (vitórias, derrotas, empates, turnos, p95, básico, skill paga, Concentrar, SP), e workflow npm audit com inventários separados de produção e desenvolvimento, sem fixes automáticos. Não altera combate, writer, save, PokéAPI, / ou /play. CI/PR/deploy pendentes até observação real. Manual NVDA/VoiceOver permanece requisito antes da beta; nenhum acesso humano foi simulado.
 
> **D-041 EM BRANCH (2026-11-18; ainda não publicada):** `fix/v02-desktop-animations-and-prebeta-audit-d041` investiga diferença de movimento PC/celular. No `BattleStage`, `key={cue+'-'+side}` remontava o palco **inteiro**, inclusive `<img src="...gif">`, ao revelar cada linha (~900ms), reiniciando o GIF. Corrigido para manter imagem/DOM estáveis e reiniciar somente CSS de impacto via `getAnimations().cancel()/play()`; art principal carrega `eager`. Opção `Padrão do dispositivo / Exibir animações / Reduzir movimento` gravada em chave cosmética `kanto-idle-ui-motion-v01` (separada de saves, com fallback), respeitando `prefers-reduced-motion` por padrão e permitindo escolha explícita no Windows/Edge. E2E desktop/mobile testa identidade DOM dos GIFs e CSS reduced/full; não prometer correção de configurações de navegador que bloqueiam GIFs por política. `docs/DEPENDENCY_SECURITY_REVIEW.md` classifica 7 npm alerts de Vite/Vitest, sem package updates. **PR/CI/Railway pendentes de verificação.** Próximo após validar: testar o PC real em Edge/Chrome, revisar atualização de dependências em PR isolado e leitores de tela reais, ampliar cenários longos antes de mexer em status/SP. `isaquesan7/pokedex` intocado.
 
> **D-042 EM BRANCH (18/11/2026, não publicada):** `feat/v02-d042-motion-default-long-battles`. A pedido do usuário, `Exibir animações` agora é FIXO para PC/mobile, sem seletor; `data-motion="full"` na raiz, sem consultar ou apagar `kanto-idle-ui-motion-v01`. Preserva GIF/impactos D-041, save schema2, logs/replay, HP/SP, controle de leitor assistivo e regras de combate, mas não oferece redução de movimento (reavaliar acessibilidade antes da beta). Teste E2E atualizado para a opção fixa em SO reduced. Novo stress puramente diagnóstico de 384 duelos artificiais com defesas/HP maiores (`D042_LONG_BATTLE_REPORT`), sem alteração de stats dos jogadores. CI/PR/merge/deploy a confirmar; próximo trabalho segurança Vite/Vitest com lockfile auditado em PR independente, leitores NVDA/VoiceOver reais e motor de cura/multi-hit apenas após design. Repo `isaquesan7/pokedex` intocado.
 
> **Status D-043 segurança (18/11/2026, PR #59 EM REVISÃO):** Vitest4.1.12 em ambos workspaces e lockfile **gerado com npm11** (o npm10.9.9 deu erro edgesOut:null), `npm ci` + audit `44303650680 SUCCESS`: 0 críticos, **5 altos** em fdir/picomatch/tinyglobby/vite/vitest (ligados a picomatch4.0.7), 0 em `--omit=dev`. Picomatch sem fix oficial publicado; não usar `npm audit fix --force`. Workflow temporário de PR com write `d043-lockfile-resolve.yml` JÁ FOI REMOVIDO no commit `3d5c0f1`, NÃO restaurar/mergir job com write. Aguardar CI final, merge PR #59 e Railway para alegar publicação. Não houve mudança em motor, save ou CSS. Após este gate, retomar NVDA/VoiceOver, revisão risco build/runtime e arquitetura cura/multi-hit.

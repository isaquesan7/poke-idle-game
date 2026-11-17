# AGENTS.md — continuidade obrigatória do Poke Idle Game

> PONTO DE ENTRADA PARA NOVOS CHATS E AGENTES. Leia este arquivo antes de planejar ou alterar código.
> Atualizado em 2026-11-16. A fonte final do estado técnico é o próprio GitHub/Railway; confira sempre os dados ao vivo.
> **Handoff mais recente (2026-11-16):** PRs #3–#16 integradas à `main` até `977d14a9`. A PR #16 adicionou laboratório em localStorage REAL de navegador só em `127.0.0.1/localhost` com chaves `__kanto_lab__*`, Web Locks, quota nativa, crash/refresh e rollback isolado. CI da PR `43991731238` e CI da main `43991985570` ambos SUCCESS; Railway deploy `54ccff55-8225-4057-b7ee-82756487d94d` SUCCESS. **Jogo público permanece v0.1; a v0.2 não tem writer real nem migração autorizada.** Próximo ciclo: definir transferência de autoridade, paridade das ações React e plano de opt-in/rollback de jogador. Sempre reler a última seção de `docs/PROJECT_STATE.md` e verificar HEAD/deploy.

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
- Preservar o progresso existente em `localStorage`, chave `kanto-idle-lab-save-v01`; qualquer mudança de formato necessita migração versionada e teste de compatibilidade. Cache: `kanto-idle-lab-cache-v01`.
- Não modificar dados existentes de usuários nem apagar saves para “corrigir” problemas.
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

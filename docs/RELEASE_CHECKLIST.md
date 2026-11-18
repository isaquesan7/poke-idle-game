# Checklist de alteração, PR, release e troca de chat

## Antes de codar
- [ ] Ler `AGENTS.md`, `docs/PROJECT_STATE.md`, `docs/GDD.md`, `docs/DECISIONS.md`.
- [ ] Verificar `main`, HEAD, pipeline, configuração e status reais do Railway.
- [ ] Criar branch apropriada para alteração de código; não tocar `isaquesan7/pokedex`.
- [ ] Registrar escopo, efeitos no salvamento v0.1 e riscos de compatibilidade.

## Antes do merge
- [ ] Lint/format/TypeScript/build (quando ferramentas existirem).
- [ ] Testes de atributos, afinidade, trainerTotal e limite manual.
- [ ] Testar carregamento PokéAPI, tratamento de falhas, Pokédex 151 e encontros.
- [ ] Testar salvar/recarregar, inclusive save legado `kanto-idle-lab-save-v01`.
- [ ] Testar expedição: 10s/ciclo, teto 8h, recompensas sem duplicação.
- [ ] Testar modos normal e demo, battle, equipamentos, títulos, insígnias cumulativas.
- [ ] Revisar responsive mobile e navegação teclado.
- [ ] Revisar mudanças e evitar código morto, segredos, licenças inadequadas.

## Documentação obrigatória no mesmo trabalho
- [ ] `CHANGELOG.md`: versão, data, mudanças, testes, deploy, limitações.
- [ ] `docs/PROJECT_STATE.md`: estado real, branch/commit, próximo passo, pendências, infraestrutura.
- [ ] `docs/DECISIONS.md`: decisões novas/superadas.
- [ ] GDD/architecture/design/conventions/README conforme necessário.

## Depois do merge na `main`
- [ ] Confirmar que o Railway iniciou um deploy do COMMIT correto.
- [ ] Aguardar `SUCCESS`, ou registrar falha sem dizer que publicou.
- [ ] Verificar `GET /health` HTTP 200 e abrir o jogo.
- [ ] Confirmar funções críticas e save após implantação.
- [ ] Anotar commit/deploy/resultado no handoff e release notes.
- [ ] Se regressão, considerar rollback controlado e documentar.

## No fim de cada chat / sessão
- [ ] Registrar último trabalho realmente concluído.
- [ ] Registrar trabalho iniciado, mas ainda não publicado.
- [ ] Registrar problemas conhecidos e decisão do usuário.
- [ ] Definir próxima ação objetiva, primeiro arquivo/função a investigar.
- [ ] Conferir os links para o repo e site.
- [ ] Nunca transmitir ao próximo chat informação desatualizada como certeza.

## Pré-lançamento sem jogadores — revisão D-027 (2026-11-17)
- [ ] Testar `/play` em produção, incluindo carregamento de arquivos Vite e GIFs.
- [ ] Testar onboarding, mudança de abas, persistência após reload, treino, equipamentos e expedição com mesmo save local.
- [ ] Testar `/play` desktop/mobile sem overflow e sem erros no console.
- [ ] Documentar que o alfa pode reiniciar dados de teste; reset somente da chave `kanto-idle-play-v02` e com confirmação.
- [ ] Não descrever armazenamento local como backend ou proteção antifraude.
- [ ] Reavaliar compatibilidade e persistência antes de abrir cadastro a jogadores reais.

## Gate de dependências e equilíbrio antes da beta (D-040)
- [ ] Inspecionar artifact `prebeta-npm-audit`, registrar CVEs/advisories de produção e desenvolvimento por severidade, impacto real e caminho de dependência.
- [ ] Planejar correções sem `npm audit fix --force`, revalidando lockfile e E2E desktop/mobile.
- [ ] Revisar distribuições por cenário/nível em `D040_BALANCE_REPORT`, principalmente lutas no limite de 30 turnos e dependência de ataque básico/Concentrar.
- [ ] Validar leitores NVDA/VoiceOver, teclado e reduced-motion manualmente com usuário; E2E automatizado não prova compreensão pela tecnologia assistiva.

## Gate D-044 — artefato Docker sem ferramentas de dev (2026-11-18)
- [x] CI `runtime-image-regression.yml` constrói Dockerfile multi-stage, `USER node`, sem `node_modules`, lock, fontes/tsconfig/docs/testes na imagem runtime; `npm start` inicia Node sem Vite/prestart.
- [x] `tests/e2e/runtime-image-smoke.mjs` valida /health, /, /play, /play/, assets Vite, CSS/JS legado, GIFs #1/#4/#25/#151 e 404 para arquivos privados.
- [x] CI legado TypeScript/Vitest, 151 GIFs, Node v0.1, Playwright desktop/mobile e sandbox passam com `npm run build:web` explícito.
- [x] Inspecionar logs de Railway: builder Dockerfile e SHA exato `7741139c`, SUCCESS e /health interno. /play com HTML/assets comprovado no contêiner CI, **não** em HTTP público externo (ferramenta web inacessível).
- [x] Nenhum save, writer, SP/PP, reward, RNG, animação full, catálogo/learnsets ou rota v0.1 alterado. Se seleção de Dockerfile falhar, manter release anterior; 503 /health protege /play.
- [ ] Revisão de acessibilidade manual NVDA/VoiceOver continua **pendente** para beta; `docs/COMBAT_HEAL_MULTIHIT_DESIGN.md` é plano, NÃO conteúdo habilitado.

## Gate D-045 — cura e dois hits fixos (2026-11-18)
- [x] Validar catálogo FRLG Staryu15/Starmie1 Recover, família Nidoran Double Kick (quatro formas Nv12/duas Nv1), PP5/30 do snapshot PokeAPI e custos SP36/18.
- [x] Vitest garante HP/SP não negativos, heal no máximo 1x com limiar, sem imunidade Ghost falsa, hits 2/2, 1 custo/ação, frame/log 1:1, KO intermediário e seed determinística. Saves antigos/writer/replay não sofrem reset.
- [x] E2E Chromium desktop/mobile adiciona os golpes por UI, combate, valida `hitIndex/hitTotal`, replays read-only sem duplicar recibos; 151 GIFs/Animações FULL e / v0.1 preservados.
- [x] CI geral Node/TypeScript/Vitest/build/Playwright, Docker mínima e audit se aplicável; integrar PR após verde; Railway Docker SUCCESS SHA exato, /health interno.
- [x] Bullet Seed e Soft-Boiled seguem bloqueados. Registrar métricas de balanceamento antes de expandir cura a outras espécies, multi-hit 2..5 ou TMs.

## Gate D-046 — diagnóstico de 9.216 batalhas (18/11/2026)
- [x] Criar matriz pareada Recover/Double Kick com seed/nível/espécie iguais entre controle e habilidade extra; 3 modos claramente rotulados (dois artificiais); `D046_BALANCE_REPORT` e relatório em `docs/BALANCE_D046.md`.
- [x] Verificar em 9.216 lutas HP/SP, limites, custos sem duplicar Double Kick, 1 cura Recover, KO intermediário, frames/log em 1:1 e RNG determinístico. Repetição `44356247481 SUCCESS` após ajustar timeout exclusivo 60s; Docker `44356247562 SUCCESS`.
- [x] Distinguir Bullet Seed GenIII TM09 Especial/poder10 vs moderna Física/poder25 e distribuição 2..5 GenIII (média2,75), não equipar/alterar custo baseado apenas na prévia D039 2,5.
- [x] CI final PR #65 (`44357355587` geral e `44357355602` Docker) SUCCESS; merge main SHA `db1fe0601275d2840a7355e26f97433fc2589e0c`; Railway deployment `81d23805-40ba-4eb6-a4ab-281946a483c0 SUCCESS` no SHA exato, /health interno aprovado. GET HTTP público externo /play não verificado diretamente.
- [ ] D047: combater viés nos oito matchup, analisar +19,62p.p. de Double Kick antes de nerf/buff, checar teste manual NVDA/VoiceOver/Edge e futuras decisões de TM.


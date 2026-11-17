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

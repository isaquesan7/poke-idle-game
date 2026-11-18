# D-041 — triagem pré-beta das dependências npm (18/11/2026)

> Inventário de risco, NÃO atestado de segurança nem aprovação para beta.
> Fonte: `npm audit --json` do lockfile atual nos artifacts do workflow
> [44287744000](https://github.com/isaquesan7/poke-idle-game/actions/runs/44287744000)
> (`prebeta-npm-audit`, `audit-all.json` e `audit-prod.json`).
> Auditorias futuras podem mudar classificações e versões corrigidas.

## Inventário constatado

- `npm audit --omit=dev`: **0 entradas**.
- `npm audit` completo: **7 entradas** — 2 critical, 4 high, 1 moderate.
- Os sete pacotes pertencem à cadeia das ferramentas Vite/Vitest. Isso **não**
  significa que sete vulnerabilidades independentes afetem a aplicação pública.
  Uma vulnerabilidade transitiva pode aparecer no pacote pai e em vários nós.
- **Cuidado operacional:** `npm prestart` executa `npm run build:web` no
  serviço Railway, portanto ferramentas classificadas como devDependencies
  podem estar fisicamente instaladas durante deploy/startup. Zero entradas
  com `--omit=dev` não comprova ausência de binários vulneráveis no container.

| Pacote | Alerta reportado | Motivo / condição de risco | Direção segura |
| --- | --- | --- | --- |
| `vitest` | critical (direta) | UI/API do Vitest com leitura/execução de arquivos se escutar conexões não confiáveis; versões antigas também herdam avisos do mocker | Manter `vitest run` isolado em CI (sem `--ui`, sem exposição em rede); avaliar upgrade coordenado para linha corrigida após validar compatibilidade |
| `tinypool` | critical (transitiva de Vitest) | Prototype pollution / RCE por opções de workers adulteradas, [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) e [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) | Atualizar somente com árvore compatível que use tinypool corrigido (avaliar versão 2.1.2+) |
| `@vitest/mocker` | moderate (transitiva) | Path traversal/leitura por redirect e registro de mocks, [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) e [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) | Não publicar serviço de mocks; revisar linhas Vitest/@vitest compatíveis e nova auditoria |
| `picomatch` | high (transitiva) | ReDoS com extglobs repetidos, [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) | Atualizar no grafo Vite/Vitest e confirmar faixas seguras |
| `vite` | high (direta de desenvolvimento) | Classificação propagada por `picomatch`, `tinyglobby` e `fdir` no relatório atual; não há GHSA individual do Vite nesta entrada | Revalidar versão/árvore sem aceitar downgrade automático para Vite 6 |
| `fdir`, `tinyglobby` | high (transitivas) | Caminhos indiretos para `picomatch` e seus advisories | Atualizar junto de seus pais, com lockfile reproduzível |

## Estratégia de correção, sem mudanças silenciosas

1. Abrir PR **somente de dependências** com versões explicitamente escolhidas de
   Vite/Vitest e árvore transitiva comprovada. O `npm audit` sugere às vezes
   `vite@6.2.7` (downgrade major da v7 atual) e `vitest@3.2.7`;
   **não seguir essas sugestões automaticamente**, pois o próprio advisory
   de `@vitest/mocker` atinge versões anteriores a 4.1.11, podendo permanecer
   risco mesmo após esse `vitest@3`. Conferir o relatório **depois** do lock.
2. Validar `npm ci`, `npm audit`, `npm audit --omit=dev`, TypeScript core/web,
   219+ Vitest, Node legado, build Vite, 151 GIFs e Chromium desktop/mobile
   /, /play, prévia, rascunho e sandbox antes de merge.
3. Não servir `vite --host`, Vitest UI/API ou servidor de mocks em produção;
   limitar variáveis de ambiente e privilégios do container.
4. Planejar separar build do `npm prestart` da execução pública para reduzir
   dependências de desenvolvimento instaladas no runtime, sem trocar arquitetura
   ou pipeline sem regressão e monitoramento Railway.
5. Fazer nova triagem antes de abrir beta real; documentar avisos residuais,
   alcance explorável e justificativas de aceitação/mitigação de risco.

## Relação com a correção visual da D-041

A correção de GIFs e opção explícita de movimento não requer alterar nenhum
pacote, JavaScript de combate, writer, schema, chance de captura ou economia.
O processo de atualização do lockfile é **independente** da correção visual.

## D-043 — atualização coordenada do Vitest (18/11/2026; branch, sem release)
- A auditoria D-041 mostrou `vitest@3.2.4`, `tinypool@1.1.1`, `@vitest/mocker@3.2.4` e `picomatch@4.0.7` no lockfile antigo. Os 7 alertas reportados não são 7 falhas independentes.
- Fontes públicas de 2026 recomendam `vitest >=4.1.12` para corrigir advisories da `@vitest/mocker` (incluindo bypass Windows e registro de mocks); Vitest 4.1.12 foi selecionado nos **dois** workspaces. Referências: https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8 e https://github.com/advisories/GHSA-82fw-gwwq-j7x9.
- **A atualização não está válida até regenerar `package-lock.json` usando `npm install --package-lock-only --ignore-scripts`, passar `npm ci`, CI TypeScript/Vitest/Node/build/GIFs/E2E e executar `npm audit` depois.** O workflow TEMPORÁRIO de PR `.github/workflows/d043-lockfile-resolve.yml` foi criado para calcular e commitar APENAS o lockfile se GitHub Actions permitir; **deverá ser excluído ANTES do merge**, para que a main não herde job de PR com permissão de escrita.
- **Picomatch CVE-2026-112366:** as fontes npm pesquisadas em 18/11/2026 ainda listam `4.0.7` como última versão publicada, vulnerável a ReDoS via extglob adversarial. Referências: https://www.npmjs.com/package/picomatch e https://github.com/advisories/GHSA-fc5q-39xc-vjpf. Não inventar `4.0.8` nem aplicar override para versão indisponível. Exposição mitigada por não publicar dev server Vite e não processar globs fornecidos por usuários externos; reavaliar com npm audit real e upstream.
- Se o lockfile puder ser resolvido e os testes ficarem verdes, integrar somente após retirar o workflow temporário; se não, registrar bloqueio e manter a versão de produção anterior. GitHub Actions é fonte da resolução; jamais gerar lock na mão nem usar `npm audit fix --force`.

### D-043 lockfile gerado e auditado (CI 44303650680; ainda NÃO publicado)
- O runner Node 22 veio com npm 10.9.9 e o algoritmo Arborist falhou `edgesOut:null` ao atualizar lockfile legado para Vitest 4.1.12. Workflow temporário repetiu resolução via **npm 11**, `npm ci` e `npm audit` e registrou `package-lock.json` com commit bot `a39132c2cd012cb4491b0b50e4ed31c81931c3c2`; o workflow temporário com permissão `contents:write` foi **EXCLUÍDO** no commit seguinte `3d5c0f1dd0ee68b40761768b6c99d5e0e8425af4`.
- Versões resolvidas: `vitest@4.1.12`, `@vitest/mocker@4.1.12`, `vite@7.3.8`, `picomatch@4.0.7`; `tinypool@1.1.1` saiu do topo das dependências do Vitest, sem versão direta em `node_modules/tinypool` do lock atual. Nenhuma mudança de runtime ou de regra.
- **Resultado npm audit do lock atualizado (mesma run CI): 0 crítico, 5 alto, 0 moderado/baixo no total; `--omit=dev` 0.** O npm lista `fdir`, `picomatch`, `tinyglobby`, `vite`, `vitest` como altos, com advisory transitivo vinculado ao Picomatch. NÃO alegar segurança completa: picomatch4.0.7 ainda vulnerável sem versão oficial corrigida no npm nessa data. `npm audit fix --force` sugere downgrades inadequados; não usar.
- Se CI de PR com o **último HEAD humano** não ficar verde, não integrar. O merge/deploy/Railway precisam de verificação adicional. A mitigação atual de Picomatch é NÃO aceitar padrões glob controlados por usuários e NÃO expor dev server Vite/Vitest ao público; reavaliar quando upstream lançar patch confiável. Vite é usado no `prestart` de produção, então planejar separar build/runtime no próximo trabalho.


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

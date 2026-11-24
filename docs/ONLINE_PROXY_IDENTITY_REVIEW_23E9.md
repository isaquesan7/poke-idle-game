# ONLINE-01C-23E9 — Revisão da fronteira de identidade do proxy

## Constatação de código (24/11/2026)

O caminho público é Railway → servidor web → API privada. `online-api-proxy.mjs` descarta Forwarded e X-Forwarded-For; `authSecurity.mjs::requesterIp` usa apenas o peer TCP. Isto evita que um cliente escolha sua própria chave de cota por cabeçalho, mas a API pode enxergar o mesmo peer para muitos jogadores. Os escopos IP atuais por 15 minutos são register 10, verify 20, reset 10, reset-confirm 20, login 30. Os limites por e-mail (4/3/6 nos fluxos respectivos) não resolvem colisão da cota IP. A quota usa UPSERT PostgreSQL e digest HMAC por escopo, sem IP bruto no banco. Identidade de cliente atrás do Railway ainda NÃO foi validada.

## Cobertura proposta

- Teste unitário: endereço do socket prevalece sobre cabeçalhos controlados pelo cliente, e ausência de peer não aceita fallback fornecido pelo cliente. Digest separa escopos e peers distintos.
- Teste de proxy HTTP local com upstream de teste: Forwarded e X-Forwarded-For não chegam ao upstream, e valores forjados distintos não alteram o peer nem o digest. O cenário expõe a colisão estrutural de cota no proxy, não mede distribuição real do Railway.
- Nenhuma mudança no runtime. Nenhuma requisição de carga ao ambiente público, nenhum IP real gravado, nenhuma aprovação de beta.

## Critério de fechamento (pendente)

1. Verificar contrato do ingress Railway: origem confiável, quais cabeçalhos são sobrescritos e se há acesso direto ao serviço web ou API. Não inferir a autenticidade de qualquer cabeçalho pelo nome.
2. Projetar propagação de identidade autenticada entre web e API privada (ou limite no ingress confiável), com validação estrita, rejeição de ambiguidade, ausência de fallback spoofável, proteção de replay quando aplicável, segredos exclusivos do servidor e limites por conta/e-mail mantidos. Decisão arquitetural ainda não tomada.
3. Validar em ambiente isolado com múltiplos clientes legítimos, cabeçalhos forjados, concorrência, múltiplas réplicas, IPv4/IPv6, falhas de configuração e indisponibilidade; registrar apenas contagens e evidência não pessoal.
4. Manter `reverseProxyRateLimitReviewed=false` até evidência operacional independente. Revisar retenção dos digests e canal de exercício dos direitos do titular com responsável jurídico. Cadastro público OFF; não migrar /play; preservar Regiões 1v1, Ginásios 3v3, engine e recompensas.

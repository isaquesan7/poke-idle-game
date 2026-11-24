# ONLINE-01C-23E10 — Protocolo candidato de identidade do proxy (24/11/2026)

## Escopo
Módulo puro, não importado pelos servidores e sem mudança de runtime ou banco. Identidade de cota não é identidade de conta. A API atual continua usando peer TCP e cadastro continua OFF. Nenhum segredo real provisionado.

- IP previamente validado por ingress confiável (ainda não comprovado) é canonicalizado; IPv4 mapeado em IPv6 equivale a IPv4. Cadeias, portas e zonas são recusadas. O IP não entra na assertion; subject é HMAC pseudônimo com chave dedicada. Pseudonimização não é anonimização.
- Assertion v1 assinada com segunda chave de 32 bytes, vinculada a método POST, rota de autenticação, SHA256 do corpo exato (até 16 KiB), timestamp, nonce e subject; janela 30s, tolerância futura 2s. Verificação estrita e constante no MAC, sem fallback para cabeçalho de cliente. Sem chave real, sem endpoint e sem alterações de cotas.
- Testes sintéticos: distinção e normalização de IPs, adulteração, escopo, corpo, prazo, chaves e entrada inválida. Verificação não consome nonce: reuso dentro da janela é possível por design neste recorte offline; não integrar antes de implementar consumo atômico distribuído, retenção e expiração.
- Limites por endereço podem agrupar NAT e IPv6 temporários podem multiplicar sujeitos; definir política de prefixos/abuso, sem prometer identificação individual por IP. Preservar limites por conta/e-mail e evitar armazenar assertion ou IP em logs.

## Próximos gates
1. Verificar ingress Railway real em ambiente isolado: spoofing de X-Real-IP, acesso direto, duplicidade, IPv4/IPv6 e fronteiras; não assinar nenhum valor recebido sem validação.
2. Projetar chave/rotação, transporte privado, configuração fail-closed e consumo atômico de nonce antes de usar a assertion na API. Testar concorrência e falhas, nunca transformar assertion em autenticação de conta.
3. Validar operação com múltiplas réplicas, cotas, privacidade e retenção, depois revisar gate reverseProxyRateLimitReviewed (continua falso). LGPD, restore integral e remetente definitivo permanecem pendentes. Regiões 1v1, Gym 3v3 da Coleção e /play local sem migração intactos.

PR #251 já integrado; #252 com testes complementares reconciliados ainda aguarda CI final na abertura desta branch. Não integrar 23E10 antes de 23E9 e CI do HEAD final.

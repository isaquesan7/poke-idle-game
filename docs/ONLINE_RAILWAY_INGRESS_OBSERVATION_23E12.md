# ONLINE-01C-23E12 — Observação controlada do ingress Railway

24/11/2026: consulta somente leitura do Railway confirmou production com Web público, API sem domínio público configurado, PostgreSQL e serviço restaurado no mesmo environment. Nenhum fork/ambiente de ensaio observado, nenhuma alteração de infraestrutura efetuada. A ausência de domínio na API não prova por si só inexistência de outros caminhos de acesso. O banco restaurado existente não deve ser reutilizado para este ensaio.

Referências oficiais:
- https://docs.railway.com/networking/public-networking/specs-and-limits (X-Real-IP, X-Railway-Edge)
- https://docs.railway.com/networking/private-networking/how-it-works (isolamento por ambiente)

Não presumir que presença de X-Railway-Edge prova origem confiável, nem que cabeçalho X-Real-IP é sobrescrito em todos os caminhos.

## Instrumento isolado, não integrado ao jogo
scripts/railway-ingress-probe.mjs: servidor mínimo GET /probe, exige token aleatório de 32 bytes em hex, autorização Bearer, janela de 15 minutos e no máximo 60 observações autenticadas por processo. Não grava IP, não ecoa token, não conecta ao banco. Compara X-Real-IP único e válido a uma referência fornecida por operador; essa referência serve apenas para observação e jamais para definir identidade confiável. Recusa duplicidade, cadeia e formatos inválidos. Nenhum resultado do probe sozinho aprova gate.

## Execução futura (requer ambiente temporário separado e autorização de custo)
1. Criar ambiente/projeto vazio NÃO clonado de production, sem bancos, volumes, variáveis do jogo ou Resend. Serviço temporário com Node 22 e start command node scripts/railway-ingress-probe.mjs apontando para a branch aprovada. Configurar INGRESS_PROBE_ISOLATED=true e INGRESS_PROBE_TOKEN aleatório somente no ambiente. Usar domínio Railway temporário HTTPS. Não publicar o probe no domínio do jogo. Limites locais por processo reiniciam com restart.
2. De duas redes independentes, confirmar egress IP por fonte independente sob controle do operador e enviar GET /probe com Authorization Bearer e X-Kanto-Probe-Expected. Não colocar tokens em URL, terminal compartilhado, PR ou relatório. Testar baseline e X-Real-IP falso, X-Forwarded-For falso, duplicatas, valores inválidos, IPv4 e IPv6 onde disponíveis. Registrar apenas booleanos, contagem de cabeçalhos, referência de execução e horário, nunca IP/token.
3. A partir de serviço isolado na rede privada, testar acesso direto e injeção; não confiar em identidade recebida de caminho privado. Confirmar também ausência de domínio/TCP proxy na API real com revisão separada. Se spoofing puder produzir identidade aceita, manter bloqueio e revisar arquitetura.
4. Encerrar serviço e retirar domínio/token após ensaio. Revisar evidência de origem e caminhos alternativos com operador independente. Não inferir confiança de um teste único; não ativar cadastro ou integração HTTP.

Gate reverseProxyRateLimitReviewed permanece falso. PRs #253/#254 continuam dependentes de CI/merge. Próximo: execução autorizada do ensaio real e revisão de política de chaves/nonce/privacidade. Cadastro OFF, /play local, sem alteração de engine/economia, restore integral e remetente definitivo pendentes.

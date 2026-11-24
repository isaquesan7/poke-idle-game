# ONLINE-01C-23E24 — homologação pública do gateway candidato

## Escopo
Após 23E23B (PR #266, evidência TCP/DNS e limpeza), validar o receptor de homologação já aprovado, não um adapter de produção. O novo cliente scripts/run-gateway-public-observation.mjs limita URL ao domínio HTTPS Railway gateway-isolation-target*, envia Host explícito e token efêmero, recebe somente booleanos e contagens sanitizados. Sete casos: baseline, X-Real-IP falso, forwarded falso, duplicado, inválido, cadeia e X-Railway-Edge falso. Cada caso exige 200, exatamente um IP válido e igual à referência independente, peer diferente, prova sintética verificada, productionTrustGranted=false, upstreamContacted=false. Falha, timeout, 410, diferença de IP ou família indisponível não aprova. Nunca armazena IP, token ou assertion em relatório.

## Operador e procedimento
Somente após CI do HEAD final e autorização para ensaio. Reusar projeto TEMP vazio, exclusivamente gateway-isolation-target com Dockerfile.gateway-observation, PORT=3000, GATEWAY_OBSERVATION_ISOLATED=true, token 32 bytes/64 hex, sem addressRole, domínio Railway HTTPS temporário, restart NEVER e uma réplica. Sem DB, volume, serviços irmãos ou TCP proxy. Confirmar readiness e janela de 15 minutos. De duas redes realmente independentes, confirmar egress da família escolhida por fonte independente (não pelo próprio gateway), executar com referência atual e repetir confirmação ao fim; se IP mudou, invalidar rodada. Forçar família no cliente seleciona resolução/conexão IPv4 ou IPv6; isso não prova família do egress se houver tradução/túnel. Comparar referência efetiva; distinguir IPv6 indisponível de teste aprovado. Não inventar resultados de família nem tratar duas rodadas na mesma conexão como duas redes. Operador compartilha somente JSON sanitizado; relatório do provedor pode conter IP, acessar somente contagens/booleanos. Remover serviços, token e domínio depois do teste.

Windows CMD, checkout limpo da revisão aprovada:
    set "INGRESS_PROBE_URL=https://DOMINIO-TEMPORARIO.up.railway.app/probe"
    set "INGRESS_PROBE_TOKEN=TOKEN_LOCAL"
    set "INGRESS_PROBE_EXPECTED_IP=IP_CONFIRMADO"
    set "INGRESS_PROBE_FAMILY=4"
    node scripts/run-gateway-public-observation.mjs
    set "INGRESS_PROBE_TOKEN="
    set "INGRESS_PROBE_EXPECTED_IP="
    set "INGRESS_PROBE_URL="
    set "INGRESS_PROBE_FAMILY="

Não executar placeholders. Repetir em rede móvel e em IPv6 nativo quando disponível, com referência IPv6 independente e family=6. Não compartilhar IP/token em chat/print. Limite total 60 observações; quatro rodadas x7 =28. Sem ambiente real nesta PR.

## Revisão de prefixos (proposta, não decisão)
O protocolo v1 canonicaliza IPv4 e IPv4-mapped e IPv6 textual, mas usa IPv6 completo como subject; endereços de privacidade podem trocar dentro de um prefixo e contornar cota por IP. Candidato a avaliar: IPv6 /64 com domínio HMAC versionado, IPv4 /32, mapped tratado como IPv4; /56 pode reunir usuários demais, /128 permite rotação. Nem /64 nem /56 identifica pessoa nem impede abuso distribuído. Revisar CGNAT, redes compartilhadas, mobilidade, prefixos delegados, limites por e-mail/conta e globais, falso positivo e transição de subjects/rotação/restore antes de adotar. Não aceitar prefixo do navegador, não mudar protocolo existente, não persistir IP bruto. Testes de canonicalização e distribuição serão etapa separada, com política expressa e revisão independente. Não afirmar que IPv6 de rede privada homologado implica IPv6 público homologado.

Cadastro OFF, gate reverseProxyRateLimitReviewed=false, SQL026 candidata, /play local sem migração, Regiões 1v1, Gym 3v3 da Coleção, restore/Resend/LGPD pendentes. CI sintético não equivale a ensaio real.

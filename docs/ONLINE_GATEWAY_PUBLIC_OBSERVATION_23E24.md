# ONLINE-01C-23E24 — homologação pública do gateway candidato

## Escopo
Após 23E23B (PR #266, evidência TCP/DNS e limpeza), validar o receptor de homologação já aprovado, não um adapter de produção. O novo cliente scripts/run-gateway-public-observation.mjs limita URL ao domínio HTTPS Railway gateway-isolation-target*, envia Host explícito e token efêmero, recebe somente booleanos e contagens sanitizados. Sete casos: baseline, X-Real-IP falso, forwarded falso, duplicado, inválido, cadeia e X-Railway-Edge falso. Cada caso exige 200, exatamente um IP válido e igual à referência independente, peer diferente, prova sintética verificada, productionTrustGranted=false, upstreamContacted=false. Falha, timeout, 410, diferença de IP ou família indisponível não aprova. Nunca armazena IP, token ou assertion em relatório.

## Operador e procedimento
Procedimento de referência para eventual validação incremental junto ao adapter final (ver revisão de continuidade ao fim); não repetir ensaio genérico de duas redes já realizado em #255. Somente após CI do HEAD final e autorização para ensaio. Reusar projeto TEMP vazio, exclusivamente gateway-isolation-target com Dockerfile.gateway-observation, PORT=3000, GATEWAY_OBSERVATION_ISOLATED=true, token 32 bytes/64 hex, sem addressRole, domínio Railway HTTPS temporário, restart NEVER e uma réplica. Sem DB, volume, serviços irmãos ou TCP proxy. Confirmar readiness e janela de 15 minutos. De duas redes realmente independentes, confirmar egress da família escolhida por fonte independente (não pelo próprio gateway), executar com referência atual e repetir confirmação ao fim; se IP mudou, invalidar rodada. Forçar família no cliente seleciona resolução/conexão IPv4 ou IPv6; isso não prova família do egress se houver tradução/túnel. Comparar referência efetiva; distinguir IPv6 indisponível de teste aprovado. Não inventar resultados de família nem tratar duas rodadas na mesma conexão como duas redes. Operador compartilha somente JSON sanitizado; relatório do provedor pode conter IP, acessar somente contagens/booleanos. Remover serviços, token e domínio depois do teste.

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


## 23E24 — revisão de continuidade e evidências reutilizáveis (24/11/2026)
- NÃO repetir o ensaio genérico de duas redes: #255 / 23E12D já registrou 12/12 HTTP 200, seis cenários por origem independente, X-Real-IP único e coincidente com referência externa, serviço removido. Fonte: docs/ONLINE_RAILWAY_INGRESS_OBSERVATION_23E12.md. #259 / 23E17B comprovou falsificação privada; #263 / 23E22B e #266 / 23E23B observaram isolamento DNS e TCP IPv4/IPv6 entre projetos, controles positivos e limpeza. Evidências são limitadas à topologia/versão observadas, não aprovação universal.
- #267 é ferramenta reutilizável de diagnóstico, NÃO uma exigência de repetir os 12 casos pelo operador agora. A diferença não comprovada externamente é a prova sintética do receptor mais recente associada à referência independente, além de IPv6 público quando disponível; os controles públicos do ensaio cross-project não compararam IP real. Não declarar essas diferenças aprovadas. Concentrar eventual validação incremental na homologação integrada do adapter final em ambiente descartável, com revisão de fronteira e topologia; pedir participação do operador somente para uma lacuna concreta não coberta por evidência existente. Nenhum provisionamento agora.
- Próxima ação técnica após CI #267: revisar e testar offline política de subject IPv6/prefixos, fechar decisão de fronteira/configuração fail-closed e preparar adapter candidato; não abrir novos ciclos de probes genéricos. Reutilizar testes PG18, chaves e nonce existentes (#254–261), sem refazer engine. Consolidar os gates de lançamento em checklist único: segurança do gateway/quotas (reverseProxyRateLimitReviewed=false), restore integral validado (não confundir clone existente com validação completa), remetente definitivo Resend (sandbox real já observado em #250), LGPD e revisão independente. SQL026 candidata, cadastro OFF, /play local sem migração, Regiões 1v1, Gym 3v3 da Coleção. Antes de iniciar qualquer nova etapa consultar evidência existente e declarar exatamente o delta e critério de saída.

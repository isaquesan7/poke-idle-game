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

## Empacotamento e cliente de ensaio (revisão)
Usar Dockerfile.ingress-probe na raiz do repositório, não o Dockerfile de produção (que exclui scripts). Deixar start command padrão da imagem, restart policy NEVER, uma réplica e nenhum pre-deploy. O container contém exclusivamente o script e Node. Para cada rede, configurar localmente INGRESS_PROBE_URL (HTTPS do serviço temporário terminado em /probe), INGRESS_PROBE_TOKEN e INGRESS_PROBE_EXPECTED_IP (IP confirmado por fonte independente). Executar node scripts/run-railway-ingress-probe.mjs. O cliente não ecoa segredos, IP ou corpo arbitrário e não segue redirecionamentos; registra seis casos e resultado conservador. Não enviar token ou IP no chat. Limpar as variáveis ao terminar.

Consulta de configuração confirmou API real sem TCP proxies e sem tracing habilitado; nenhuma exposição foi criada. A execução automatizada externa nesta sessão não está disponível (rede do container sem resolução DNS e ferramentas Railway sem cliente HTTP arbitrário). Portanto não iniciar serviço faturável sem caminho de ensaio e encerramento operacional confirmado. O operador pode executar de duas redes após CI e preparação explícita. Não confundir resultados locais com comprovação do ingress real.

## CI da imagem isolada
Workflow ingress-probe.yml compila e verifica a imagem dedicada em loopback descartável, incluindo usuário não-root, conteúdo mínimo, recusa sem configuração, autorização e comparação sintética sem IP no resultado. Não envia tráfego à Railway e não é evidência do ingress. Aguardar aprovação antes do ensaio externo.

## Operador Windows CMD
Em checkout atualizado da branch aprovada, executar:

    node --version
    git fetch origin
    git switch --detach origin/test/online01c23e12-ingress-observation
    node --check scripts/run-railway-ingress-probe.mjs

Usar um checkout limpo/temporário, não sobrescrever alterações locais. Após provisionamento aprovado do serviço temporário, preencher localmente:

    set "INGRESS_PROBE_URL=https://DOMINIO-TEMPORARIO.up.railway.app/probe"
    set "INGRESS_PROBE_TOKEN=TOKEN_LOCAL"
    set "INGRESS_PROBE_EXPECTED_IP=IP_CONFIRMADO"
    node scripts/run-railway-ingress-probe.mjs
    set "INGRESS_PROBE_TOKEN="
    set "INGRESS_PROBE_EXPECTED_IP="
    set "INGRESS_PROBE_URL="

Não executar placeholders nem compartilhar token/IP. Repetir com rede móvel e verificar referência independente de IP. Compartilhar apenas as linhas JSON sanitizadas do cliente. Se a referência mudar durante o teste, repetir dentro da janela. Encerrar serviço ao terminar.

## Primeira tentativa externa (24/11/2026)
Operador recebeu seis respostas 404, inclusive baseline; nenhum resultado de identidade confirmado. Logs HTTP do serviço não mostraram os seis GET /probe no recorte consultado. Reprodução local Node 22: cabeçalhos em array sem Host retornam 400 antes do handler; com Host explícito retornam 200. Corrigido cliente para informar target.host. Causa provável do 404 de roteamento, a confirmar no novo ensaio. Token renovado após exposição parcial em captura e janela do serviço reiniciada; nunca guardar token/IP no relatório. Logs HTTP do provedor podem conter IP mesmo que o aplicativo não grave. Gate permanece falso.


## ONLINE-01C-23E12D — evidência externa de duas redes (24/11/2026)
- PR #255 integrado em main aeb67aeba21d23cbfc738295f074e91d56ed6764 após CI geral 45428929674 e imagem isolada 45428933484 SUCCESS. Probe descartável em projeto separado, deploy 0c113de7-0b31-40d7-ba3f-16104891627a SUCCESS, SHA 0424fa69f537e16ed82009593575cd10602d21d6. Operador realizou dois ensaios de seis casos cada: baseline, forged-real-ip, forged-forwarded, duplicate-real-ip, invalid-real-ip, chain-real-ip. Todos status 200, realIpHeaderCount=1, realIpValid/expectedValid/matchesExpected=true, matchesSocketPeer=false, publicPathConsistent=true. Logs Railway confirmaram 12 GET /probe status 200, duas origens distintas, seis por origem, entre 15:47:36 e 16:00:56 UTC. Seis respostas 410 da janela expirada foram resolvidas com restart. Não armazenar IP ou token no relatório. Serviço temporário removido após ensaio e inventário confirmou zero serviços/volumes; produção não alterada. Evidência restrita ao caminho público e duas redes; revisão de caminho privado/IPv6, chave/restore e integração seguem pendentes, reverseProxyRateLimitReviewed=false. Cadastro OFF.
- PR #254 PG18 e regressão geral SUCCESS; browser cancelado, não aprovado. Reconciliado com #255, aguarda CI completo do novo HEAD. Sem migração de banco ou runtime HTTP.

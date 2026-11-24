# ONLINE-01C-23E26 — adapter de ingress em topologia exclusiva Railway

## Decisão e evidência reutilizada
#268 integrado em main 9d9151369ac6f9cc64a023c9575c7fffcd19ab26 após quatro CIs SUCCESS. Reutilizar #255 (12/12 ingress público), #259 (spoof privado), #263/#266 (DNS/TCP entre projetos) e #260/#261 (jornada PG18). NÃO repetir probes genéricos. Revisão do fornecedor:
- https://docs.railway.com/networking/private-networking/how-it-works — isolamento de rede por projeto/ambiente.
- https://docs.railway.com/networking/public-networking/specs-and-limits — X-Real-IP é metadado público.
- https://station.railway.com/questions/supported-proxy-trust-configuration-for-198549e9 e https://station.railway.com/questions/express-trust-proxy-1-can-railway-in-66578809 — edge sobrescreve cabeçalhos públicos, sem lista estável de IPs dos proxies. Não usar lista/CIDR de pares como garantia.

## Implementação candidata
Substitui lista fixa por revisão de topologia exclusiva: um serviço, uma réplica, um domínio Railway HTTPS, zero TCP proxies, nenhum outro caminho privado ou sandbox, controle de mudanças e referência de revisão. Valida identidade do projeto/ambiente/serviço/commit/domínio contra variáveis Railway de runtime; injeção simulada somente em NODE_ENV=test. Configuração incompatível falha antes de assinar. X-Real-IP deve ser único, válido, não nomeado em Connection, candidato público, distinto do peer. Sem fallback, X-Railway-Edge e forwarded ignorados. Origem do navegador coincide com domínio revisado. Sem launcher real ou alteração dos handlers de produção.

**Limite crítico:** a configuração de revisão não comprova inventário ou isolamento automaticamente; o aplicativo não consegue distinguir um peer privado que efetivamente chegue ao listener. O teste demonstra essa limitação deliberadamente. Acesso ao ambiente, processos locais, sandboxes, réplicas, TCP, domínios, mudanças de topologia e commit devem ser controlados/revistos externamente antes da ativação; qualquer alteração revoga a aprovação. A proteção é condicional à topologia, não autenticação criptográfica do edge. Se exclusividade não puder ser garantida, não confiar em X-Real-IP e não habilitar cadastro; escolher arquitetura alternativa. Não declarar IPv6 público comprovado. Sem autorização de produção.

## Critério de saída
Testes existentes adaptados: peers variáveis, revisão faltante/incompatível, cabeçalhos inválidos, assinatura + /64 e jornada PG18 com fixture explícita. CI geral e PG18 do HEAD reconciliado obrigatórios. Próxima etapa: preparar launcher e modo operacional fechado por padrão, com forwarding/receiver e chave dedicada, nonce SQL026 sob aprovação; homologar apenas delta final em ambiente descartável, sem tocar /play ou criar nova série de probes. Restore integral, Resend definitivo, LGPD e revisão independente ainda pendentes. Cadastro OFF, Regiões 1v1, Gym 3v3 da Coleção preservados.

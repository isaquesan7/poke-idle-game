# ONLINE-01C-23E1 / 23E3 — Entrada e recuperação da conta, com lançamento fechado

A raiz / já possui a landing HTML (não é a página React de laboratório e não é o protótipo v0.1). Este recorte melhora a experiência sem abrir cadastro.

## 23E3 — Melhorias
- A página inicial tem abas Entrar e Criar conta. O formulário de criação e o de redefinição de senha agora exigem confirmação de senha compatível e validam 12–128 caracteres antes de enviar.
- Os links /verify-email?token=… e /reset-password?token=… são recebidos, validados como tokens de 43 caracteres e removidos do endereço com history.replaceState. Links ausentes ou inválidos mostram uma explicação no formulário sem armazenar segredo.
- A troca de aba volta a URL para / e descarta senhas e tokens anteriores. O botão Esqueceu a senha? abre /reset-password com os campos apropriados.
- Quando o backend informa que o cadastro não está habilitado, os botões de submissão permanecem desativados, sem simular sucesso. Erros e feedback são texto acessível (aria-live) e não persistidos.
- Há testes de sintaxe e contrato estático da página e suas proteções, além da regressão de navegador já utilizada pelo projeto.

## 23E1 consolidado
O contrato offline de solicitação de exclusão foi incorporado à base atual porque a PR #243 foi criada antes do merge da #244 e não estava pronta para merge. Este gate apenas verifica requisitos declarados de identidade, retenção e revisão; **deletionAuthorized:false** permanece permanente. Não há endpoint de exclusão nem processo destrutivo.

## Bloqueios mantidos
O backend permanece hard-blocked em produção (NODE_ENV==='test' && ONLINE_REGISTRATION_ENABLED==='true'). Nenhum novo fluxo altera PostgreSQL de produção, env do Railway, Resend, saves locais ou estatísticas do motor. Não há migração de saves do /play. Regiões 1v1 usam team[0] e Ginásios 3v3 continuam com trio selecionado na Coleção antes da reserva.

Próximas etapas: provar restauração real isolada do Railway e entrega real de e-mail, aprovar LGPD e proxy/rate limit, integrar autorização e UX com o fluxo de contas somente depois.

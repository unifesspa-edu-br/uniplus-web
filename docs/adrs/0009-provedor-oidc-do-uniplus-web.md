---
status: "accepted"
date: "2026-05-01"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0009: Provedor OIDC do `uniplus-web`

> **Emenda (2026-10-23).** A diretriz 6 passou a fixar a máscara de CPF `***.999.999-**`, conforme o Parecer DPO 002/2026. A forma anterior, que ocultava os dígitos centrais e deixava os verificadores à mostra, foi substituída.
>
> **Emenda (2026-11-26).** A diretriz 4 passou a dizer que os tokens ficam só em memória: o `keycloak-js` 26 não os grava em storage algum, e o que ele grava no navegador é o estado do retorno do login, sem token. Nada do que a pessoa preencheu é guardado no navegador. A sessão é dada por encerrada quando o provedor recusa a renovação e o cliente descarta a credencial; então a aplicação avisa que o que não foi gravado se perdeu e, a pedido da pessoa, volta à mesma rota depois do login. A renovação do acesso é antecipada pelo prazo que o login informa, com antecedência configurada e só enquanto a pessoa usa a aplicação; o fim da sessão é dado pela recusa do provedor, não pela hora do computador. O realm não troca a credencial de renovação a cada uso.
>
> **Emenda (2026-11-27).** Antes de a sessão acabar, a aplicação avisa a pessoa em quanto tempo isso acontece, a partir do prazo da credencial de renovação que o login já informou, faltando dois minutos (o WCAG 2.2.1 exige pelo menos 20 segundos). Se o limite é a inatividade, o aviso oferece continuar, que pede mais tempo ao provedor. O período máximo da sessão (10 horas no realm, abaixo das 20 horas que dispensam o aviso) não se estende renovando: nele, ou quando o pedido de mais tempo não avança o prazo, o aviso só oferece entrar de novo antes do fim, voltando à mesma rota. O aviso não guarda nada no navegador, não se fecha por Esc e devolve o foco ao ponto onde a pessoa estava. Sem ação da pessoa, nada renova o acesso, nem o pedido automático de uma tela que consulta sozinha: no prazo da sessão a aplicação tenta renovar, o provedor recusa e a sessão é encerrada, sem esperar a pessoa voltar. Um 401 recebido quando o acesso em memória já venceu é desse pedido sem renovação e não encerra a sessão; o aviso de sessão encerrada, dispensado, só reabre depois de uma ação da pessoa.
>
> **Emenda (2026-11-27, entrar de novo).** Entrar de novo durante o período máximo encerra a sessão no provedor e começa outra, porque pedir nova autenticação com a sessão viva, inclusive com `prompt=login`, mantém a mesma sessão e o mesmo fim de período (medido no Keycloak 26). O encerramento vale para as três aplicações, que de todo modo terminariam no mesmo instante, e o aviso diz isso antes da ação. A volta à mesma rota é levada na URL de retorno do encerramento e retirada na partida, sem guardar nada no navegador. Uma aplicação cuja sessão já foi encerrada por outra apenas entra de novo, sem encerrar a sessão nova.

## Contexto e enunciado do problema

O `uniplus-web` é composto por três aplicações Angular (Seleção, Ingresso, Portal — ver ADR-0001) cujos usuários precisam autenticar-se com diferentes perfis (administrador, gestor, avaliador, candidato). Os candidatos chegam preferencialmente pelo Login Único do gov.br, e os usuários internos pelo IdP institucional. O frontend precisa de SSO entre as três apps e de tokens JWT carregados automaticamente nas requisições aos backends.

A escolha do identity provider e do contrato de tokens é cross-cutting com o backend (`uniplus-api`), mas, do ponto de vista do `uniplus-web`, o contrato canônico é OIDC. A implementação atual usa Keycloak por disponibilidade na infraestrutura da UNIFESSPA, sem tornar Keycloak requisito arquitetural do frontend.

## Drivers da decisão

- SSO nativo entre as três apps frontend.
- Federação com gov.br (Login Único) via OIDC, sem código customizado.
- Tokens JWT injetados automaticamente em requisições HTTP do Angular.
- Roles e atributos customizados (nome social, CPF) gerenciáveis no IdP.
- Compatibilidade com Angular 21, Reactive Forms, signals e Zone.js.

## Opções consideradas

- Provedor OIDC externo via adapter Angular.
- Auth0 (SaaS).
- Implementação OIDC própria com `oidc-client-ts`.
- ASP.NET Identity + Duende IdentityServer (IdP gerido pelo backend).

## Resultado da decisão

**Escolhida:** consumir um provedor externo compatível com OIDC. A implementação corrente usa Keycloak integrado ao Angular via `keycloak-angular` e `keycloak-js`, por comodidade operacional da infraestrutura existente.

Diretrizes derivadas da decisão para o `uniplus-web`:

1. Inicializar o cliente OIDC via `APP_INITIALIZER` (`provideAuth()`) no bootstrap de cada app.
2. Configurar `tokenInterceptor` em `libs/shared-auth` para injetar `Authorization: Bearer <jwt>` em todas as requisições HTTP que tenham o backend Uni+ como destino.
3. Implementar `authGuard` e `roleGuard` em `libs/shared-auth` para proteger rotas por perfil.
4. Tokens somente em memória, com silent SSO check via iframe — **nunca** armazenar tokens em `localStorage` nem em `sessionStorage`.
5. Logout iniciado no provedor OIDC para garantir invalidação da sessão SSO entre as três apps.
6. Atributos como `nome_social` e `cpf` consumidos via claims do token; LGPD obriga masking em logs, com o CPF como `***.999.999-**` (Parecer DPO 002/2026).

A configuração específica de realm/tenant, clients, flows e mappers é responsabilidade da plataforma e está fora do escopo deste ADR — o `uniplus-web` apenas consome endpoints OIDC e claims acordados.

## Consequências

### Positivas

- SSO entre as três aplicações frontend sem código adicional.
- Federação com gov.br via protocolo padrão (OIDC), sem implementação customizada.
- Tokens JWT stateless, cacheados pelo adapter OIDC durante a sessão do usuário.
- Reuso da biblioteca de autenticação (`@uniplus/shared-auth`) entre as três apps elimina divergência.

### Negativas

- Dependência de um provedor OIDC disponível para que o frontend bootstrape em produção.
- `keycloak-js` historicamente usa iframe para silent SSO check; políticas restritivas de cookies (SameSite) podem exigir ajustes específicos.
- Enquanto o adapter atual for Keycloak, atualizações de major do `keycloak-angular` precisam ser coordenadas com a versão do servidor.

### Neutras

- A decisão é independente do framework SPA: trocar Angular obrigaria adotar outro adapter OIDC, sem alterar o protocolo.

## Confirmação

- `libs/shared-auth` é a única origem de imports do adapter OIDC concreto (`keycloak-js`/`keycloak-angular`) no workspace (verificável por lint).
- Suíte E2E inclui cenários de login, refresh, expiração de token e logout para regressão.
- Tokens **nunca** são logados; sinks aplicam masking de claims sensíveis (CPF).

## Mais informações

- ADR-0001 detalha a separação em três aplicações (todas consumindo o mesmo provedor OIDC para SSO).
- **Origem:** revisão da ADR interna Uni+ ADR-008 (não publicada), versão sanitizada para o frontend.

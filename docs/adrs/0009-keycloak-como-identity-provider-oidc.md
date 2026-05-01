---
status: "accepted"
date: "2026-05-01"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0009: Keycloak como identity provider OIDC do `uniplus-web`

## Contexto e enunciado do problema

O `uniplus-web` é composto por três aplicações Angular (Seleção, Ingresso, Portal — ver ADR-0001) cujos usuários precisam autenticar-se com diferentes perfis (administrador, gestor, avaliador, candidato). Os candidatos chegam preferencialmente pelo Login Único do gov.br, e os usuários internos pelo IdP institucional. O frontend precisa de SSO entre as três apps e de tokens JWT carregados automaticamente nas requisições aos backends.

A escolha do identity provider e do contrato de tokens é cross-cutting com o backend (`uniplus-api`), mas, do ponto de vista do `uniplus-web`, o que importa é o protocolo (OIDC) e a integração no bootstrap das aplicações Angular.

## Drivers da decisão

- SSO nativo entre as três apps frontend.
- Federação com gov.br (Login Único) via OIDC, sem código customizado.
- Tokens JWT injetados automaticamente em requisições HTTP do Angular.
- Roles e atributos customizados (nome social, CPF) gerenciáveis no IdP.
- Compatibilidade com Angular 21, Reactive Forms, signals e Zone.js.

## Opções consideradas

- Keycloak via `keycloak-angular` + `keycloak-js`.
- Auth0 (SaaS).
- Implementação OIDC própria com `oidc-client-ts`.
- ASP.NET Identity + Duende IdentityServer (IdP gerido pelo backend).

## Resultado da decisão

**Escolhida:** consumir um Keycloak externo como identity provider OIDC, integrado ao Angular via `keycloak-angular` e `keycloak-js`.

Diretrizes derivadas da decisão para o `uniplus-web`:

1. Inicializar Keycloak via `APP_INITIALIZER` (`provideAuth()`) no bootstrap de cada app.
2. Configurar `tokenInterceptor` em `libs/shared-auth` para injetar `Authorization: Bearer <jwt>` em todas as requisições HTTP que tenham o backend Uni+ como destino.
3. Implementar `authGuard` e `roleGuard` em `libs/shared-auth` para proteger rotas por perfil.
4. Persistência de sessão usando o storage padrão do `keycloak-js` (sessionStorage) com silent SSO check via iframe — **nunca** armazenar tokens em `localStorage`.
5. Logout iniciado no Keycloak (`keycloak.logout({ redirectUri })`) para garantir invalidação da sessão SSO entre as três apps.
6. Atributos como `nome_social` e `cpf` consumidos via claims do token; LGPD obriga masking em logs (CPF como `***.***.***-XX`).

A configuração específica de realm, clients, flows e mappers do Keycloak é responsabilidade da plataforma e está fora do escopo deste ADR — o `uniplus-web` apenas consome um endpoint OIDC.

## Consequências

### Positivas

- SSO entre as três aplicações frontend sem código adicional.
- Federação com gov.br via protocolo padrão (OIDC), sem implementação customizada.
- Tokens JWT stateless, cacheados pelo `keycloak-js` durante a sessão do usuário.
- Reuso da biblioteca de autenticação (`@uniplus/shared-auth`) entre as três apps elimina divergência.

### Negativas

- Dependência de um serviço Keycloak disponível para que o frontend bootstrape em produção.
- `keycloak-js` historicamente usa iframe para silent SSO check; políticas restritivas de cookies (SameSite) podem exigir ajustes específicos.
- Atualizações de major do `keycloak-angular` precisam ser coordenadas com a versão do servidor Keycloak.

### Neutras

- A decisão é independente do framework SPA: trocar Angular obrigaria adotar a SDK Keycloak da nova plataforma, sem alterar o protocolo.

## Confirmação

- `libs/shared-auth` é a única origem de imports de `keycloak-js`/`keycloak-angular` no workspace (verificável por lint).
- Suíte E2E inclui cenários de login, refresh, expiração de token e logout para regressão.
- Tokens **nunca** são logados; sinks aplicam masking de claims sensíveis (CPF).

## Mais informações

- ADR-0001 detalha a separação em três aplicações (todas consumindo o mesmo realm Keycloak para SSO).
- **Origem:** revisão da ADR interna Uni+ ADR-008 (não publicada), versão sanitizada para o frontend.

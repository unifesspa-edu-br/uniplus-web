# AGENTS.md — uniplus-web

## Ambiente e comandos

- Use `rtk` como prefixo de todo comando de shell.
- Use Node.js 22 (`nvm use`) e `npm ci`; não altere o lockfile sem necessidade.
- Execute comandos Nx a partir da raiz do workspace. Para uma mudança focada,
  prefira `npx nx lint <projeto>`, `npx nx vite:test <projeto>` e
  `npx nx build <projeto>` em vez de gates globais.
- Para alterações somente em Markdown, valide os arquivos modificados com
  `npx prettier --check <arquivos>` e `git diff --check`.

## Arquitetura

- Apps Angular: `selecao`, `ingresso`, `portal` e `configuracao`; as portas de
  desenvolvimento são, respectivamente, 4200–4203.
- Use os aliases `@uniplus/shared-*`; não faça deep imports em `libs/*/src`.
- Componentes são standalone, `OnPush`, usam signals e não devem usar `any`.
- Preserve a separação entre UI reutilizável (`shared-ui`) e regras de domínio.
- O Uni+ DS é CSS-only: use tokens semânticos e wrappers `ui-*`; não introduza
  uma paleta Tailwind paralela nem temas PrimeNG globais.

## Runtime e autenticação

- `provideRuntimeConfig()` deve aparecer antes de `provideAuth()` em todo
  `app.config.ts`.
- O fluxo OIDC, o interceptor e o refresh token pertencem a `shared-auth`.
  Não implemente refresh por app nem persista JWT em `localStorage` ou
  `sessionStorage`.
- Para backend local, o repositório irmão `uniplus-api` sobe infra, APIs e
  Traefik; execute somente os serviços documentados em
  `docs/guia-testar-frontend-com-backend-local.md`, mantendo os containers
  `*-web` desligados durante `nx serve`.

## Qualidade e segurança

- Mantenha textos visíveis ao usuário em pt-BR, formulários reativos tipados e
  rotas de feature em lazy loading.
- Valide acessibilidade (teclado, foco, 320 px, zoom 200% e contraste) em
  alterações de interface.
- Não exponha CPF nem tokens em logs; mascare dados pessoais.
- Não altere arquivos fora do escopo da tarefa e preserve mudanças preexistentes.

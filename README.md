# Uni+ Web

Frontend da plataforma **Uni+** da [UNIFESSPA](https://unifesspa.edu.br) — Universidade Federal do Sul e Sudeste do Pará.

## Sobre

Interface web para candidatos, servidores e gestores da UNIFESSPA interagirem com os processos seletivos e de ingresso. Desenvolvido pelo Departamento de Sistemas Acadêmicos (DISI/CTIC).

## Apps

| App | Descrição | Deploy |
|---|---|---|
| **selecao** | Processos seletivos — inscrição, acompanhamento, resultados | `selecao.uniplus.unifesspa.edu.br` |
| **ingresso** | Matrícula — envio de documentos, homologação | `ingresso.uniplus.unifesspa.edu.br` |
| **portal** | Portal público — editais, resultados, transparência | `uniplus.unifesspa.edu.br` |

## Libs compartilhadas

| Lib | Descrição |
|---|---|
| `shared-ui` | Componentes PrimeNG compartilhados |
| `shared-auth` | Integração Keycloak/Gov.br |
| `shared-data` | Clients TypeScript gerados do OpenAPI |

## Stack

- **Framework:** Angular 20 (LTS)
- **UI Kit:** PrimeNG + Tailwind CSS
- **State management:** NgRx SignalStore
- **Workspace:** Nx
- **Testes E2E:** Playwright
- **Testes unitários:** Jest

## Arquitetura

Cada app é **independente** — compila e faz deploy como container separado no Kubernetes. Derrubar uma app para manutenção não afeta as outras.

```
apps/
  selecao/        → container selecao-web  (pod K8s independente)
  ingresso/       → container ingresso-web (pod K8s independente)
  portal/         → container portal-web   (pod K8s independente)
libs/
  shared-ui/      → componentes compartilhados
  shared-auth/    → autenticação
  shared-data/    → clients API
```

## Pré-requisitos

- Node.js 22 LTS
- npm ou pnpm

## Como executar

```bash
# Instalar dependências
npm install

# Executar app Seleção
npx nx serve selecao

# Executar app Ingresso
npx nx serve ingresso

# Executar Portal
npx nx serve portal
```

## Testes

```bash
# Testes unitários (todas as apps)
npx nx run-many --target=test

# Testes E2E (Playwright)
npx nx e2e selecao-e2e

# Lint
npx nx run-many --target=lint
```

## Contribuindo

1. Crie uma branch: `feature/{slug}`, `fix/{slug}`
2. Commits em conventional commits (pt-BR): `feat(selecao): adicionar formulário de inscrição`
3. Abra um Pull Request para `main`
4. Aguarde revisão e aprovação

## Licença

[MIT](LICENSE)

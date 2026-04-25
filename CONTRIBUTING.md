# Guia de Contribuição — Uni+ Web

Este documento descreve como contribuir com o frontend da plataforma Uni+. Leia-o por completo antes de abrir sua primeira contribuição.

> **Regras transversais de commits e integração:** este repositório segue o **[Guia de Commits e Integração](https://github.com/unifesspa-edu-br/uniplus-docs/blob/main/docs/guia-commits-e-integracao.md)** — referência oficial para todos os repositórios do projeto (`uniplus-api`, `uniplus-web`, `uniplus-docs`), mantido em `uniplus-docs`. Este documento complementa o guia com regras específicas do frontend.

---

## Pré-requisitos

| Ferramenta | Versão mínima | Verificação |
|---|---|---|
| Node.js | 22 LTS | `node --version` |
| npm | 10+ | `npm --version` |
| Git | 2.40+ | `git --version` |
| GitHub CLI | 2.50+ | `gh --version` |

### Setup inicial

```bash
git clone git@github.com:unifesspa-edu-br/uniplus-web.git
cd uniplus-web
npm install
```

O `npm install` ativa o hook de pre-commit do `husky`, que roda `lint-staged` em cada `git commit` e formata/valida apenas os arquivos staged. Veja [Estratégia de lint em três camadas](#estratégia-de-lint-em-três-camadas).

---

## Estrutura do projeto

Este é um **Nx workspace** com múltiplas apps Angular independentes e libs compartilhadas.

```
apps/
  selecao/                → App de processos seletivos
    src/
      app/
        features/         → Módulos por funcionalidade (lazy-loaded)
        core/             → Services, guards, interceptors
        shared/           → Componentes locais da app
      environments/
      assets/
  selecao-e2e/            → Testes E2E da app Seleção (Playwright)

  ingresso/               → App de matrícula e ingresso
    src/
      app/
        features/
        core/
        shared/
      environments/
      assets/
  ingresso-e2e/

  portal/                 → Portal público (editais, resultados)
    src/
      app/
        pages/            → Páginas estáticas e de consulta
        core/
      environments/
      assets/
  portal-e2e/

libs/
  shared-ui/              → Componentes PrimeNG reutilizáveis
    src/lib/
      components/         → Botões, tabelas, modais, formulários
      directives/
      pipes/

  shared-auth/            → Integração Keycloak/Gov.br
    src/lib/
      services/           → AuthService, TokenInterceptor
      guards/             → AuthGuard, RoleGuard
      models/             → UserProfile, AuthConfig

  shared-data/            → Clients TypeScript gerados do OpenAPI
    src/lib/
      api/                → Clients gerados (NSwag/Kiota)
      models/             → DTOs tipados
      services/           → Wrappers com cache e error handling
```

### Apps vs Libs

| Tipo | Regra |
|---|---|
| **App** | Contém roteamento, layout e composição de features. Não exporta nada. |
| **Lib** | Exporta componentes, services e modelos. Nunca tem roteamento próprio. |

---

## Fluxo de trabalho

### 1. Criar branch

> **Regra de ouro:** sem issue, sem código. Toda mudança não-trivial deve ter issue vinculada no GitHub antes de criar a branch.

```bash
git checkout main
git pull --rebase origin main
git checkout -b feature/{issue-number}-{slug}
```

**Convenção de nomes:**

| Prefixo | Quando usar |
|---|---|
| `feature/` | Nova funcionalidade ou componente |
| `fix/` | Correção de bug |
| `refactor/` | Refatoração sem mudança de comportamento |
| `test/` | Adição ou correção de testes |
| `chore/` | Configuração, dependências, CI/CD |
| `style/` | Ajustes visuais (CSS, layout, responsividade) |

### 2. Implementar

Verifique qual app ou lib será afetada:

```bash
# Verificar o que foi afetado pelas mudanças
npx nx affected --target=build
```

### 3. Testar

```bash
# Lint (todas as apps afetadas)
npx nx affected --target=lint

# Testes unitários (todas as apps afetadas)
npx nx affected --target=test

# Testes E2E (app específica)
npx nx e2e selecao-e2e

# Build de produção (verificar que compila)
npx nx affected --target=build --configuration=production
```

Todos os comandos acima devem passar antes de abrir o PR.

#### Estratégia de lint em três camadas

O lint é checado em três pontos distintos, do mais rápido ao mais abrangente, para evitar acúmulo silencioso de débito em projetos não-afetados:

| Camada | Quando roda | O que executa | Bloqueante? |
|---|---|---|---|
| **Pre-commit local** | Em cada `git commit` | `lint-staged` → `eslint --fix` apenas nos arquivos staged | Sim (impede commit) |
| **CI rápido (afetado)** | Em cada push da PR | `npx nx affected --target=lint` (rode localmente antes do push) | Recomendado |
| **CI completo (`lint-full.yml`)** | Em cada PR e push para `main` | `npx nx run-many --target=lint --all` | Sim (gate de merge) |

O hook de pre-commit é configurado via `husky` (`.husky/pre-commit`) e roda automaticamente após `npm install`. Em casos excepcionais, pode-se contornar com `git commit --no-verify` — mas a CI rejeitará o PR se o lint completo falhar.

A regra de aceite: **`npx nx run-many --target=lint --all` deve sair com código 0**. Warnings são tolerados; errors bloqueiam o merge.

### 4. Commit

As regras de formato, tipos permitidos e convenções gerais de mensagem estão definidas no **[Guia de Commits e Integração § 1–4](https://github.com/unifesspa-edu-br/uniplus-docs/blob/main/docs/guia-commits-e-integracao.md)**. Siga-o na íntegra.

**Escopos válidos neste repositório:**

| Escopo | Quando usar |
|---|---|
| `selecao` | App Seleção (`apps/selecao/`) |
| `ingresso` | App Ingresso (`apps/ingresso/`) |
| `portal` | App Portal público (`apps/portal/`) |
| `shared-ui` | Componentes reutilizáveis PrimeNG (`libs/shared-ui/`) |
| `shared-data` | API clients, DTOs, utilitários (`libs/shared-data/`) |
| `shared-utils` | Utilitários puros, pipes, helpers (`libs/shared-utils/`) |
| `govbr` | Tokens Gov.br DS, mapeamento CSS → Tailwind @theme |
| `primeng` | PassThrough, configuração PrimeNG unstyled |
| `auth` | Keycloak, `libs/shared-auth/` (guards, interceptor, tokens) |
| `nx` | Configuração Nx (workspace, targets, caching, affected) |
| `ci` | GitHub Actions, workflows, pipeline |
| `docker` | Dockerfiles, `docker-compose` |
| `deps` | Atualização de pacotes npm |
| `e2e` | Testes E2E Playwright (`apps/*-e2e/`) |

Para o Nx monorepo, prefira o nome da **app** ou **lib** afetada. Mudanças transversais (ex.: tokens Gov.br, estilo global) usam `govbr` ou `shared-ui`.

**Alguns exemplos canônicos:**

```
feat(selecao): adiciona formulário de inscrição multi-etapa
fix(auth): corrige refresh token expirado sem redirect
refactor(shared-ui): extrai componente InputCpf para lib compartilhada
style(govbr): ajusta tokens de espaçamento para e-MAG 3.1
test(e2e): adiciona testes do fluxo de inscrição no portal
chore(deps): atualiza PrimeNG para 21.x
```

Para uma bateria completa de exemplos (bons e ruins, com justificativas), consulte [Guia § 4](https://github.com/unifesspa-edu-br/uniplus-docs/blob/main/docs/guia-commits-e-integracao.md).

### 5. Rebase sobre `main`

Integração via **rebase** — sem merge commits poluindo o histórico. Procedimento completo e regras de ouro em **[Guia de Commits e Integração § 5–6](https://github.com/unifesspa-edu-br/uniplus-docs/blob/main/docs/guia-commits-e-integracao.md)**.

Resumo aplicado ao `uniplus-web`: mantenha a branch rebaseada sobre `origin/main`, organize os commits com `rebase -i` (squash/reword/drop) antes do PR e use `git push --force-with-lease` ao reescrever história — nunca `--force` puro.

### 6. Pull Request

```bash
git push -u origin feature/{issue-number}-{slug}

# Criar PR (Closes #N na descrição fecha a issue automaticamente no merge)
gh pr create --base main
```

---

## Padrões de código

### Organização de features (por app)

Cada feature é um **módulo Angular lazy-loaded** com estrutura padrão:

```
features/
  inscricao/
    components/           → Componentes visuais da feature
      formulario-inscricao/
      resumo-inscricao/
    services/             → Services específicos da feature
    models/               → Interfaces e tipos locais
    inscricao.routes.ts   → Rotas da feature
    inscricao.component.ts→ Componente raiz da feature
```

### Componentes

| Regra | Detalhe |
|---|---|
| Um componente, uma responsabilidade | Componentes grandes devem ser decompostos |
| Inputs e Outputs tipados | Usar `input()` e `output()` signals do Angular 20 |
| OnPush por padrão | `changeDetection: ChangeDetectionStrategy.OnPush` |
| Standalone components | Não usar NgModules — tudo standalone |

### State management

- **Estado global:** NgRx SignalStore para estado compartilhado entre features
- **Estado local:** Signals do Angular para estado de componente
- **Estado de servidor:** Services com cache via `shareReplay` ou integração com shared-data

### Formulários

- Usar **Reactive Forms** para formulários complexos (inscrição, homologação)
- Validações no formulário devem espelhar as validações da API
- Formulários multi-etapa devem salvar progresso no estado local (draft)
- Nunca desabilitar o botão de submit sem feedback visual ao usuário

### Naming

| Elemento | Convenção | Exemplo |
|---|---|---|
| Componentes | kebab-case (seletor) | `app-formulario-inscricao` |
| Arquivos | kebab-case | `formulario-inscricao.component.ts` |
| Classes | PascalCase (inglês) | `FormularioInscricaoComponent` |
| Services | PascalCase + `Service` | `InscricaoService` |
| Interfaces/Models | PascalCase | `Candidato`, `InscricaoDto` |
| Variáveis | camelCase (inglês) | `candidatoId`, `listaInscricoes` |
| Strings user-facing | pt-BR | `'Inscrição realizada com sucesso'` |
| Labels, placeholders, mensagens | pt-BR | `'Digite seu CPF'` |

### CSS / Tailwind

- **PrimeNG** para componentes complexos (tabelas, calendários, modais, menus)
- **Tailwind CSS** para layout e utilitários (spacing, flex, grid, responsividade)
- Nunca usar `!important` — ajustar especificidade ou usar variáveis CSS do PrimeNG
- Mobile-first: começar pelo layout mobile, expandir com `md:` e `lg:`
- Cores institucionais devem usar variáveis CSS definidas em `shared-ui`

---

## Acessibilidade (WCAG 2.1 AA)

**Obrigatório em toda contribuição.** O sistema é de uma universidade federal — acessibilidade é exigência legal (Lei 13.146/2015).

| Regra | Detalhe |
|---|---|
| Labels em todos os inputs | `<label for="...">` ou `aria-label` |
| Navegação por teclado | Todo elemento interativo acessível via Tab |
| Contraste de cores | Mínimo 4.5:1 para texto normal, 3:1 para texto grande |
| Mensagens de erro | Associadas ao campo via `aria-describedby` |
| Imagens | Atributo `alt` descritivo ou `role="presentation"` |
| Modais | Focus trap ativo, fechamento via Esc |
| Loading states | `aria-busy="true"` e `aria-live="polite"` para anúncios |

### Verificação

```bash
# axe-core integrado ao Playwright (roda nos testes E2E)
npx nx e2e selecao-e2e -- --grep "accessibility"
```

---

## Segurança

### Obrigatório em toda contribuição

- **Nunca exibir CPF completo** em telas — usar máscara `***.***.***-XX`
- **Nunca logar dados pessoais** no console do navegador
- **XSS:** nunca usar `[innerHTML]` com dados do usuário — usar sanitização do Angular
- **Tokens:** nunca armazenar tokens em localStorage — usar httpOnly cookies via Keycloak
- **Upload:** validar tipo de arquivo, tamanho máximo e exibir preview antes de enviar

### Nome social (RN02)

Em qualquer tela que exiba nome de candidato, verificar se existe nome social cadastrado. Se existir, exibir **apenas o nome social** — nunca o nome civil junto.

---

## Testes

### Obrigatório

| Tipo | Onde | Framework | Quando |
|---|---|---|---|
| Unitário | Components, Services, Pipes | Jest + Angular Testing Library | Toda lógica de componente e service |
| E2E | Fluxos completos | Playwright | Todo fluxo crítico do usuário |

### Recomendado

| Tipo | Onde | Framework | Quando |
|---|---|---|---|
| Acessibilidade | Páginas completas | axe-core + Playwright | Toda nova página |
| Visual regression | Componentes UI | Playwright screenshots | Mudanças em shared-ui |

### Convenções de teste

**Testes unitários (Jest):**

```typescript
// formulario-inscricao.component.spec.ts
describe('FormularioInscricaoComponent', () => {
  it('deve bloquear submit quando CPF é inválido', () => {
    // Arrange
    const { getByRole, getByLabelText } = render(FormularioInscricaoComponent);

    // Act
    fireEvent.input(getByLabelText('CPF'), { target: { value: '000.000.000-00' } });

    // Assert
    expect(getByRole('button', { name: /enviar/i })).toBeDisabled();
  });
});
```

**Testes E2E (Playwright):**

```typescript
// inscricao.spec.ts
test('candidato deve conseguir completar inscrição', async ({ page }) => {
  await page.goto('/inscricao');
  await page.getByLabel('CPF').fill('123.456.789-09');
  await page.getByLabel('Nome completo').fill('Maria da Silva');
  // ...
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();
  await expect(page.getByText('Inscrição realizada com sucesso')).toBeVisible();
});
```

- Usar **dados fictícios** — nunca dados reais de candidatos
- Testes E2E devem rodar **sem navegador visível** (headless) no CI
- Testes unitários devem rodar **sem dependência de browser**

---

## Quality gates

O PR será bloqueado se qualquer gate falhar:

- [ ] Build de produção sem erros (`nx build {app} --configuration=production`)
- [ ] Lint sem erros no workspace inteiro (`nx run-many --target=lint --all` — gate `lint-full.yml`)
- [ ] Todos os testes unitários passando
- [ ] Todos os testes E2E passando
- [ ] Testes de acessibilidade passando (axe-core)
- [ ] Nenhuma vulnerabilidade crítica em dependências (`npm audit`)

---

## Checklist antes de pedir merge

Complementa os Quality gates acima (verificações de CI automáticas) com higiene de commits e branch — essas são verificações humanas:

- [ ] Branch no padrão (`feature/{issue}-{slug}`, `fix/{issue}-{slug}`, `chore/{slug}`, `style/{slug}` ou `docs/{slug}`)
- [ ] Issue vinculada no GitHub (regra de ouro: sem issue, sem código)
- [ ] Todos os commits seguem Conventional Commits em pt-BR
- [ ] Verbo no **imperativo presente** (`adiciona`, `corrige`, `remove`, `atualiza`) — nunca infinitivo (`adicionar`) nem gerúndio (`Adicionando`)
- [ ] Subject em minúsculas, sem ponto final, máx. ~72 caracteres
- [ ] Escopo presente (do conjunto definido em [§ Commit](#4-commit)) quando aplicável
- [ ] Branch **rebaseada** sobre a `main` mais recente
- [ ] Commits "WIP" / "ajustes do PR" foram **squashados** via `git rebase -i`
- [ ] PR vinculado à issue com `Closes #N` na descrição

---

## Revisão de código

Todo PR passa por revisão humana. O revisor verifica:

1. **Acessibilidade** — WCAG 2.1 AA, navegação por teclado, contraste
2. **Responsividade** — funciona em mobile, tablet e desktop
3. **Segurança** — PII masking, XSS, tokens
4. **Qualidade** — componentes pequenos, OnPush, sem lógica no template
5. **UX** — feedback ao usuário (loading, erros, sucesso), pt-BR correto

O PR precisa de **1 aprovação** para ser mergeado.

---

## Dúvidas

- Abra uma issue com a label `needs-refinement` para discutir abordagens
- Consulte a documentação em [uniplus-docs](https://github.com/unifesspa-edu-br/uniplus-docs) para contexto de requisitos e regras de negócio
- Consulte a API em [uniplus-api](https://github.com/unifesspa-edu-br/uniplus-api) para contratos e endpoints

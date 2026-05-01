---
status: "accepted"
date: "2026-05-01"
decision-makers:
  - "Tech Lead (CTIC)"
  - "P.O. CEPS"
  - "P.O. CRCA"
---

# ADR-0001: Separação em três aplicações frontend (Seleção, Ingresso, Portal)

## Contexto e enunciado do problema

O `uniplus-web` atende dois públicos com perfis de acesso completamente distintos: usuários internos (gestores, avaliadores, operadores) e candidatos externos. Além disso, o ciclo de vida do processo seletivo cobre duas fases operacionais conduzidas por setores diferentes da Unifesspa — Seleção (CEPS) e Ingresso (CRCA) — com cadências de release próprias.

Unificar todas as funcionalidades em um único bundle Angular implicaria entregar código administrativo a candidatos no browser, acoplar deploys entre setores e crescer continuamente o initial chunk conforme novas features fossem adicionadas a cada lado.

## Drivers da decisão

- Públicos com superfícies de funcionalidade disjuntas (gestores vs. candidatos).
- Setores donos diferentes (CEPS, CRCA) com prazos e janelas de release próprias.
- Necessidade de bundle inicial pequeno para o portal público (mobile-first, redes lentas).
- Princípio de mínimo privilégio: candidatos não devem receber código administrativo no browser.

## Opções consideradas

- Três aplicações Angular distintas em monorepo Nx, com bibliotecas compartilhadas.
- Aplicação única Angular com lazy loading e route guards por perfil.
- Duas aplicações (administrativa unificada + portal do candidato).

## Resultado da decisão

**Escolhida:** três aplicações Angular distintas no monorepo Nx — `selecao`, `ingresso` e `portal` — cada uma com seu próprio `app.config.ts`, layout, rotas e ciclo de deploy.

| Aplicação | Público                          | Setor responsável |
|-----------|----------------------------------|-------------------|
| selecao   | Gestores e avaliadores do CEPS   | CEPS              |
| ingresso  | Gestores do CRCA                 | CRCA              |
| portal    | Candidatos (acesso público)      | Plataforma        |

As três compartilham bibliotecas via path aliases (`@uniplus/shared-ui`, `@uniplus/shared-auth`, `@uniplus/shared-data`) mas são buildadas e deployadas independentemente. A separação física entre `apps/selecao`, `apps/ingresso` e `apps/portal` reflete os bounded contexts e isola as superfícies de exposição.

## Consequências

### Positivas

- Bundle inicial do portal público mantém-se enxuto — candidatos não recebem código administrativo.
- Deploys independentes — uma correção no portal não exige redeploy das aplicações administrativas.
- Ownership claro por setor (CEPS, CRCA, plataforma).
- Module boundaries do Nx impedem que apps administrativas vazem código sensível para o portal por importação acidental.

### Negativas

- Três Dockerfiles, três pipelines de build e três rotas de deploy.
- Configurações de bootstrap (interceptors, layout, providers) duplicadas em alguns pontos, mitigado pelas bibliotecas compartilhadas.
- Navegação entre apps requer redirecionamento entre origens distintas (não é SPA única).

### Neutras

- A separação é ortogonal à decisão de monorepo único versus repositórios separados (ver ADR-0003).

## Confirmação

- Module boundaries do Nx (regras de `@nx/enforce-module-boundaries` no ESLint) impedem dependências cruzadas indevidas entre `apps/`.
- Pipeline de CI usa `nx affected` para garantir que cada app compila e testa isoladamente.

## Mais informações

- ADR-0003 detalha a escolha do Nx como build system.
- **Origem:** revisão da ADR interna Uni+ ADR-003 (não publicada).

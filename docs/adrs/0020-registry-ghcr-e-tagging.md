---
status: "proposed"
date: "2026-05-08"
decision-makers:
  - "Tech Lead"
consulted:
  - "DevOps"
informed:
  - "Equipe `uniplus-web`"
---

# ADR-0020: GitHub Container Registry e estratégia de tagging das imagens da `uniplus-web`

## Contexto e enunciado do problema

A Fase 5 do plano de deploy (cluster standalone) está bloqueada porque as imagens dos três frontends (`uniplus-portal`, `uniplus-web-selecao`, `uniplus-web-ingresso`) ainda não são publicadas em um registry acessível pelo cluster. Os Dockerfiles existem (`docker/Dockerfile.portal`, `docker/Dockerfile.selecao`, `docker/Dockerfile.ingresso`) e o pipeline de lint/test/build/E2E já é verde via Nx Cloud — mas não há workflow de publish, não há convenção de naming nem política de tagging.

Diferentemente do backend, os frontends carregam configuração de runtime (URL do Keycloak, base URL da API) que **não pode** ficar embutida na imagem — a Story [#84](https://github.com/unifesspa-edu-br/uniplus-web/issues/84) define `provideAppInitializer` + `ConfigMap` do Kubernetes como ponto de injeção. A imagem distribuída precisa ser idêntica em todos os ambientes; só o `ConfigMap` muda. Adicionalmente, os Dockerfiles atuais têm dívida de hardening ([#4](https://github.com/unifesspa-edu-br/uniplus-web/issues/4)): rodam nginx como root e não têm os headers de segurança no nginx.conf — pré-requisito a ser resolvido antes ou junto do primeiro publish para evitar republicar tags 5 minutos depois.

A organização já valida GHCR como registry institucional (imagem composta `ghcr.io/unifesspa-edu-br/uniplus-keycloak:1.x`). A `uniplus-api` adota a mesma estratégia em ADR pareada (`ADR-0050` no `uniplus-api`). Manter o mesmo registry e a mesma convenção de tagging entre backend e frontend simplifica auditoria, scan de CVE e provisão de credenciais no ArgoCD.

## Drivers da decisão

- Destravar Fase 5 (deploy das 3 apps no cluster standalone)
- Paridade de registry e tagging com `uniplus-api` (auditoria e ArgoCD homogêneos)
- Imagem única por app + runtime config via `ConfigMap` ([#84](https://github.com/unifesspa-edu-br/uniplus-web/issues/84)) — nunca embutir URL de Keycloak/API
- Hardening de containers/nginx ([#4](https://github.com/unifesspa-edu-br/uniplus-web/issues/4)) aplicado antes ou no mesmo PR do primeiro publish
- Custo zero para registry de repositório público
- Login via `GITHUB_TOKEN`, sem PAT nem secret externo

## Opções consideradas

- **GHCR (`ghcr.io/unifesspa-edu-br/<imagem>`)** — registry institucional já validado, paridade com `uniplus-api`
- **Docker Hub (`unifesspa/<imagem>`)** — registry público externo
- **Registry interno Unifesspa** — registry on-prem hospedado em DC institucional

## Resultado da decisão

**Escolhida:** "GHCR (`ghcr.io/unifesspa-edu-br/<imagem>`)", porque é o registry já em produção na organização (imagem composta do Keycloak), tem paridade com a decisão simétrica em `uniplus-api/docs/adrs/0050-registry-ghcr-e-tagging.md`, autentica via `GITHUB_TOKEN` sem credencial extra e tem custo zero para repositórios públicos.

A convenção de naming distingue o portal dos demais: `ghcr.io/unifesspa-edu-br/uniplus-portal` (sem prefixo `web-` por ser o consumidor final público), `ghcr.io/unifesspa-edu-br/uniplus-web-selecao`, `ghcr.io/unifesspa-edu-br/uniplus-web-ingresso`.

**Trigger de publish:** o workflow só dispara em `push` de tag `v*` (ex.: `v0.1.0`). Push em `main` **não** publica imagem. Disciplina de release explícito — sem rolling tag mutável, sem ambiguidade sobre "qual é o estado atual de DEV". Devs de DEV usam `nx serve` (sem container) ou `docker compose` com build context. ArgoCD e Helm em qualquer ambiente sempre pinam um semver ou um sha — nunca um canal mutável.

**Tags publicadas para cada release `v<X>.<Y>.<Z>`:**

- `sha-<7-curto>` — identidade imutável do commit (sempre publicada)
- `v<X>.<Y>.<Z>` — release exata (imutável)
- `v<X>.<Y>` — pin de minor (rola com patches subsequentes)
- `v<X>` — pin de major (rola com minors+patches subsequentes)

Sem `latest` — convenção é dispensável quando `v<X>` já fornece soft-pinning automático. Sem `main` — nenhum consumidor produtivo deve apontar para um canal de branch.

Multi-arch limitado a `linux/amd64` neste momento.

A imagem **nunca** embute URL de Keycloak ou API. O nginx serve `/assets/runtime-config.json` lido por `provideAppInitializer` antes do bootstrap Angular ([#84](https://github.com/unifesspa-edu-br/uniplus-web/issues/84)); o `ConfigMap` do Kubernetes monta esse arquivo no path correto. O Dockerfile recebe `dist/apps/<app>` como build context (saída do `nx build`), aplica hardening (`nginxinc/nginx-unprivileged` ou `USER nginx` explícito, `server_tokens off`, headers HSTS/Permissions-Policy/CSP parametrizáveis) e expõe um `/health.json` estático para smoke pós-build.

SBOM e attestation cosign keyless via OIDC do GitHub ficam deferidos como follow-up — registrados em backlog mas fora do escopo de unblock.

## Consequências

### Positivas

- Fase 5 destrava com 1 workflow novo (`publish-images.yml`) consumindo GHCR já validado
- Mesma convenção de tagging do `uniplus-api`: ArgoCD, Trivy e auditoria de packages tratam ambos repositórios uniformemente
- Imagem única por app + runtime config via `ConfigMap` permite promover **a mesma tag** entre DEV, HML e PROD
- Adicionar/renomear app exige apenas append na matriz do workflow
- Sem credenciais externas: `GITHUB_TOKEN` com escopo `packages: write` resolve auth

### Negativas

- Acoplamento ao GitHub como registry (lock-in moderado, igual ao backend)
- Hardening ([#4](https://github.com/unifesspa-edu-br/uniplus-web/issues/4)) precisa ser aplicado no mesmo PR ou imediatamente antes — caso contrário o primeiro publish já carrega imagem insegura que precisará ser republicada
- Sem multi-arch ARM (workstations Apple Silicon usam `nx serve` local sem container, mitigando)

### Neutras

- Visibilidade pública das imagens espelha a do repositório (`uniplus-web` é público)
- Build assume Nx affected: PRs que não tocam apps específicas não republicam imagens dessas apps (economia, mas exige cuidado em refactors cross-app)

## Confirmação

Verificável por:

- Workflow `.github/workflows/publish-images.yml` presente, sem trigger em `push: branches`, apenas em `push: tags v*`
- `gh api /orgs/unifesspa-edu-br/packages?package_type=container --jq '.[].name'` lista `uniplus-portal`, `uniplus-web-selecao`, `uniplus-web-ingresso` após o primeiro `git tag v* && git push --tags`
- `docker pull ghcr.io/unifesspa-edu-br/uniplus-portal:v0.1.0` funciona sem auth (visibilidade pública)
- `docker pull ghcr.io/unifesspa-edu-br/uniplus-portal:main` falha com 404 — `main` **não** é tag publicada
- Tag de release `v0.1.0` produz simultaneamente `:v0.1.0`, `:v0.1`, `:v0` e `:sha-<7>`
- Container roda como UID não-root (`docker inspect` confirma `Config.User != ""`)
- `curl -s http://<container>/health.json` retorna 200 e JSON com `{"status":"ok"}`
- `curl -s -I http://<container>/` mostra `Server: nginx` (sem versão) e ausência de `X-Powered-By`
- Helm chart consome tag por `Values.image.tag` (semver explícito), sem hardcode e sem `latest`

## Prós e contras das opções

### GHCR

- Bom, porque já está em produção na organização (imagem composta `uniplus-keycloak`)
- Bom, porque tem paridade com a decisão simétrica em `uniplus-api`
- Bom, porque autentica via `GITHUB_TOKEN` sem PAT externo
- Bom, porque tem custo zero para repositórios públicos
- Ruim, porque acopla registry ao provedor de SCM (lock-in moderado)
- Ruim, porque cleanup de tags antigas exige Action externa

### Docker Hub

- Bom, porque é o registry público mais conhecido
- Ruim, porque exige conta institucional separada com credenciais fora do GitHub
- Ruim, porque rate limit anônimo de pull (100/6h) afeta cluster e devs locais
- Ruim, porque quebra paridade com `uniplus-api`

### Registry interno Unifesspa

- Bom, porque mantém imagens dentro da rede institucional
- Ruim, porque não existe ainda — bloqueia Fase 5 indefinidamente
- Ruim, porque cluster standalone ainda não tem conectividade configurada para registry on-prem

## Mais informações

- Story de implementação: a ser criada como sub-issue do Epic [#12](https://github.com/unifesspa-edu-br/uniplus-web/issues/12) (Fundação técnica do frontend)
- Hardening de containers/nginx: [#4](https://github.com/unifesspa-edu-br/uniplus-web/issues/4) — pré-requisito ou conjunto
- Runtime config via `ConfigMap`: [#84](https://github.com/unifesspa-edu-br/uniplus-web/issues/84)
- ADR pareada no backend: `uniplus-api/docs/adrs/0050-registry-ghcr-e-tagging.md`
- Identity provider OIDC: [ADR-0009](0009-keycloak-como-identity-provider-oidc.md)
- Origem: pré-requisito da Fase 5 do plano de deploy do cluster standalone (snapshot 2026-05-07)

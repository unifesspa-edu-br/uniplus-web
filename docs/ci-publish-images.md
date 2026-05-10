# CI — publicação das imagens das apps web

Este documento descreve o workflow `publish-images.yml` que publica as 3
imagens Docker das apps web (`uniplus-portal`, `uniplus-web-selecao`,
`uniplus-web-ingresso`) no GitHub Container Registry (GHCR), em conformidade
com a [ADR-0020](adrs/0020-registry-ghcr-e-tagging.md).

## Quando o workflow dispara

**Trigger único:** `push` de tag `v*` (ex.: `v0.1.0`, `v1.2.3`).

**Push em `main` não publica imagem.** A disciplina de release é explícita —
sem rolling tag mutável (`latest`, `main`), sem ambiguidade sobre "qual é o
estado atual de DEV". Devs em DEV usam `nx serve` ou `docker compose` com
build context. ArgoCD e Helm em qualquer ambiente sempre pinam um semver ou
um SHA — nunca um canal mutável.

## Tags publicadas

Para cada release `v<X>.<Y>.<Z>`:

| Tag | Significado |
|---|---|
| `sha-<7-curto>` | Identidade imutável do commit (sempre publicada) |
| `v<X>.<Y>.<Z>` | Release exata (imutável) |
| `v<X>.<Y>` | Pin de minor (rola com patches subsequentes) |
| `v<X>` | Pin de major (rola com minors+patches subsequentes) |

## Como cortar uma release

```bash
# 1. Garantir que main contém o commit a ser tagueado
git checkout main && git pull

# 2. Criar tag anotada apontando para o HEAD
git tag -a v0.1.0 -m "Release v0.1.0"

# 3. Push da tag
git push origin v0.1.0
```

O workflow valida que o commit da tag está em `origin/main` antes de buildar
(via `git merge-base --is-ancestor`). Tags em commits fora de main falham
imediatamente, sem consumir cache de build.

## Hardening aplicado às imagens (#4)

- Base `nginxinc/nginx-unprivileged:1.27-alpine` — escuta em `:8080` como
  UID 101, sem `CAP_NET_BIND_SERVICE`.
- `server_tokens off` para esconder versão do nginx.
- Headers de segurança: HSTS, X-Frame-Options, X-Content-Type-Options,
  X-XSS-Protection, Referrer-Policy, Permissions-Policy, Content-Security-Policy.
- `connect-src *` na CSP é necessário porque a URL real de Keycloak e API
  vem do `ConfigMap` em runtime ([#84](https://github.com/unifesspa-edu-br/uniplus-web/issues/84)),
  não embutida na imagem (invariante da [ADR-0020](adrs/0020-registry-ghcr-e-tagging.md)).

## Smoke test pós-build

Antes de publicar a tag, o workflow executa:

1. **Non-root check:** `docker inspect Config.User != '' && != 'root' && != '0'`.
2. **`/health.json`:** `docker run` em background + `curl` com retry budget
   de 15s; valida resposta `200` com body `{"status":"ok"}`.

Falha em qualquer dos checks aborta o publish — a tag não fica visível no
GHCR. Smoke runtime do Angular (com runtime config real, Keycloak, API)
acontece no compose local ou em Helm/ArgoCD pós-publish.

## Pull público

Imagens são públicas (espelha a visibilidade do repositório). Pull anônimo:

```bash
docker pull ghcr.io/unifesspa-edu-br/uniplus-portal:v0.1.0
docker pull ghcr.io/unifesspa-edu-br/uniplus-web-selecao:v0.1.0
docker pull ghcr.io/unifesspa-edu-br/uniplus-web-ingresso:v0.1.0
```

## Como sair de "imagem publicada" para "rodando em cluster"

`publish-images.yml` **publica** a imagem no GHCR. **Não deploya.** A
fonte de verdade GitOps que decide qual versão roda em cada cluster é o
repositório [`unifesspa-edu-br/uniplus-infra`](https://github.com/unifesspa-edu-br/uniplus-infra).
O desacoplamento é deliberado — invariante registrado na
[ADR-0020](adrs/0020-registry-ghcr-e-tagging.md): a imagem é idêntica em
todos os ambientes; só o `ConfigMap` injetado em runtime
([#84](https://github.com/unifesspa-edu-br/uniplus-web/issues/84)) muda.

Fluxo completo entre tag e cluster (exemplo concreto `v0.1.2`):

| Etapa | Onde | Quem | Tempo típico |
|---|---|---|---|
| Tag git semver | `uniplus-web` | dev | < 1 min |
| Workflow `Publish Images` | `uniplus-web` Actions | CI | ~4 min |
| 3 imagens em GHCR | `ghcr.io/unifesspa-edu-br/uniplus-{portal,web-selecao,web-ingresso}` | CI | parte do anterior |
| PR de bump em `values.yaml` | `uniplus-infra/apps/uniplus-web/values.yaml` | dev/agente | ~1 min |
| Codex AI review + CI | `uniplus-infra` | bot | ~5 min |
| Merge do PR | `uniplus-infra` | dev | < 1 min |
| ArgoCD reconcile | cluster | argocd (auto, poll ~3 min) | até 3 min |
| Rolling restart dos pods | cluster | kubernetes | 1–2 min |
| **Total tag → servindo em prod** | — | — | **15–20 min** |

Snippet típico do PR de bump (`uniplus-infra`):

```diff
# apps/uniplus-web/values.yaml — repetir em cada um dos 3 apps:
    portal:
      image: uniplus-portal
-     tag: v0.1.1
+     tag: v0.1.2
```

### Por que o gate manual

- **Auditabilidade:** `git log` no `uniplus-infra` mostra exatamente quando
  cada versão entrou em produção, por quem e com qual revisão.
- **Rollback:** `git revert <commit-bump>` no `uniplus-infra` desfaz o
  deploy sem precisar tocar imagens nem registry.
- **Hotfix barato:** subir uma versão urgente custa um PR de ~10 linhas
  (bump da tag), revisado e CI-validado, em vez de deploy não testado.

### Quando automatizar

Quando releases passarem a acontecer várias vezes por dia, vale plugar
[`argocd-image-updater`](https://argocd-image-updater.readthedocs.io/) ou
Renovate — ambos **abrem o PR de bump automaticamente** ao detectar nova
tag no GHCR, mas o merge continua passando por CI + Codex + revisão
humana. Hoje (2026-05) o volume de releases não justifica a automação;
fica registrado como follow-up.

## Follow-ups deferidos

- **SBOM e attestation cosign keyless via OIDC** — registrados em backlog,
  fora do escopo do unblock atual.
- **Multi-arch ARM** — workstations Apple Silicon usam `nx serve` local.
- **Cleanup de tags antigas** — issue separada com Action externa.
- **Trivy scan** — pode plugar como gate em PR posterior sem alterar este
  workflow estruturalmente.

---
status: "accepted"
date: "2026-07-15"
decision-makers:
  - "Tech Lead"
consulted:
  - "DevOps"
informed:
  - "Apps portal, selecao, ingresso e configuracao"
---

# ADR-0028: `base href` parametrizado em runtime pelo container Nginx

## Contexto e enunciado do problema

A Feature #444 prepara as SPAs Angular para operar tanto na raiz do host quanto sob paths como `/portal/`, `/selecao/` e `/ingresso/`, sem `StripPrefix` no Traefik. A story #445 adotou `baseHref: "./"` no build para preservar a imagem única por app da ADR-0020. Essa solução só foi validada na raiz do subpath: em um hard reload para uma rota com dois ou mais segmentos, a resolução padrão de URL trata o último segmento como arquivo. Assim, em `/selecao/inscricoes/123`, `./` passa a apontar para `/selecao/inscricoes/`, e não para `/selecao/`.

O defeito foi reproduzido pela suíte de `configuracao` durante a story #446 e está registrado em #462. O fallback de SPA sozinho não o elimina: ele devolve o `index.html`, mas a URL profunda do documento continua sendo a base usada pelo navegador para resolver assets e chunks.

Além do HTML, o Nginx recebe do Traefik o path completo — não há `StripPrefix`. Portanto, uma requisição como `/selecao/assets/main.js` precisa ser mapeada internamente para o arquivo físico `/assets/main.js`, preservando o prefixo na URL pública.

## Drivers da decisão

- Corrigir hard reload e deep links de qualquer profundidade sob subpath.
- Preservar a imagem única por app entre standalone-compact, lab e HML, conforme ADR-0020 e ADR-0021.
- Não embutir o prefixo de um ambiente no bundle Angular.
- Manter `runtime-config.json`, silent SSO, assets versionados e healthcheck coerentes sob raiz e subpath.
- Tornar a regressão reproduzível localmente sem backend, OIDC ou cluster.

## Opções consideradas

- **A. Manter `baseHref: "./"` no build e ampliar somente o fallback de SPA** — mantém o bundle único, mas não muda a regra de resolução relativa do navegador após hard reload; não corrige #462.
- **B. Gerar uma imagem por ambiente com `baseHref` absoluto** — funciona tecnicamente, mas viola o invariante de imagem única e exige rebuild para promover o mesmo release entre ambientes.
- **C. Configurar um `base href` absoluto em runtime no Nginx** — o bundle permanece com `<base href="/">`; o container injeta a base de montagem e remove o prefixo apenas para servir os arquivos locais.

## Resultado da decisão

**Escolhida:** "C. Configurar um `base href` absoluto em runtime no Nginx", porque corrige a semântica de URL em rotas profundas sem tornar a imagem dependente do ambiente.

Os builds de `portal`, `selecao` e `ingresso` deixam de definir `baseHref: "./"`, voltando a emitir `<base href="/">`. O template Nginx recebe `APP_BASE_HREF`, cujo valor válido é `/` ou um caminho absoluto terminado em barra, como `/selecao/`. O valor padrão da imagem é `/`; assim, standalone-compact e lab não exigem configuração adicional.

Na inicialização, o entrypoint oficial `envsubst` gera a configuração Nginx com esse valor. O Nginx substitui a tag `<base href="/">` da resposta HTML, redireciona o subpath sem barra final para a forma canônica e remove internamente o prefixo ao procurar `index.html`, `assets/runtime-config.json`, silent SSO e assets versionados. A URL exibida pelo navegador não é reescrita. Logo, um documento carregado em `/selecao/inscricoes/123` recebe a base absoluta `/selecao/`, e os chunks são buscados em `/selecao/assets/...`.

O chart `uniplus-infra` continua responsável por fornecer o valor efetivo: quando `pathPrefix` é vazio, `APP_BASE_HREF=/`; quando for `/portal`, deve injetar `APP_BASE_HREF=/portal/`. Essa alteração é parte da story `uniplus-infra#448`; este repositório não codifica paths de ambiente.

## Consequências

### Positivas

- Deep links com dois ou mais segmentos funcionam porque a base é absoluta e independente da URL atual.
- A mesma imagem pode ser promovida entre raiz e subpath sem rebuild.
- Traefik continua sem `StripPrefix`; o mapeamento para o filesystem é encapsulado no container que conhece seu mount point.
- A validação local cobre raiz e os quatro apps sob subpath, incluindo uma rota aninhada e o carregamento de assets e runtime config.

### Negativas

- O container passa a depender dos scripts de template da imagem oficial Nginx; a versão é pinada e o teste de regressão executa a mesma imagem.
- A ativação em HML exige a alteração coordenada no chart do `uniplus-infra`; publicar somente esta mudança ainda mantém o valor padrão `/`.

### Neutras

- `APP_BASE_HREF` não contém URLs de API, segredos nem parâmetros OIDC; esses continuam no `runtime-config.json` montado por ConfigMap.
- `configuracao` recebe a mesma capacidade e cobertura de regressão, embora os paths públicos planejados da Feature #444 sejam portal, seleção e ingresso.

## Confirmação

`bash tools/test-nginx-base-href.sh` inicia a imagem `nginxinc/nginx-unprivileged:1.27-alpine` com o template real, para cada base `/`, `/portal/`, `/selecao/`, `/ingresso/` e `/configuracao/`. Para cada cenário, o teste faz hard reload em `rota/aninhada`, verifica o `<base href>` absoluto retornado, confirma o redirecionamento da forma sem barra e busca assets e `runtime-config.json` através do mesmo prefixo.

## Mais informações

- Issue #462 — defeito de `baseHref: "./"` em navegação direta para rota profunda.
- Feature #444 e story #445 — subpath Angular; a decisão original foi implementada pelo PR #460.
- PR #461 — resolução de runtime config, silent SSO e VLibras com `document.baseURI`; identificou #462.
- Story `uniplus-infra#448` — parametrização do Nginx/chart por subpath.
- ADR-0020 e ADR-0021 — invariante de imagem única e configuração de runtime.

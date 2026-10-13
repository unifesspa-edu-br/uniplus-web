# Modelo de rolagem dos shells

Descreve quem rola em cada shell do `uniplus-web` e o que muda em janela baixa
ou com zoom alto. Contexto: issue #1100.

## Princípio comum

Os dois shells travam a altura no viewport dinâmico (`100dvh`) e fazem a rolagem
acontecer numa região interna, nunca no `<body>`. A faixa institucional, o topo e
a navegação ficam sempre visíveis por **layout flex**, não por `position: sticky`
ou `fixed`.

## Shell do portal (`ptl-portal-shell`)

Arquivos: `apps/portal/src/app/layout/portal-shell.{ts,css}`.

| Condição                | Quem rola                        | Cabeçalho                 |
| ----------------------- | -------------------------------- | ------------------------- |
| Altura útil **> 500px** | `.portal-scroll` (main + rodapé) | Sempre visível            |
| Altura útil **≤ 500px** | O documento (`<html>`)           | Rola junto com o conteúdo |

"Cabeçalho" = faixa institucional + topo + navegação por abas.

Abaixo de 500px (`@media (max-height: 500px)`), o host passa a `height: auto` e
`.portal-scroll` a `overflow: visible`. O `ui-back-to-top` passa a observar o
`<html>` em vez de `.portal-scroll` (sinal `rolaPelaPagina`, via `matchMedia` com o
mesmo limiar do CSS).

Na impressão (`@media print`) o host e `.portal-scroll` voltam ao fluxo normal
(`height: auto`, `overflow: visible`) e só o conteúdo vai para o papel; o
cabeçalho, a navegação, o rodapé e os controles flutuantes saem por `.u-no-print`.

Motivação: em 720x465 (zoom 200%) o cabeçalho ocupava 152 de 465px; em 320x256
(WCAG 1.4.10, zoom 400%), 203px, sobrando 53px para o conteúdo. O limiar de 500px
cobre ambos os casos de referência. Mudá-lo exige alterar o CSS e a constante
`ALTURA_JANELA_BAIXA` em conjunto.

## Shell administrativo (`ui-app-shell`)

Arquivos: `libs/shared-ui/src/lib/components/app-shell/app-shell.ts` e
`libs/shared-ui/src/styles/components.css` (`.ui-app-shell`, `.admin-main`, `.page`).

| Região                   | Rolagem                                           |
| ------------------------ | ------------------------------------------------- |
| `main.page`              | Único contêiner de rolagem vertical do conteúdo   |
| `.sidebar nav` (≥1024px) | Rola de forma independente quando excede a altura |
| Drawer (<1024px)         | Rola por dentro, sem mover o fundo                |

A topbar (`.admin-topbar`) e a faixa institucional permanecem fixas em qualquer
altura: **não há** regra de janela baixa neste shell. Se o mesmo problema for
confirmado nele, aplicar a mesma abordagem do portal.

## Verificação

Validar 320x256, 720x465, teclado, foco visível e o botão "Voltar ao topo" nos
três temas.

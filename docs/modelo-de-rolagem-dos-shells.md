# Modelo de rolagem dos shells

Descreve quem rola em cada shell do `uniplus-web` e o que muda em janela baixa
ou com zoom alto. Contexto: issue #1100.

## Princípio comum

Os dois shells ficam travados no viewport dinâmico (`100dvh`) e fazem a rolagem
acontecer numa região interna, nunca no `<body>`. No portal, quem trava é o
`ptl-root` (`apps/portal/src/styles.css`) e o shell ocupa o espaço que sobra, de modo
que um aviso acima dele, como o de autenticação indisponível, não cria uma segunda
rolagem. A faixa institucional, o topo e
a navegação ficam sempre visíveis por **layout flex**, não por `position: sticky`
ou `fixed`. A única exceção é o portal em janela baixa (≤ 500px de altura), em que
a página inteira rola — ver a seção do shell do portal.

## Shell do portal (`ptl-portal-shell`)

Arquivos: `apps/portal/src/app/layout/portal-shell.{ts,css}`.

| Condição                | Quem rola                        | Cabeçalho                 |
| ----------------------- | -------------------------------- | ------------------------- |
| Altura útil **> 500px** | `.portal-scroll` (main + rodapé) | Sempre visível            |
| Altura útil **≤ 500px** | O documento (`<html>`)           | Rola junto com o conteúdo |

"Cabeçalho" = faixa institucional + topo + navegação por abas.

Abaixo de 500px (`@media (max-height: 500px)`), o host passa a `height: auto` e,
junto com `.portal-scroll`, libera o eixo y (`overflow-y: visible`); `.portal-scroll` passa a `flex: 1 0 auto`,
para o rodapé ficar no fim da tela em página curta. O eixo x segue cortado com
`overflow-x: clip`: sem isso, o transbordo horizontal de um filho largo viraria
rolagem horizontal da página a 320px, a regressão de reflow que a WCAG 1.4.10
proíbe (`clip`, e não `hidden`, para não criar um contêiner de rolagem). O `ui-back-to-top` passa a observar o
`<html>` em vez de `.portal-scroll` (sinal `rolaPelaPagina`, via `matchMedia` com o
mesmo limiar do CSS). Como o `<html>` não tem `tabindex`, o foco do botão continua
indo para `.portal-scroll` (`focoAoTopo`), que tem `tabindex="-1"` nos dois modos.
Limitação conhecida: ao cruzar o limiar com a janela aberta (zoom ou redimensionamento),
a posição de leitura pode voltar ao topo.

Na impressão (`@media print`) o `ptl-root`, o host e `.portal-scroll` voltam ao fluxo normal
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

Validar 320x256 e 720x465 (zoom de 200% e de 400%), teclado, foco visível e o
botão "Voltar ao topo" nos três temas (claro, escuro e contraste) e também com a
fonte legível (`data-font-mode="legible"`), que muda a altura do cabeçalho.

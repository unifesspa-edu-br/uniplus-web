---
status: "accepted"
date: "2026-11-17"
decision-makers:
  - "Tech Lead (CTIC)"
consulted:
  - "Equipe Uni+"
informed:
  - "Apps selecao, ingresso, portal e configuracao"
---

# ADR-0031: Recusa da API junto ao campo, com código e página do erro

## Contexto e enunciado do problema

Quando a API recusa um campo, a tela precisa mostrar a recusa junto ao campo, com o código do erro e a
página que o explica, para a pessoa entender o motivo e saber a quem recorrer. A lista `errors[]` do
problema traz, por campo, só `field`, `code` e `message`: não traz o endereço da página. Hoje cada tela
mostra só o texto da mensagem, sem o código e sem a página.

O `uniplus-ds` está desatualizado. Por decisão do Tech Lead, a regra visual nova nasce no `shared-ui`,
depois de comparada com ele, e é documentada aqui. Esta decisão não emenda a
[ADR-0023](0023-uniplus-ds-como-contrato-visual-vigente.md).

## Drivers da decisão

- A mesma resposta em todas as telas e para todas as pessoas, com leitor de tela e teclado.
- Uma única fonte para o endereço das páginas de erro.
- O `shared-ui` não conhece domínio ([ADR-0030](0030-lib-de-apresentacao-do-dominio-da-inscricao.md)).
- Um link só é seguro se não sair do servidor e da pasta que a API indicou.

## Opções consideradas

- Derivar a página do `type` do problema, sem configurar a base no web.
- Guardar a base das páginas no `runtime-config`.
- Fixar a base das páginas numa constante do web.

## Resultado da decisão

**Escolhida:** "Derivar a página do `type` do problema", porque a API monta o `type` como a base das
páginas mais o código, e assim o web só lê o que ela já informa.

A página de cada recusa sai da base do `type` somada ao código da recusa. Só vale endereço `https:`
cujo último segmento seja o código do problema, e a página fica no mesmo servidor e na mesma pasta do
`type`. `type` em URN, ou que o cliente montou sozinho, não gera link: a recusa aparece só com a
mensagem e o código.

O bloco `ui-recusa-do-campo`, no `shared-ui` e sem dependência de domínio, mostra cada recusa com uma
mensagem, o código e o link "Entenda a recusa", que abre em nova aba e avisa o leitor de tela. Um campo
pode ter várias recusas. Quem usa dá um `id` ao bloco e o liga ao campo por `aria-describedby`.

Só o cadastro de tipos de etapa adota o bloco agora; os demais cadastros adotam quando houver
requisito que o peça.

## Consequências

### Positivas

- Se a API trocar a base das páginas, o web acompanha sozinho, sem nova versão.
- Cada recusa mostra o código e a página, e o leitor de tela lê a mensagem e o código junto do campo.

### Negativas

- `type` em URN não mostra link, só a mensagem e o código.
- O campo com recusa não pode ficar dentro do `<label>`: o rótulo passa a ser um `<label for>` e o
  bloco da recusa fica ao lado do campo, ligado por `aria-describedby`.

## Confirmação

Os testes do `shared-ui` e do `shared-core` cobrem o bloco, a leitura do `type` e a verificação de
acessibilidade; a tela que adota o bloco repete a verificação com a recusa visível.

## Prós e contras das opções

### Derivar a página do `type` do problema

- Bom, porque há uma fonte só, a que a API já envia.
- Ruim, porque o `type` que não for `https:` não gera link.

### Base das páginas no `runtime-config`

- Bom, porque o endereço não depende do `type`.
- Ruim, porque são duas fontes para o mesmo endereço, que podem divergir.

### Base das páginas numa constante

- Bom, porque é simples.
- Ruim, porque fixa o servidor no código e quebra quando a API muda de lugar.

## Mais informações

- Complementa a [ADR-0017](0017-pattern-feature-page-container-presentational.md) e a
  [ADR-0030](0030-lib-de-apresentacao-do-dominio-da-inscricao.md); não as revoga.

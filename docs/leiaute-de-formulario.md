# Leiaute de formulário

Regra de como os campos de um formulário se distribuem nos apps do Uni+. Ela vale para todo formulário: drawer de cadastro, passo do assistente do processo seletivo, editor de formulário e tela dedicada.

A implementação é a classe `.form-grid` de `libs/shared-ui/src/styles/components.css`. Os apps não definem cópia própria.

## A regra

A distribuição é decidida pelo **espaço do próprio formulário**, não pela largura da tela. O mesmo formulário aparece num drawer de 480px, num cartão dentro de outro cartão ou numa coluna larga, e a largura da tela não diz quanto espaço ele tem.

1. **No máximo dois campos por linha**, dividindo a largura igualmente.
2. **O campo sozinho na linha ocupa a linha inteira.** Não é preciso marcar nada: um campo que sobra numa linha cresce até a borda.
3. **Um campo por linha quando não cabem dois de 16rem.** Vale para celular, drawer estreito ou cartão aninhado, qualquer que seja a tela.
4. **Ação dentro da grade não cresce:** o botão fica do tamanho do rótulo, alinhado à base dos campos.

## Modificadores

| Classe | Quando usar |
|---|---|
| `.form-grid__full` | No campo que pede a linha inteira mesmo tendo vizinho: descrição, ajuda, texto longo, área de texto. |
| `.form-grid--pair` | Na grade de um par correlato que deve ficar sempre lado a lado, mesmo em espaço estreito: mínimo e máximo, latitude e longitude. |
| `.form-grid--1col` | No formulário de poucos campos que deve ter um campo por linha mesmo em espaço largo. |

## Exemplos

Campos de mesmo peso, lado a lado quando cabem:

```html
<div class="form-grid">
  <div class="field">…Rótulo…</div>
  <div class="field">…Obrigatoriedade…</div>
  <div class="field form-grid__full">…Ajuda…</div>
</div>
```

Um campo sozinho seguido de um campo de linha inteira. O título ocupa a linha toda sem marcação:

```html
<div class="form-grid">
  <div class="field">…Título da seção…</div>
  <div class="field form-grid__full">…Descrição…</div>
</div>
```

## O que evitar

- **Grade por largura de tela** (`@media (min-width: …)` trocando o número de colunas do formulário). O formulário dentro de um drawer erra em tela larga.
- **`repeat(auto-fit, minmax(…, 1fr))` em formulário.** Com um item de linha inteira, as colunas continuam reservadas, e o campo sozinho fica com uma fração da largura.
- **Cópia da `.form-grid` no CSS do app.** Ela carrega depois do `shared-ui` e anula a regra.

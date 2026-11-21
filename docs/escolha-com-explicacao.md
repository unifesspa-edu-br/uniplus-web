# Escolha com explicação

Regra de como o Uni+ apresenta uma escolha entre opções em que cada opção precisa de uma explicação para a pessoa decidir. Ela vale para qualquer tela e qualquer vocabulário cujas opções a API entrega com rótulo e `descricao`.

A implementação é o componente `ui-escolha-com-explicacao`, em `libs/shared-ui/src/lib/components/escolha-com-explicacao/`, com o estilo em `libs/shared-ui/src/styles/components/60-escolha-com-explicacao.css`. Os apps não montam o grupo à mão nem copiam o estilo.

## A regra

1. **Um grupo de opções exclusivas, com legenda.** A legenda nomeia a escolha e termina com o texto de obrigatoriedade quando ele existe, por exemplo "(obrigatório)". O grupo é anunciado como obrigatório pelo `aria-required`.
2. **Cada opção mostra o rótulo e, abaixo dele, a explicação.** O leitor de tela lê a explicação como descrição da opção.
3. **Opção sem explicação fica só com o rótulo.** O componente não inventa texto.
4. **O texto vem da API.** A tela exibe o `rotulo` e a `descricao` que o vocabulário devolve, sem texto fixo por opção e sem ramificar por código de opção.
5. **Nada vem marcado por conta do sistema** quando a escolha é obrigatória e a pessoa ainda não escolheu: o valor vazio deixa o grupo sem opção marcada.
6. **O erro do campo aparece junto dele, e `aria-invalid` acompanha o erro visível.** O grupo e cada opção são marcados como inválidos enquanto há erro à vista: o erro local da tela (`erroLocal`) ou uma recusa da API que ainda vale, o mesmo critério do `ui-form-field`. A recusa que a pessoa já tocou por baixo fica à vista, com a nota que explica, e não marca o campo como inválido (ADR-0031).
7. **Cada recusa descreve só o elemento a que pertence.** A recusa que aponta uma opção (`opcao`, o código dela) descreve essa opção e mais nenhuma. O erro local e a recusa sem `opcao`, ou com uma `opcao` que não está na lista, são do campo inteiro e descrevem o grupo.
8. **Enquanto não há opção para escolher, um parágrafo diz por quê:** carregando, falhou ou lista vazia. Esse parágrafo é o alvo de foco do campo. A orientação de falha manda usar "Tentar de novo" no aviso do topo do passo, então pressupõe que a tela mostre esse aviso com essa ação.

## Como usar

O componente é controlado: `valor` diz qual opção está marcada e `escolhido` devolve o código da opção que a pessoa escolheu. Quem usa atualiza `valor`. Se não aceitar a escolha e mantiver `valor`, a marca da tela volta à opção de `valor` depois do desenho, e a tela nunca mostra uma opção diferente da que será enviada.

```html
<ui-escolha-com-explicacao
  prefixoDoId="processo-12-efeito"
  legenda="Efeito suspensivo"
  instrucao="Escolha o que acontece com o resultado enquanto o recurso é julgado."
  textoDeObrigatoriedade="(obrigatório)"
  [opcoes]="opcoes()"
  [valor]="efeito()"
  [situacao]="situacaoDasOpcoes()"
  [erroLocal]="erroDaEscolha()"
  [recusas]="recusasAtivas()"
  [recusasAConferir]="recusasAConferir()"
  notaDasRecusasAConferir="Você alterou esta parte depois desta recusa; ela será conferida de novo na próxima gravação."
  (escolhido)="efeito.set($event)"
/>
```

| Entrada                                        | Para que serve                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `prefixoDoId`                                  | Base dos identificadores e do `name` do grupo. Precisa ser única na página. |
| `legenda`                                      | Nome do grupo.                                                              |
| `instrucao`                                    | O que a pessoa precisa saber antes de escolher. Descreve todas as opções.   |
| `opcoes`                                       | Lista de `{codigo, rotulo, descricao?}`, na ordem em que a API entrega.     |
| `valor`                                        | Código da opção marcada; vazio quando nenhuma está.                         |
| `erroLocal`                                    | Erro que a própria tela achou na escolha. Nulo ou vazio quando não há.      |
| `recusas`                                      | Recusas que ainda valem, cada uma com `opcao` quando é de uma opção.        |
| `recusasAConferir` e `notaDasRecusasAConferir` | Recusas já tocadas pela pessoa (também com `opcao`) e a nota que diz isso.  |
| `textoDeObrigatoriedade`                       | Texto ao fim da legenda. Nulo quando a escolha não é obrigatória.           |
| `situacao`                                     | `carregando`, `falhou` ou `pronta`.                                         |
| `textoSemOpcoes`                               | O que o parágrafo de situação diz quando a lista chega vazia.               |

O método `focar()` leva o foco à opção marcada, à primeira opção ou, sem opção nenhuma, ao parágrafo de situação. Serve a quem precisa levar a pessoa ao campo depois de uma recusa.

## Identificadores

| Parte                 | Identificador                                    |
| --------------------- | ------------------------------------------------ |
| grupo                 | `${prefixoDoId}-grupo`                           |
| instrução             | `${prefixoDoId}-instrucao`                       |
| opção                 | `${prefixoDoId}-opcao-${codigo}`                 |
| explicação            | `${prefixoDoId}-explicacao-${codigo}`            |
| erro local            | `${prefixoDoId}-erro`                            |
| recusa                | `${prefixoDoId}-recusa-[${opcao}-]${codigo}`     |
| recusa a conferir     | `${prefixoDoId}-a-conferir-[${opcao}-]${codigo}` |
| nota das a conferir   | `${prefixoDoId}-nota-das-recusas-a-conferir`     |
| parágrafo de situação | `${prefixoDoId}-situacao`                        |

Cada opção é descrita, nesta ordem, pela instrução, pela própria explicação, pelas recusas dela, pelas recusas a conferir dela e, havendo alguma a conferir, pela nota, cada uma só quando existe. O grupo é descrito pelo erro local, pelas recusas do campo inteiro, pelas a conferir e pela nota. Recusas do mesmo código e dono ganham um número ao fim do identificador.

## Acessibilidade

- Grupo de opções nativo (`input type="radio"` com o mesmo `name`): o Tab entra no grupo, as setas trocam de opção e a barra de espaço marca, sem código de teclado próprio.
- O foco visível é o do Uni+ DS. O parágrafo de situação tem `tabindex="-1"`: recebe foco por código e não entra na ordem do Tab.
- Enquanto as opções carregam, o grupo fica com `aria-busy="true"`. Quando elas chegam e o foco estava no parágrafo de situação, o foco passa à opção marcada ou, sem nenhuma marcada, à primeira.
- O texto quebra linha e nunca trunca: cabe em 320 px sem rolagem horizontal. As cores vêm dos tokens do DS, que já têm tema escuro e contraste.
- Cada opção mede ao menos 44 px de altura.
- O anúncio de mudança de estado (por exemplo, o fim do carregamento) fica a cargo da região viva da tela que usa o componente; o componente não cria região viva.

## O que evitar

- **Texto de explicação escrito no app.** A explicação é dado do vocabulário.
- **Esconder a opção para limitar a escolha sem avisar.** Quando a tela retira uma opção, ela diz o motivo numa região de aviso.
- **Cópia das classes `.escolha*` no CSS do app.** O estilo vive no `shared-ui`.

import { Directive, ElementRef, afterEveryRender, inject, input } from '@angular/core';

/**
 * Faz um `<select>` exibir o valor que o rascunho guarda.
 *
 * `[value]` num `<select>` não seleciona a `option` correspondente: o valor é
 * atribuído ao elemento, e o navegador reconcilia para a primeira opção quando
 * as `option` são renderizadas no mesmo ciclo — inclusive as de um `@for` sobre
 * dados que chegam de uma API. Daí a sincronização acontecer depois do render,
 * com as `option` já no documento.
 *
 * Ponte até a conversão dos passos para Reactive Forms, onde `formControlName`
 * resolve isto por construção.
 */
@Directive({
  selector: 'select[selValor]',
  standalone: true,
})
export class SelectValorDirective {
  readonly selValor = input<string>('');

  private readonly elemento = inject<ElementRef<HTMLSelectElement>>(ElementRef);

  constructor() {
    afterEveryRender(() => {
      const select = this.elemento.nativeElement;
      const desejado = this.selValor();

      // Escrever a cada ciclo atropelaria a digitação do operador.
      if (select.value === desejado) return;

      // Valor fora do conjunto de opções fica sem efeito: exibir seleção que
      // não corresponde a nenhuma opção seria pior do que a primeira delas.
      if (Array.from(select.options).some((opcao) => opcao.value === desejado)) {
        select.value = desejado;
      }
    });
  }
}

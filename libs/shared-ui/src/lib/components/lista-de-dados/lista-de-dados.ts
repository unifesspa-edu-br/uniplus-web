import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, contentChildren, input } from '@angular/core';

import { DadoDirective } from './dado';
import { ValorApresentadoComponent } from './valor-apresentado';

export type UiVarianteDaListaDeDados = 'padrao' | 'destaque';

/**
 * Uma lista de dados lidos: o `dl` com um `<div><dt><dd>` por `<ng-template uiDado>` declarado dentro
 * dele. Com duas colunas, os pares ficam lado a lado a partir de 768 px; em `destaque`, os pares ficam
 * em linha e o valor sai grande, para o essencial de um documento, como o número e a situação.
 */
@Component({
  selector: 'ui-lista-de-dados',
  standalone: true,
  imports: [NgTemplateOutlet, ValorApresentadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl
      class="lista-de-dados"
      [class.lista-de-dados--duas-colunas]="colunas() === 2"
      [class.lista-de-dados--destaque]="variante() === 'destaque'"
    >
      @for (dado of dados(); track dado) {
        <div class="dado">
          <dt class="dado__rotulo">{{ dado.rotulo() }}</dt>
          <dd class="dado__valor">
            @if (dado.projetado()) {
              <ng-container *ngTemplateOutlet="dado.conteudo" />
            } @else {
              <ui-valor-apresentado
                [valor]="dado.valorDeclarado()"
                [seVazio]="dado.seVazio()"
                [ordenada]="dado.ordenada()"
              />
            }
          </dd>
        </div>
      }
    </dl>
  `,
})
export class ListaDeDadosComponent {
  readonly colunas = input<1 | 2>(1);
  readonly variante = input<UiVarianteDaListaDeDados>('padrao');

  protected readonly dados = contentChildren(DadoDirective);
}

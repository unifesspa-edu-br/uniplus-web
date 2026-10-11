import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/** O que um campo guarda, na forma em que chega do formulário ou do rascunho. */
export type UiValorEmConsulta = string | number | boolean | readonly string[] | null | undefined;

type Apresentacao =
  | { readonly forma: 'texto'; readonly texto: string }
  | { readonly forma: 'lista'; readonly itens: readonly string[] }
  | { readonly forma: 'vazio' };

const NUMERO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 });

function apresentar(valor: UiValorEmConsulta): Apresentacao {
  if (valor === null || valor === undefined) return { forma: 'vazio' };
  if (typeof valor === 'boolean') return { forma: 'texto', texto: valor ? 'Sim' : 'Não' };
  if (typeof valor === 'number') return { forma: 'texto', texto: NUMERO.format(valor) };
  if (typeof valor === 'string') {
    return valor.trim() === '' ? { forma: 'vazio' } : { forma: 'texto', texto: valor };
  }
  const itens = valor.filter((item) => item.trim() !== '');
  return itens.length === 0 ? { forma: 'vazio' } : { forma: 'lista', itens };
}

/**
 * Um valor lido, como texto: o booleano vira "Sim"/"Não", o número sai em pt-BR, a lista sai como
 * lista e o vazio diz que nada foi informado. É o único lugar que sabe apresentar o valor de um
 * campo em consulta; o `ui-lista-de-dados`, para cada `<ng-template uiDado>` com valor, e o
 * `ui-valor-em-consulta` o usam.
 */
@Component({
  selector: 'ui-valor-apresentado',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (apresentacao().forma) {
      @case ('lista') {
        @if (ordenada()) {
          <ol class="valor-apresentado__lista valor-apresentado__lista--ordenada">
            @for (item of itens(); track $index) {
              <li>{{ item }}</li>
            }
          </ol>
        } @else {
          <ul class="valor-apresentado__lista">
            @for (item of itens(); track $index) {
              <li>{{ item }}</li>
            }
          </ul>
        }
      }
      @case ('vazio') {
        <span class="valor-apresentado__vazio">{{ seVazio() }}</span>
      }
      @default {
        {{ texto() }}
      }
    }
  `,
})
export class ValorApresentadoComponent {
  readonly valor = input<UiValorEmConsulta>(null);
  /** O que se lê quando nada foi declarado. */
  readonly seVazio = input<string>('Não informado');
  /** A lista tem ordem que importa, como a de avaliação: numerada, e anunciada como tal. */
  readonly ordenada = input(false, { transform: booleanAttribute });

  protected readonly apresentacao = computed(() => apresentar(this.valor()));

  protected readonly texto = computed(() => {
    const atual = this.apresentacao();
    return atual.forma === 'texto' ? atual.texto : '';
  });

  protected readonly itens = computed(() => {
    const atual = this.apresentacao();
    return atual.forma === 'lista' ? atual.itens : [];
  });
}

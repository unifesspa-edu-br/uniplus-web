import { NgTemplateOutlet } from '@angular/common';
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
 * Um campo lido, não preenchido: o rótulo e o valor gravado, como texto.
 *
 * Em consulta, um controle desabilitado não serve de leitura: o cinza de desabilitado não
 * alcança o contraste de texto, o valor longo é cortado pela largura do campo e o select
 * mostra a opção só enquanto o catálogo dela está carregado. O texto quebra linha e nunca
 * trunca.
 *
 * O par fica numa lista de descrição (`<dt>`/`<dd>`), para o leitor de tela associar o valor
 * ao rótulo. Quando quem rotula é um título que já está na tela, `rotuladoPor` recebe o id
 * dele e só o valor é renderizado, sem repetir o rótulo.
 */
@Component({
  selector: 'ui-valor-em-consulta',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'valor-em-consulta' },
  template: `
    @if (rotuladoPor(); as id) {
      <div class="valor-em-consulta__valor" role="group" [attr.aria-labelledby]="id">
        <ng-container *ngTemplateOutlet="conteudo" />
      </div>
    } @else {
      <dl class="valor-em-consulta__par">
        <dt class="valor-em-consulta__rotulo">{{ rotulo() }}</dt>
        <dd class="valor-em-consulta__valor">
          <ng-container *ngTemplateOutlet="conteudo" />
        </dd>
      </dl>
    }
    @if (dica(); as texto) {
      <p class="field__hint">{{ texto }}</p>
    }

    <ng-template #conteudo>
      @switch (apresentacao().forma) {
        @case ('lista') {
          @if (ordenada()) {
            <ol class="valor-em-consulta__lista valor-em-consulta__lista--ordenada">
              @for (item of itens(); track $index) {
                <li>{{ item }}</li>
              }
            </ol>
          } @else {
            <ul class="valor-em-consulta__lista">
              @for (item of itens(); track $index) {
                <li>{{ item }}</li>
              }
            </ul>
          }
        }
        @case ('vazio') {
          <span class="valor-em-consulta__vazio">{{ seVazio() }}</span>
        }
        @default {
          {{ texto() }}
        }
      }
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
})
export class ValorEmConsultaComponent {
  /** O rótulo do campo, o mesmo que ele tem em edição. Ignorado com `rotuladoPor`. */
  readonly rotulo = input<string>('');
  readonly valor = input<UiValorEmConsulta>(null);
  /** Id do título que já rotula o valor na tela, como o de uma seção. */
  readonly rotuladoPor = input<string | null>(null);
  /** O que se lê quando nada foi declarado. */
  readonly seVazio = input<string>('Não informado');
  /** A lista tem ordem que importa, como a de avaliação: numerada, e anunciada como tal. */
  readonly ordenada = input(false, { transform: booleanAttribute });
  /** Contexto que ajuda a ler o valor; instrução de preenchimento não entra aqui. */
  readonly dica = input<string | null>(null);

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

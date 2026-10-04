import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';

import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import { type CondicaoEmClausula, type FatoEscolhivel } from '../editor-de-condicoes/condicoes-de-fatos';
import { problemaDoGrupoDeOpcoes, type OpcoesCondicionadas, type PredicadoNoWire } from './formulario-editavel';
import { paraPredicado, problemasDasCondicoes, recopiarSeMudouPorFora } from './predicado-em-edicao';

/**
 * Um grupo das opções permitidas de um campo de seleção: a condição sobre respostas anteriores em
 * que ele vale — sem condição, vale sempre — e os valores que ele oferece. Devolve o grupo inteiro a
 * cada mudança; guarda só as condições como o editor de condições as escreve, como o item faz.
 */
@Component({
  selector: 'ui-grupo-de-opcoes',
  standalone: true,
  imports: [EditorDeCondicoesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="editor-formulario__restricao" [attr.aria-describedby]="descricao()">
      <legend class="field__label">Grupo de opções {{ posicao() }}</legend>

      <ui-editor-de-condicoes
        legenda="Vale quando"
        textoSemCondicao="Vale sempre: estas opções são oferecidas qualquer que seja a resposta anterior."
        textoSemFatos="Nenhum campo anterior pode ser citado: o grupo vale sempre."
        [condicoes]="condicoes()"
        [fatos]="fatos()"
        [idBase]="idBase() + '-quando'"
        [disabled]="disabled()"
        [erros]="problemas()"
        (condicoesChange)="trocarCondicoes($event)"
      />

      <div class="editor-formulario__opcoes" role="group" [attr.aria-label]="'Valores que o grupo de opções ' + posicao() + ' oferece em ' + nomeDoCampo()">
        @for (valor of valores(); track valor) {
          <label class="checkbox">
            <input type="checkbox" [checked]="entrada().valores.includes(valor)" [disabled]="disabled()" (change)="alternarValor(valor)" />
            <span class="checkbox__box" aria-hidden="true"></span>
            {{ valor }}
          </label>
        }
      </div>

      @if (problema(); as texto) {
        <p class="field__error" [id]="idBase() + '-erro'">{{ texto }}</p>
      }
      @if (recusas().length > 0) {
        <ul class="editor-formulario__erros" [id]="idBase() + '-recusas'">
          @for (recusa of recusas(); track $index) {
            <li class="field__error">{{ recusa }}</li>
          }
        </ul>
      }

      @if (removivel()) {
        <button class="btn btn--tertiary btn--sm" type="button" [disabled]="disabled()" (click)="remover.emit()">
          Remover o grupo de opções {{ posicao() }}
        </button>
      }
    </fieldset>
  `,
})
export class GrupoDeOpcoesComponent {
  readonly entrada = input.required<OpcoesCondicionadas>();
  /** A posição do grupo na restrição, a partir de 1. */
  readonly posicao = input.required<number>();
  /** Os valores do domínio do campo: os que o grupo pode oferecer. */
  readonly valoresConhecidos = input<readonly string[]>([]);
  /** Os fatos que a condição pode citar: os anteriores ao campo, nunca o próprio. */
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  readonly nomeDoCampo = input.required<string>();
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);
  /** O último grupo não sai sozinho: as opções permitidas têm ao menos um — remove-se a restrição. */
  readonly removivel = input<boolean>(false);
  /** As recusas da API que apontam este grupo. */
  readonly recusas = input<readonly string[]>([]);

  readonly entradaChange = output<OpcoesCondicionadas>();
  readonly remover = output<void>();

  protected readonly condicoes = linkedSignal<PredicadoNoWire, readonly CondicaoEmClausula[]>({
    source: () => this.entrada().quando,
    computation: recopiarSeMudouPorFora,
  });

  protected readonly problemas = computed(() => problemasDasCondicoes(this.condicoes(), this.fatos()));
  protected readonly problema = computed(() => problemaDoGrupoDeOpcoes(this.entrada()));
  /** O valor gravado fora do domínio conhecido aparece também, para não sair sem ser visto. */
  protected readonly valores = computed(() => [
    ...this.valoresConhecidos(),
    ...this.entrada().valores.filter((valor) => !this.valoresConhecidos().includes(valor)),
  ]);
  protected readonly descricao = computed(() => {
    const ids = [this.problema() === null ? null : `${this.idBase()}-erro`, this.recusas().length > 0 ? `${this.idBase()}-recusas` : null];
    return ids.filter((id) => id !== null).join(' ') || null;
  });

  protected trocarCondicoes(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoes.set(condicoes);
    this.entradaChange.emit({ ...this.entrada(), quando: paraPredicado(condicoes) });
  }

  protected alternarValor(valor: string): void {
    const atual = this.entrada().valores;
    this.entradaChange.emit({ ...this.entrada(), valores: atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor] });
  }
}

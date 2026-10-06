import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CondicaoDeFatoComponent } from './condicao-de-fato';
import {
  clausulasDe,
  comClausulaEm,
  comCondicaoEm,
  comCondicaoTrocadaEm,
  semClausulaEm,
  semCondicaoEm,
  type CondicaoDeFato,
  type CondicaoEmClausula,
  type FatoEscolhivel,
} from './condicoes-de-fatos';

/**
 * O editor de um predicado sobre fatos do candidato em forma normal disjuntiva.
 *
 * As condições de uma mesma alternativa valem JUNTAS; alternativas diferentes são caminhos
 * independentes pelos quais o predicado passa a valer. É o que escreve "homem maior de
 * dezoito, salvo indígena" sem precisar de uma segunda regra.
 *
 * O componente não guarda estado: recebe a lista de condições e devolve a lista inteira a
 * cada mudança, já renumerada. `fatoDoRecorte` é o fato que outro controle da tela escreve
 * (a modalidade, no gatilho de documentos): o editor não o mostra, e o leva para toda
 * alternativa nova, porque o recorte vale para o predicado inteiro.
 *
 * Acessibilidade: o conjunto é um `fieldset` com legenda; cada alternativa é um grupo
 * nomeado quando há mais de uma; os rótulos, a navegação por teclado e o anúncio do que a
 * condição alcança e do erro vêm de `ui-condicao-de-fato`.
 */
@Component({
  selector: 'ui-editor-de-condicoes',
  standalone: true,
  imports: [CondicaoDeFatoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'editor-de-condicoes' },
  template: `
    <fieldset class="editor-condicoes">
      <legend class="label">{{ legenda() }}</legend>

      @if (fatos().length === 0) {
        <p class="field__hint">{{ textoSemFatos() }}</p>
      }

      @for (clausula of clausulas(); track clausula.numero) {
        @if (!$first) {
          <p class="editor-condicoes__ou">ou, alternativamente</p>
        }

        <div
          class="editor-condicoes__clausula"
          role="group"
          [attr.aria-label]="clausulas().length > 1 ? 'Alternativa ' + ($index + 1) : null"
        >
          @for (posicionada of clausula.condicoes; track posicionada.indice) {
            <div class="editor-condicoes__condicao">
              <ui-condicao-de-fato
                [condicao]="posicionada.condicao"
                [fatos]="fatos()"
                [idBase]="idBase() + '-' + posicionada.indice"
                [disabled]="disabled()"
                [rotuloDosValores]="rotuloDosValores()"
                [erro]="erros()[posicionada.indice] ?? ''"
                (condicaoChange)="trocar(posicionada.indice, $event)"
              >
                <button
                  class="btn btn--tertiary btn--sm"
                  type="button"
                  [disabled]="disabled()"
                  [attr.aria-label]="'Remover a condição sobre ' + posicionada.condicao.fato"
                  (click)="removerCondicao(posicionada.indice)"
                >
                  Remover condição
                </button>
              </ui-condicao-de-fato>
            </div>
          }

          <div class="editor-condicoes__acoes">
            <button
              class="btn btn--tertiary btn--sm"
              type="button"
              [disabled]="disabled() || fatos().length === 0"
              (click)="acrescentarCondicao(clausula.numero)"
            >
              Acrescentar condição que também precisa valer
            </button>
            @if (clausulas().length > 1) {
              <button
                class="btn btn--tertiary btn--sm"
                type="button"
                [disabled]="disabled()"
                (click)="removerAlternativa(clausula.numero)"
              >
                Remover esta alternativa
              </button>
            }
          </div>
        </div>
      } @empty {
        <p class="field__hint">{{ textoSemCondicao() }}</p>
      }

      <button
        class="btn btn--tertiary btn--sm"
        type="button"
        [disabled]="disabled() || fatos().length === 0"
        (click)="acrescentarAlternativa()"
      >
        Acrescentar alternativa
      </button>
    </fieldset>
  `,
})
export class EditorDeCondicoesComponent {
  /** Todas as condições do predicado, inclusive as do recorte que o editor não mostra. */
  readonly condicoes = input.required<readonly CondicaoEmClausula[]>();
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  /** Prefixo dos ids dos controles — único na tela, para os rótulos apontarem para eles. */
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);
  readonly legenda = input<string>('Condições');
  /** O fato que outro controle escreve; vazio quando não há recorte. */
  readonly fatoDoRecorte = input<string>('');
  readonly rotuloDosValores = input<string>('Valores que satisfazem a condição');
  readonly textoSemFatos = input<string>(
    'O catálogo de fatos do candidato não foi carregado. Recarregue a página para declarar condições.',
  );
  readonly textoSemCondicao = input<string>('Nenhuma condição declarada.');
  /** O que impede cada condição de ser gravada, pela posição dela em `condicoes`. */
  readonly erros = input<Readonly<Record<number, string | undefined>>>({});

  readonly condicoesChange = output<readonly CondicaoEmClausula[]>();

  protected readonly clausulas = computed(() =>
    clausulasDe(this.condicoes(), this.fatoDoRecorte()),
  );

  protected trocar(indice: number, nova: CondicaoDeFato): void {
    const atual = this.condicoes()[indice];
    if (atual === undefined) return;

    this.condicoesChange.emit(
      comCondicaoTrocadaEm(this.condicoes(), indice, { ...atual, ...nova }),
    );
  }

  /** Acrescenta uma condição à alternativa — ela precisa valer JUNTO com as outras de lá. */
  protected acrescentarCondicao(clausula: number): void {
    const [primeiro] = this.fatos();
    if (primeiro === undefined) return;

    this.condicoesChange.emit(comCondicaoEm(this.condicoes(), clausula, primeiro));
  }

  /**
   * Acrescenta uma alternativa: o predicado passa a valer para quem satisfaz ESTA ou aquela
   * combinação.
   */
  protected acrescentarAlternativa(): void {
    const [primeiro] = this.fatos();
    if (primeiro === undefined) return;

    this.condicoesChange.emit(comClausulaEm(this.condicoes(), primeiro, this.fatoDoRecorte()));
  }

  protected removerCondicao(indice: number): void {
    this.condicoesChange.emit(semCondicaoEm(this.condicoes(), indice));
  }

  protected removerAlternativa(numero: number): void {
    this.condicoesChange.emit(semClausulaEm(this.condicoes(), numero));
  }
}

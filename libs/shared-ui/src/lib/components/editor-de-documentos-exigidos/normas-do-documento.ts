import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { focarDepois } from '../editor-de-formulario/foco';
import { ValorLegivelDirective } from '../valor-legivel/valor-legivel.directive';
import {
  ABRANGENCIAS_ESCOLHIVEIS,
  type BaseLegal,
  baseLegalNova,
  STATUS_BASE_LEGAL_ESCOLHIVEIS,
} from '@uniplus/shared-utils';

/** Os textos do bloco de normas. Cada tela fala a própria língua; o comportamento é o mesmo. */
export interface TextosDasNormas {
  readonly legenda: string;
  readonly referencia: string;
  readonly placeholderReferencia: string;
  readonly abrangencia: string;
  readonly status: string;
  readonly observacao: string;
  /** Complemento do rótulo da observação, só para leitor de tela. */
  readonly observacaoOculta: string;
  /** O que segue o rótulo visível da observação, como " (opcional)". */
  readonly observacaoSufixo: string;
  readonly placeholderObservacao: string;
  readonly acrescentar: string;
  readonly remover: string;
  /** O nome acessível do botão de remover, seguido da posição da norma; vazio, vale o texto visível. */
  readonly removerAcessivel: string;
}

/**
 * Como as normas se dispõem na tela que as usa:
 * - `agrupada`: um quadro com legenda, cada norma em sua grade;
 * - `na-grade`: sem quadro próprio, cada campo vira item da grade de quem o hospeda, ao lado dos
 *   demais campos da exigência.
 */
export type DisposicaoDasNormas = 'agrupada' | 'na-grade';

const TEXTOS_PADRAO: TextosDasNormas = {
  legenda: 'Normas que sustentam a exigência',
  referencia: 'Referência da norma',
  placeholderReferencia: '',
  abrangencia: 'Alcance',
  status: 'Situação',
  observacao: 'Observação',
  observacaoOculta: '',
  observacaoSufixo: '',
  placeholderObservacao: '',
  acrescentar: 'Acrescentar norma',
  remover: 'Remover norma',
  removerAcessivel: 'Remover a norma',
};

/**
 * As normas que sustentam um documento exigido: referência, alcance, situação e observação de
 * cada uma, com a inclusão e a remoção. Não guarda estado: recebe a lista e devolve a lista
 * inteira a cada mudança. Os campos de texto emitem a cada tecla, para que o que depende da
 * norma (como o aviso de norma resolvida) reaja enquanto se digita.
 *
 * O conteúdo projetado (um aviso sobre as normas, por exemplo) aparece depois da última norma e
 * antes da ação de acrescentar.
 */
@Component({
  selector: 'ui-normas-do-documento',
  standalone: true,
  imports: [NgTemplateOutlet, ValorLegivelDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.normas-do-documento--na-grade]': 'naGrade()' },
  styleUrl: '../editor-de-formulario/anfitriao.css',
  styles: `
    :host(.normas-do-documento--na-grade) {
      display: contents;
    }
    :host(.normas-do-documento--na-grade) .form-field {
      margin: 0;
      min-width: 0;
    }
    .normas-do-documento__acoes {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .normas-do-documento__acoes > .btn {
      flex: 0 1 auto;
      max-width: 100%;
      white-space: normal;
      line-height: var(--leading-snug);
    }
  `,
  template: `
    <ng-template #camposDaNorma let-base let-indice="indice">
      <div [class]="classeDoCampo()" [class.form-grid__full]="!naGrade()">
        <label
          [class]="classeDoRotulo()"
          [class.is-required]="referenciaObrigatoria()"
          [for]="idDe('base-' + indice + '-ref')"
          >{{ t().referencia }}</label
        >
        <input
          class="input"
          type="text"
          [attr.maxlength]="maximoReferencia()"
          [attr.placeholder]="t().placeholderReferencia || null"
          [id]="idDe('base-' + indice + '-ref')"
          [value]="base.referencia"
          [disabled]="disabled()"
          (input)="trocarBase(indice, { referencia: valorDe($event) })"
        />
      </div>
      <div [class]="classeDoCampo()">
        <label [class]="classeDoRotulo()" [for]="idDe('base-' + indice + '-abr')">{{
          t().abrangencia
        }}</label>
        <select
          class="select"
          [id]="idDe('base-' + indice + '-abr')"
          [disabled]="disabled()"
          (change)="trocarBase(indice, { abrangencia: valorDe($event) })"
        >
          @for (abrangencia of abrangencias; track abrangencia.valor) {
            <option [value]="abrangencia.valor" [selected]="abrangencia.valor === base.abrangencia">
              {{ abrangencia.rotulo }}
            </option>
          }
        </select>
      </div>
      <div [class]="classeDoCampo()">
        <label [class]="classeDoRotulo()" [for]="idDe('base-' + indice + '-sts')">{{
          t().status
        }}</label>
        <select
          class="select"
          [id]="idDe('base-' + indice + '-sts')"
          [disabled]="disabled()"
          (change)="trocarBase(indice, { status: valorDe($event) })"
        >
          @for (status of statusEscolhiveis; track status.valor) {
            <option [value]="status.valor" [selected]="status.valor === base.status">
              {{ status.rotulo }}
            </option>
          }
        </select>
      </div>
      <div [class]="classeDoCampo()" [class.form-grid__full]="!naGrade()">
        <label [class]="classeDoRotulo()" [for]="idDe('base-' + indice + '-obs')"
          >{{ t().observacao }}
          @if (t().observacaoOculta !== '') {
            <span class="sr-only">{{ t().observacaoOculta }}</span>
          }
          {{ t().observacaoSufixo }}</label
        >
        <input
          class="input"
          type="text"
          [attr.maxlength]="maximoObservacao()"
          [attr.placeholder]="t().placeholderObservacao || null"
          [id]="idDe('base-' + indice + '-obs')"
          [value]="base.observacao ?? ''"
          [disabled]="disabled()"
          (input)="trocarBase(indice, { observacao: valorDe($event) || null })"
        />
      </div>
    </ng-template>

    <ng-template #remover let-indice="indice">
      <button
        class="btn btn--tertiary btn--sm"
        type="button"
        [id]="idDe('base-' + indice + '-remover')"
        [disabled]="disabled()"
        [attr.aria-label]="
          t().removerAcessivel === '' ? null : t().removerAcessivel + ' ' + (indice + 1)
        "
        (click)="removerBase(indice)"
      >
        {{ t().remover }}
      </button>
    </ng-template>

    <ng-template #acrescentar>
      <button
        class="btn btn--tertiary btn--sm"
        type="button"
        [id]="idDe('base-nova')"
        [disabled]="disabled()"
        (click)="acrescentarBase()"
      >
        {{ t().acrescentar }}
      </button>
    </ng-template>

    <ng-template #avisos><ng-content /></ng-template>

    @if (naGrade()) {
      @for (base of normas(); track $index) {
        <ng-container
          [ngTemplateOutlet]="camposDaNorma"
          [ngTemplateOutletContext]="{ $implicit: base, indice: $index }"
        />
        @if (podeRemover()) {
          <div class="normas-do-documento__acoes">
            <ng-container
              [ngTemplateOutlet]="remover"
              [ngTemplateOutletContext]="{ indice: $index }"
            />
          </div>
        }
      }
      <ng-container [ngTemplateOutlet]="avisos" />
      <div class="normas-do-documento__acoes">
        <ng-container [ngTemplateOutlet]="acrescentar" />
      </div>
    } @else {
      <fieldset class="editor-formulario__bases">
        <legend class="label">{{ t().legenda }}</legend>
        @for (base of normas(); track $index) {
          <div class="form-grid" role="group" [attr.aria-label]="'Norma ' + ($index + 1)">
            <ng-container
              [ngTemplateOutlet]="camposDaNorma"
              [ngTemplateOutletContext]="{ $implicit: base, indice: $index }"
            />
            @if (podeRemover()) {
              <div class="field">
                <ng-container
                  [ngTemplateOutlet]="remover"
                  [ngTemplateOutletContext]="{ indice: $index }"
                />
              </div>
            }
          </div>
        }
        <ng-container [ngTemplateOutlet]="avisos" />
        <ng-container [ngTemplateOutlet]="acrescentar" />
      </fieldset>
    }
  `,
})
export class NormasDoDocumentoComponent {
  private readonly injector = inject(Injector);

  readonly bases = input.required<readonly BaseLegal[]>();
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);
  /** Abaixo deste número a norma não se remove: o botão some. */
  readonly minimo = input<number>(0);
  readonly textos = input<Partial<TextosDasNormas>>({});
  readonly disposicao = input<DisposicaoDasNormas>('agrupada');
  /** Se o rótulo da referência marca o campo como obrigatório. */
  readonly referenciaObrigatoria = input<boolean>(true);
  /** O teto de caracteres de cada campo de texto; `null` não limita. */
  readonly maximoReferencia = input<null | number>(500);
  readonly maximoObservacao = input<null | number>(1000);

  readonly basesChange = output<readonly BaseLegal[]>();

  protected readonly abrangencias = ABRANGENCIAS_ESCOLHIVEIS;
  protected readonly statusEscolhiveis = STATUS_BASE_LEGAL_ESCOLHIVEIS;

  protected readonly t = computed<TextosDasNormas>(() => ({ ...TEXTOS_PADRAO, ...this.textos() }));
  /**
   * A lista que o editor mostra e da qual parte cada mudança: a última que ele emitiu, até o
   * hospedeiro repassar outra pelo input. Duas mudanças seguidas antes de a lista voltar (acrescentar
   * e, logo depois, trocar a situação) partiriam da lista velha e apagariam a primeira.
   */
  protected readonly normas = linkedSignal<readonly BaseLegal[]>(() => this.bases());
  protected readonly podeRemover = computed(() => this.normas().length > this.minimo());
  protected readonly naGrade = computed(() => this.disposicao() === 'na-grade');
  /** Na grade de quem hospeda, os campos seguem a anatomia dos vizinhos (a do editor de condições). */
  protected readonly classeDoCampo = computed(() => (this.naGrade() ? 'form-field' : 'field'));
  protected readonly classeDoRotulo = computed(() => (this.naGrade() ? 'label' : 'field__label'));

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected trocarBase(indice: number, mudanca: Partial<BaseLegal>): void {
    this.emitir(
      this.normas().map((base, posicao) => (posicao === indice ? { ...base, ...mudanca } : base)),
    );
  }

  protected acrescentarBase(): void {
    const indice = this.normas().length;
    this.emitir([...this.normas(), baseLegalNova()]);
    focarDepois(this.injector, this.idDe(`base-${indice}-ref`));
  }

  /** O foco vai ao botão de remover da norma seguinte, da anterior, ou ao de acrescentar. */
  protected removerBase(indice: number): void {
    if (!this.podeRemover()) return;
    this.emitir(this.normas().filter((_, posicao) => posicao !== indice));
    focarDepois(
      this.injector,
      this.idDe(`base-${indice}-remover`),
      this.idDe(`base-${indice - 1}-remover`),
      this.idDe('base-nova'),
    );
  }

  private emitir(normas: readonly BaseLegal[]): void {
    this.normas.set(normas);
    this.basesChange.emit(normas);
  }
}

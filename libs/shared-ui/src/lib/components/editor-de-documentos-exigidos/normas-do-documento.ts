import { ChangeDetectionStrategy, Component, Injector, inject, input, output } from '@angular/core';

import { ABRANGENCIAS_ESCOLHIVEIS, STATUS_BASE_LEGAL_ESCOLHIVEIS } from '@uniplus/shared-utils';
import { focarDepois } from '../editor-de-formulario/foco';
import { baseLegalNova, type BaseLegalDoDocumento } from './documentos-exigidos';

/** As normas que sustentam a exigência de um documento: referência, alcance, situação e observação. */
@Component({
  selector: 'ui-normas-do-documento',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../editor-de-formulario/anfitriao.css',
  template: `
    <fieldset class="editor-formulario__bases">
      <legend class="label">Normas que sustentam a exigência</legend>
      @for (base of bases(); track $index) {
        <div class="form-grid" role="group" [attr.aria-label]="'Norma ' + ($index + 1)">
          <div class="field form-grid__full">
            <label class="field__label is-required" [for]="idDe('base-' + $index + '-ref')"
              >Referência da norma</label
            >
            <input
              class="input"
              type="text"
              maxlength="500"
              [id]="idDe('base-' + $index + '-ref')"
              [value]="base.referencia"
              [disabled]="disabled()"
              (change)="trocar($index, { referencia: valorDe($event) })"
            />
          </div>
          <div class="field">
            <label class="field__label" [for]="idDe('base-' + $index + '-abr')">Alcance</label>
            <select
              class="select"
              [id]="idDe('base-' + $index + '-abr')"
              [disabled]="disabled()"
              (change)="trocar($index, { abrangencia: valorDe($event) })"
            >
              @for (abrangencia of abrangencias; track abrangencia.valor) {
                <option
                  [value]="abrangencia.valor"
                  [selected]="abrangencia.valor === base.abrangencia"
                >
                  {{ abrangencia.rotulo }}
                </option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field__label" [for]="idDe('base-' + $index + '-sts')">Situação</label>
            <select
              class="select"
              [id]="idDe('base-' + $index + '-sts')"
              [disabled]="disabled()"
              (change)="trocar($index, { status: valorDe($event) })"
            >
              @for (status of statusEscolhiveis; track status.valor) {
                <option [value]="status.valor" [selected]="status.valor === base.status">
                  {{ status.rotulo }}
                </option>
              }
            </select>
          </div>
          <div class="field form-grid__full">
            <label class="field__label" [for]="idDe('base-' + $index + '-obs')">Observação</label>
            <input
              class="input"
              type="text"
              maxlength="1000"
              [id]="idDe('base-' + $index + '-obs')"
              [value]="base.observacao ?? ''"
              [disabled]="disabled()"
              (change)="trocar($index, { observacao: valorDe($event) || null })"
            />
          </div>
          <div class="field">
            <button
              class="btn btn--tertiary btn--sm"
              type="button"
              [id]="idDe('base-' + $index + '-remover')"
              [disabled]="disabled()"
              [attr.aria-label]="'Remover a norma ' + ($index + 1)"
              (click)="remover($index)"
            >
              Remover norma
            </button>
          </div>
        </div>
      }
      <button
        class="btn btn--tertiary btn--sm"
        type="button"
        [id]="idDe('base-nova')"
        [disabled]="disabled()"
        (click)="acrescentar()"
      >
        Acrescentar norma
      </button>
    </fieldset>
  `,
})
export class NormasDoDocumentoComponent {
  private readonly injector = inject(Injector);

  readonly bases = input.required<readonly BaseLegalDoDocumento[]>();
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);

  readonly basesChange = output<readonly BaseLegalDoDocumento[]>();

  protected readonly abrangencias = ABRANGENCIAS_ESCOLHIVEIS;
  protected readonly statusEscolhiveis = STATUS_BASE_LEGAL_ESCOLHIVEIS;

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected trocar(indice: number, mudanca: Partial<BaseLegalDoDocumento>): void {
    this.basesChange.emit(
      this.bases().map((base, posicao) => (posicao === indice ? { ...base, ...mudanca } : base)),
    );
  }

  protected acrescentar(): void {
    const indice = this.bases().length;
    this.basesChange.emit([...this.bases(), baseLegalNova()]);
    focarDepois(this.injector, this.idDe(`base-${indice}-ref`));
  }

  /** O foco vai ao botão de remover da norma seguinte, da anterior, ou ao de acrescentar. */
  protected remover(indice: number): void {
    this.basesChange.emit(this.bases().filter((_, posicao) => posicao !== indice));
    focarDepois(
      this.injector,
      this.idDe(`base-${indice}-remover`),
      this.idDe(`base-${indice - 1}-remover`),
      this.idDe('base-nova'),
    );
  }
}

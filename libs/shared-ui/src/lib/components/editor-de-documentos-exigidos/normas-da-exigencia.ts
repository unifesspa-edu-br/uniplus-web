import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  inject,
  input,
  output,
} from '@angular/core';

import { ABRANGENCIAS_ESCOLHIVEIS, STATUS_BASE_LEGAL_ESCOLHIVEIS } from '@uniplus/shared-utils';

import { focarDepois } from '../editor-de-formulario/foco';
import { baseLegalNova, type BaseLegalDoDocumento } from './documentos-exigidos';

/**
 * As normas que sustentam uma exigência documental: referência, alcance, identificação e
 * observação de cada uma, a remoção e o acréscimo de outra. É a parte da folha que o modelo de
 * formulário e o processo seletivo têm em comum; o que é só de um deles (o aviso de norma
 * pendente, por exemplo) entra pela projeção, entre as normas e o botão de acrescentar.
 *
 * Os campos fluem no contêiner de quem o hospeda (`display: contents`), de modo que o grid do
 * hospedeiro continua mandando no layout. Devolve a lista inteira a cada mudança.
 */
@Component({
  selector: 'ui-normas-da-exigencia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @for (base of bases(); track $index) {
      <div class="normas__norma" role="group" [attr.aria-label]="'Norma ' + ($index + 1)">
        <div class="field">
          <label class="field__label" [for]="idDe('base-' + $index + '-ref')">
            Norma que exige o documento
          </label>
          <input
            class="input"
            type="text"
            maxlength="500"
            placeholder="Lei 12.711/2012, art. 3º"
            [id]="idDe('base-' + $index + '-ref')"
            [value]="base.referencia"
            [disabled]="disabled()"
            (input)="trocar($index, { referencia: valorDe($event) })"
          />
        </div>
        <div class="field">
          <label class="field__label" [for]="idDe('base-' + $index + '-abr')">
            Alcance da norma
          </label>
          <select
            class="select"
            [id]="idDe('base-' + $index + '-abr')"
            [disabled]="disabled()"
            (change)="trocar($index, { abrangencia: valorDe($event) })"
          >
            @for (opcao of abrangencias; track opcao.valor) {
              <option [value]="opcao.valor" [selected]="opcao.valor === base.abrangencia">
                {{ opcao.rotulo }}
              </option>
            }
          </select>
        </div>
        <div class="field">
          <label class="field__label" [for]="idDe('base-' + $index + '-sts')">
            Identificação da norma
          </label>
          <select
            class="select"
            [id]="idDe('base-' + $index + '-sts')"
            [disabled]="disabled()"
            (change)="trocar($index, { status: valorDe($event) })"
          >
            @for (opcao of statusEscolhiveis; track opcao.valor) {
              <option [value]="opcao.valor" [selected]="opcao.valor === base.status">
                {{ opcao.rotulo }}
              </option>
            }
          </select>
        </div>
        <div class="field">
          <label class="field__label" [for]="idDe('base-' + $index + '-obs')">
            Observação<span class="sr-only"> sobre a norma</span> (opcional)
          </label>
          <input
            class="input"
            type="text"
            maxlength="1000"
            placeholder="O que esta norma exige, em uma linha"
            [id]="idDe('base-' + $index + '-obs')"
            [value]="base.observacao ?? ''"
            [disabled]="disabled()"
            (input)="trocar($index, { observacao: valorDe($event) })"
          />
        </div>
        @if (podeRemover()) {
          <div class="doc-item__acoes form-grid__full">
            <button
              class="btn btn--tertiary btn--sm"
              type="button"
              [id]="idDe('base-' + $index + '-remover')"
              [disabled]="disabled()"
              [attr.aria-label]="'Remover a norma ' + ($index + 1)"
              (click)="remover($index)"
            >
              Remover esta norma
            </button>
          </div>
        }
      </div>
    }
    <ng-content />
    <div class="doc-item__acoes form-grid__full">
      <button
        class="btn btn--tertiary btn--sm"
        type="button"
        [id]="idDe('base-nova')"
        [disabled]="disabled()"
        (click)="acrescentar()"
      >
        Acrescentar outra norma
      </button>
    </div>
  `,
  styles: '.normas__norma { display: contents; }',
})
export class NormasDaExigenciaComponent {
  private readonly injector = inject(Injector);

  readonly bases = input.required<readonly BaseLegalDoDocumento[]>();
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);
  /** A última norma não sai: a exigência que decide o resultado precisa de uma para publicar. */
  readonly manterUma = input<boolean>(false);

  readonly basesChange = output<readonly BaseLegalDoDocumento[]>();

  protected readonly abrangencias = ABRANGENCIAS_ESCOLHIVEIS;
  protected readonly statusEscolhiveis = STATUS_BASE_LEGAL_ESCOLHIVEIS;

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected podeRemover(): boolean {
    return !this.manterUma() || this.bases().length > 1;
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
    if (this.manterUma() && this.bases().length <= 1) return;
    this.basesChange.emit(this.bases().filter((_, posicao) => posicao !== indice));
    focarDepois(
      this.injector,
      this.idDe(`base-${indice}-remover`),
      this.idDe(`base-${indice - 1}-remover`),
      this.idDe('base-nova'),
    );
  }
}

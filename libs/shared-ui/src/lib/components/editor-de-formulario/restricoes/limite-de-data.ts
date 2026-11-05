import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  problemaDoLimiteDeData,
  problemaDosAnos,
  problemaDosDias,
} from '../modelo/problemas-da-restricao';
import { ANCORA_DATA_FIXA, ANCORA_ENVIO, limiteDeDataNovo } from '../modelo/restricoes-de-valor';
import { type LimiteDeDataNoWire } from '../modelo/tipos';

type ParteDoDeslocamento = 'anos' | 'dias';

/** O problema do limite como um todo; o deslocamento do dia do envio mostra o de cada campo, junto dele. */
export function problemaDoLimite(limite: LimiteDeDataNoWire | null): string | null {
  return limite?.ancora === ANCORA_ENVIO ? null : problemaDoLimiteDeData(limite);
}

/**
 * Um limite da faixa de datas: sem limite, uma data fixa ou o dia do envio deslocado em anos e dias.
 * Devolve o limite inteiro a cada mudança. O conteúdo projetado entra no fim do grupo.
 */
@Component({
  selector: 'ui-limite-de-data',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../anfitriao.css',
  template: `
    <fieldset class="editor-formulario__limite" [attr.aria-describedby]="descricao()">
      <legend class="field__label">{{ rotulo() }}</legend>
      <div class="field">
        <label class="field__label" [for]="idBase() + '-ancora'">Contado de</label>
        <select
          class="select"
          [id]="idBase() + '-ancora'"
          [disabled]="disabled()"
          [attr.aria-describedby]="descricao()"
          (change)="trocarAncora($event)"
        >
          <option value="" [selected]="limite() === null">Sem limite</option>
          <option [value]="dataFixa" [selected]="limite()?.ancora === dataFixa">Data fixa</option>
          <option [value]="envio" [selected]="limite()?.ancora === envio">Dia do envio</option>
        </select>
      </div>
      @if (limite(); as atual) {
        @if (atual.ancora === dataFixa) {
          <div class="field">
            <label class="field__label" [for]="idBase() + '-data'">Data</label>
            <input
              class="input"
              type="date"
              [id]="idBase() + '-data'"
              [value]="atual.data ?? ''"
              [disabled]="disabled()"
              [attr.aria-invalid]="problema() ? 'true' : null"
              [attr.aria-describedby]="descricao()"
              (change)="trocarData($event)"
            />
          </div>
        } @else {
          <div class="form-grid form-grid--pair">
            @for (campo of deslocamentos(); track campo.parte) {
              <div class="field">
                <label class="field__label" [for]="idBase() + '-' + campo.parte">{{
                  campo.rotulo
                }}</label>
                <input
                  class="input"
                  type="text"
                  [id]="idBase() + '-' + campo.parte"
                  [value]="campo.valor ?? ''"
                  [disabled]="disabled()"
                  [attr.aria-invalid]="campo.problema ? 'true' : null"
                  [attr.aria-describedby]="descricaoDoDeslocamento(campo.parte, campo.problema)"
                  (change)="trocarDeslocamento(campo.parte, $event)"
                />
                @if (campo.problema; as texto) {
                  <p class="field__error" [id]="idDoErro(campo.parte)">{{ texto }}</p>
                }
              </div>
            }
          </div>
        }
      }
      @if (problema(); as texto) {
        <p class="field__error" [id]="idBase() + '-erro'">{{ texto }}</p>
      }
      <ng-content />
    </fieldset>
  `,
})
export class LimiteDeDataComponent {
  readonly limite = input.required<LimiteDeDataNoWire | null>();
  readonly rotulo = input.required<string>();
  readonly idBase = input.required<string>();
  /** Os ids do que descreve o limite, vindos de quem conhece a faixa. */
  readonly descricao = input<string | null>(null);
  readonly disabled = input<boolean>(false);

  readonly limiteChange = output<LimiteDeDataNoWire | null>();

  protected readonly dataFixa = ANCORA_DATA_FIXA;
  protected readonly envio = ANCORA_ENVIO;

  protected readonly problema = computed(() => problemaDoLimite(this.limite()));
  protected readonly deslocamentos = computed(() => {
    const atual = this.limite();
    return [
      {
        parte: 'anos',
        rotulo: 'Anos a somar ao dia do envio',
        valor: atual?.anos,
        problema: problemaDosAnos(atual?.anos),
      },
      {
        parte: 'dias',
        rotulo: 'Dias a somar ao dia do envio',
        valor: atual?.dias,
        problema: problemaDosDias(atual?.dias),
      },
    ] as const;
  });

  protected idDoErro(parte: ParteDoDeslocamento): string {
    return `${this.idBase()}-${parte}-erro`;
  }

  protected descricaoDoDeslocamento(
    parte: ParteDoDeslocamento,
    problema: string | null,
  ): string | null {
    const proprio = problema === null ? null : this.idDoErro(parte);
    return [proprio, this.descricao()].filter((id) => id !== null).join(' ') || null;
  }

  protected trocarAncora(evento: Event): void {
    const ancora = (evento.target as HTMLSelectElement).value;
    this.limiteChange.emit(ancora === '' ? null : limiteDeDataNovo(ancora));
  }

  protected trocarData(evento: Event): void {
    const data = (evento.target as HTMLInputElement).value;
    this.limiteChange.emit({ ancora: ANCORA_DATA_FIXA, data: data === '' ? null : data });
  }

  /** O deslocamento como número quando é número, e o texto como veio quando não é, para o problema dizer o quê. */
  protected trocarDeslocamento(parte: ParteDoDeslocamento, evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value.trim().replace('−', '-');
    const valor = texto === '' ? 0 : Number.isFinite(Number(texto)) ? Number(texto) : texto;
    const atual = this.limite() ?? limiteDeDataNovo(ANCORA_ENVIO);
    this.limiteChange.emit({ ...atual, ancora: ANCORA_ENVIO, [parte]: valor });
  }
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { numeroDigitadoInvalido } from '../modelo/envio';
import { type RestricaoDeValor } from '../modelo/tipos';

export type NomeDoLimite = 'minimo' | 'maximo';

export interface MudancaDeLimite {
  readonly limite: NomeDoLimite;
  readonly valor: number | string | null;
}

/**
 * O limite como número quando é número, e o texto como veio quando não é, para o problema dizer o
 * quê. A conversão acontece ao sair do campo: na digitação, o número normalizado sobrescreveria o
 * texto.
 */
export function limiteDigitado(texto: string): number | string | null {
  const limpo = texto.trim().replace(',', '.');
  if (limpo === '') return null;
  return Number.isFinite(Number(limpo)) ? Number(limpo) : limpo;
}

/** O mínimo e o máximo de uma restrição numérica — a faixa de valores ou o tamanho do texto. */
@Component({
  selector: 'ui-faixa-de-limites',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../anfitriao.css',
  template: `
    <div class="form-grid form-grid--pair">
      @for (campo of campos(); track campo.limite) {
        <div class="field">
          <label class="field__label" [for]="idBase() + '-' + campo.limite">{{
            campo.rotulo
          }}</label>
          <input
            class="input"
            type="text"
            [attr.inputmode]="modoDeEntrada()"
            [id]="idBase() + '-' + campo.limite"
            [value]="campo.valor ?? ''"
            [disabled]="disabled()"
            [attr.aria-invalid]="campo.invalido ? 'true' : null"
            [attr.aria-describedby]="campo.invalido ? idBase() + '-erro' : null"
            (change)="trocar(campo.limite, $event)"
          />
        </div>
      }
    </div>
  `,
})
export class FaixaDeLimitesComponent {
  readonly restricao = input.required<RestricaoDeValor>();
  readonly idBase = input.required<string>();
  readonly rotuloDoMinimo = input.required<string>();
  readonly rotuloDoMaximo = input.required<string>();
  readonly modoDeEntrada = input<'decimal' | 'numeric'>('numeric');
  readonly disabled = input<boolean>(false);

  readonly limiteChange = output<MudancaDeLimite>();

  protected readonly campos = computed(() => {
    const { minimo, maximo } = this.restricao();
    return [
      {
        limite: 'minimo',
        rotulo: this.rotuloDoMinimo(),
        valor: minimo,
        invalido: numeroDigitadoInvalido(minimo),
      },
      {
        limite: 'maximo',
        rotulo: this.rotuloDoMaximo(),
        valor: maximo,
        invalido: numeroDigitadoInvalido(maximo),
      },
    ] as const;
  });

  protected trocar(limite: NomeDoLimite, evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;
    this.limiteChange.emit({ limite, valor: limiteDigitado(texto) });
  }
}

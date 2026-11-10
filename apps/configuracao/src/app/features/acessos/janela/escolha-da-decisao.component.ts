import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { DecisaoDaMigracao } from '@uniplus/shared-data/autorizacao';

/** Migrar ou recusar uma concessão: duas opções do mesmo grupo, nomeadas pela pessoa. */
@Component({
  selector: 'cfg-escolha-da-decisao',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="field" role="none" [disabled]="desabilitada()">
      <legend class="sr-only">Decisão para {{ pessoa() }}</legend>
      <label class="radio">
        <input
          type="radio"
          [name]="grupo()"
          [checked]="valor() === 'migrar'"
          (change)="escolhida.emit('migrar')"
        />
        <span class="radio__dot" aria-hidden="true"></span>
        Migrar
      </label>
      <label class="radio">
        <input
          type="radio"
          [name]="grupo()"
          [checked]="valor() === 'recusar'"
          (change)="escolhida.emit('recusar')"
        />
        <span class="radio__dot" aria-hidden="true"></span>
        Recusar
      </label>
    </fieldset>
  `,
})
export class EscolhaDaDecisaoComponent {
  readonly pessoa = input.required<string>();
  readonly grupo = input.required<string>();
  readonly valor = input<DecisaoDaMigracao | null>(null);
  readonly desabilitada = input(false);
  readonly escolhida = output<DecisaoDaMigracao>();
}

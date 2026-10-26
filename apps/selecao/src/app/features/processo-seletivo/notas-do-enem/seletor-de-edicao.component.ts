import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { rotuloDaEdicao } from '../steps/steps/classificacao/edicoes-do-enem';
import { NotasDoEnemDoProcesso } from './notas-do-enem-do-processo.service';

/** A edição do ENEM de um card; cada card tem a sua e escolher uma não muda a outra. */
@Component({
  selector: 'sel-seletor-de-edicao',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './compartilhado.css',
  template: `
    <div class="field notas__edicao">
      <label class="field__label is-required" [for]="idDoCampo()">Edição do ENEM</label>
      <select #campo class="select" [id]="idDoCampo()" (change)="escolhida.emit(campo.value)">
        <option value="">Selecione a edição</option>
        @for (opcao of notas.edicoes(); track opcao) {
          <option [value]="opcao" [selected]="opcao === valor()">{{ rotulo(opcao) }}</option>
        }
      </select>
    </div>
  `,
})
export class SeletorDeEdicaoComponent {
  protected readonly notas = inject(NotasDoEnemDoProcesso);
  /** O rótulo do campo já diz "Edição do ENEM": a opção leva só o ano. */
  protected rotulo(edicao: string): string {
    return rotuloDaEdicao(edicao).replace(/^ENEM\s+/, '');
  }

  readonly idDoCampo = input.required<string>();
  readonly valor = input.required<string>();
  readonly escolhida = output<string>();
}

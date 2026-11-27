import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Se a recusa abre prazo para o candidato reenviar o documento, ou os documentos de um grupo. */
@Component({
  selector: 'sel-prazo-para-reenvio',
  template: `
    <label class="check-item" [attr.for]="idBase()">
      <input
        #caixa
        type="checkbox"
        [id]="idBase()"
        [checked]="marcado()"
        [disabled]="desabilitado()"
        (change)="marcadoChange.emit(caixa.checked)"
      />
      <span>Abrir prazo para o candidato reenviar {{ objeto() }}</span>
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class PrazoParaReenvioComponent {
  readonly idBase = input.required<string>();
  readonly objeto = input('o documento');
  readonly marcado = input(false);
  readonly desabilitado = input(false);
  readonly marcadoChange = output<boolean>();
}

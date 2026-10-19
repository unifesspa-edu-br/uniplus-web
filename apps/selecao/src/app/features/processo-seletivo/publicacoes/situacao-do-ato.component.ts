import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SituacaoDoRegistroDoAto, type AtoDoProcessoDto } from '@uniplus/shared-data/selecao';
import { TagComponent } from '@uniplus/shared-ui/components';

/** Onde o registro do ato está: confirmado, em processamento ou demorando mais que o esperado. */
@Component({
  selector: 'sel-situacao-do-ato',
  standalone: true,
  imports: [TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ato().situacao === registrado) {
      <ui-tag variant="success">Registrado</ui-tag>
    } @else if (ato().pendenciaAcimaDoLimiar) {
      <ui-tag variant="danger">Em processamento há muito tempo</ui-tag>
    } @else {
      <ui-tag variant="warning">Em processamento</ui-tag>
    }
  `,
})
export class SituacaoDoAtoComponent {
  readonly ato = input.required<Pick<AtoDoProcessoDto, 'situacao' | 'pendenciaAcimaDoLimiar'>>();

  protected readonly registrado = SituacaoDoRegistroDoAto.registrado;
}

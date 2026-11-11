import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TagComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import type { SituacaoDoPerfil } from './estado-do-perfil';

/** Uma situação do perfil, com o instante em que ela começou quando a API o informa. */
@Component({
  selector: 'cfg-situacao-do-perfil',
  standalone: true,
  imports: [TagComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-tag [variant]="situacao().variante">{{ situacao().texto }}</ui-tag>
    @if (situacao().desde; as desde) {
      <span class="cfg-muted">desde {{ desde | dateBr: 'datetime' }}</span>
    }
  `,
})
export class SituacaoDoPerfilComponent {
  readonly situacao = input.required<SituacaoDoPerfil>();
}

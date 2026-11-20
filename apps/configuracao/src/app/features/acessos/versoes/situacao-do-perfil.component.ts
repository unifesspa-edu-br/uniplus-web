import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TagComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import type { EtiquetaDoPerfil } from './estado-do-perfil';

/** As etiquetas da situação do perfil, na lista e no detalhe, e a versão pendente como texto auxiliar. */
@Component({
  selector: 'cfg-situacao-do-perfil',
  standalone: true,
  imports: [TagComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (etiqueta of etiquetas(); track etiqueta.texto) {
      <span>
        <ui-tag [variant]="etiqueta.variante">{{ etiqueta.texto }}</ui-tag>
        @if (etiqueta.desde; as desde) {
          &ngsp;<span class="cfg-muted">desde {{ desde | dateBr: 'datetime' }}</span>
        }
      </span>
      &ngsp;
    }
    @if (versaoPendente()) {
      <span class="cfg-muted">Versão pendente</span>
    }
  `,
})
export class SituacaoDoPerfilComponent {
  readonly etiquetas = input.required<readonly EtiquetaDoPerfil[]>();
  readonly versaoPendente = input.required<boolean>();
}

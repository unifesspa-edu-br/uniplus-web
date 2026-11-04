import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CampusDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { CampiStore } from './campi.store';
import { FormularioDoCampus } from './formulario-do-campus';

/** O painel com a tabela de campi, o estado vazio e a paginação. */
@Component({
  selector: 'cfg-campi-lista',
  standalone: true,
  imports: [EmptyStateComponent, IconButtonComponent, PagerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campi-lista.component.html',
  host: { style: 'display: contents' },
})
export class CampiListaComponent {
  protected readonly store = inject(CampiStore);
  protected readonly formulario = inject(FormularioDoCampus);

  protected cidadeLabel(campus: CampusDto): string {
    const cidade = campus.endereco?.cidade ?? campus.cidade;
    return cidade ? `${cidade.nome} — ${cidade.uf}` : '—';
  }
}

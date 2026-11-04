import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  ListFooterComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { textoExibivel } from '../../shared/codigo-e-rotulo';
import { CursosStore } from './cursos.store';
import { FormularioDoCurso } from './formulario-do-curso';
import { OfertasDoCursoStore } from './ofertas-do-curso.store';

/** O painel com a busca, a tabela de cursos, o estado vazio e a paginação. */
@Component({
  selector: 'cfg-cursos-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    ListFooterComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cursos-lista.component.html',
  host: { style: 'display: contents' },
})
export class CursosListaComponent {
  protected readonly store = inject(CursosStore);
  protected readonly formulario = inject(FormularioDoCurso);
  protected readonly ofertas = inject(OfertasDoCursoStore);
  protected readonly textoExibivel = textoExibivel;
}

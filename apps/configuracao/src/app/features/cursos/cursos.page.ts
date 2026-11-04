import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AlertComponent, ConfirmDialogComponent } from '@uniplus/shared-ui/components';
import { CursoFormularioComponent } from './curso-formulario.component';
import { CursosListaComponent } from './cursos-lista.component';
import { CursosStore } from './cursos.store';
import { FormularioDoCurso } from './formulario-do-curso';
import { OfertasDoCursoComponent } from './ofertas-do-curso.component';
import { OfertasDoCursoStore } from './ofertas-do-curso.store';

/** Cadastro de cursos: compõe a lista, o formulário, a confirmação de remoção e as ofertas. */
@Component({
  selector: 'cfg-cursos-page',
  standalone: true,
  providers: [CursosStore, FormularioDoCurso, OfertasDoCursoStore],
  imports: [
    AlertComponent,
    ConfirmDialogComponent,
    CursoFormularioComponent,
    CursosListaComponent,
    OfertasDoCursoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cursos.page.html',
  host: { class: 'cfg-page' },
})
export class CursosPage {
  protected readonly store = inject(CursosStore);
}

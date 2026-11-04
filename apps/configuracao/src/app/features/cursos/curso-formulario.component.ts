import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { AlertaNovaTentativaComponent } from '../../shared/alerta-nova-tentativa';
import { CatalogoGruposAreaEnem } from '../../shared/grupos-area-enem';
import { CursosStore } from './cursos.store';
import { FormularioDoCurso } from './formulario-do-curso';

/** O drawer com o formulário de cadastro e edição de curso. */
@Component({
  selector: 'cfg-curso-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    AlertaNovaTentativaComponent,
    DrawerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './curso-formulario.component.html',
  host: { style: 'display: contents' },
})
export class CursoFormularioComponent {
  protected readonly store = inject(CursosStore);
  protected readonly formulario = inject(FormularioDoCurso);
  /** Grupos de área do ENEM vindos da API: o select oferece os rótulos e grava o código. */
  protected readonly gruposAreaEnem = inject(CatalogoGruposAreaEnem);
}

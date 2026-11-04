import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  AlertComponent,
  DrawerComponent,
  EnderecoGeoComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { CampiStore } from './campi.store';
import { FormularioDoCampus } from './formulario-do-campus';

/** O drawer com o formulário de cadastro e edição de campus. */
@Component({
  selector: 'cfg-campus-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    EnderecoGeoComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campus-formulario.component.html',
  host: { style: 'display: contents' },
})
export class CampusFormularioComponent {
  protected readonly store = inject(CampiStore);
  protected readonly formulario = inject(FormularioDoCampus);
}

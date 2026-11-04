import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  AlertComponent,
  DrawerComponent,
  EnderecoGeoComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { CampusForm } from './campus-form';

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
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class CampusFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<CampusForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly erroDoEndereco = input.required<string | null>();
  readonly gravando = input.required<boolean>();

  readonly salvar = output<void>();
  readonly cancelar = output<void>();

  protected erroDoCampo(nome: keyof CampusForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
}

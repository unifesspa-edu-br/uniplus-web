import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { InstituicaoForm } from './instituicao-form';

/** As seções de situação regulatória e indicadores de qualidade do formulário da Instituição. */
@Component({
  selector: 'cfg-instituicao-regulatorio',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instituicao-regulatorio.component.html',
  styleUrl: './instituicao-secoes.css',
})
export class InstituicaoRegulatorioComponent {
  readonly form = input.required<FormGroup<InstituicaoForm>>();

  protected erroDoCampo(nome: keyof InstituicaoForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
}

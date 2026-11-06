import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { InstituicaoForm } from './instituicao-form';

/** As seções de identificação, classificação e mantenedora do formulário da Instituição. */
@Component({
  selector: 'cfg-instituicao-identificacao',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instituicao-identificacao.component.html',
  styleUrl: './instituicao-secoes.css',
})
export class InstituicaoIdentificacaoComponent {
  readonly form = input.required<FormGroup<InstituicaoForm>>();

  protected erroDoCampo(nome: keyof InstituicaoForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
}

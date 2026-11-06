import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import type { EdicaoDoConteudoDoModelo } from './edicao-do-conteudo-do-modelo';
import type { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';

type Formulario = EdicaoDoConteudoDoModelo['form'];

/** Os campos de identificação do modelo (nome, tipo de processo, descrição) e o envio do formulário. */
@Component({
  selector: 'cfg-modelo-formulario-identificacao',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelo-formulario-identificacao.component.html',
})
export class ModeloFormularioIdentificacaoComponent {
  readonly form = input.required<Formulario>();
  readonly tiposDeProcesso =
    input.required<ReturnType<ModeloFormularioEdicaoStore['tiposDeProcesso']>>();
  /** A gravação em curso e a espera pela recarga que a segue. */
  readonly somenteLeitura = input.required<boolean>();
  readonly salvar = output<void>();

  protected erro(campo: keyof Formulario['controls']): string | null {
    return mensagemDeErroDoControle(this.form().controls[campo]);
  }
}

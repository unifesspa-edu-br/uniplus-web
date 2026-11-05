import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DrawerComponent,
  FINALIDADES,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { EdicaoDosModelosFormulario } from './edicao-dos-modelos-formulario';

@Component({
  selector: 'cfg-modelo-formulario-criacao',
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelo-formulario-criacao.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class ModeloFormularioCriacaoComponent {
  readonly form = input.required<EdicaoDosModelosFormulario['form']>();
  readonly aberto = input.required<boolean>();
  readonly salvando = input.required<boolean>();
  readonly erroDaCriacao = input.required<string | null>();
  readonly tiposDeProcesso = input.required<readonly TipoProcessoDto[]>();
  readonly abertoChange = output<boolean>();
  readonly criar = output<void>();
  protected readonly finalidades = FINALIDADES;
  protected erro(campo: keyof EdicaoDosModelosFormulario['form']['controls']): string | null {
    const controle = this.form().controls[campo];
    if (!(controle.touched || controle.dirty) || controle.errors === null) return null;
    const backend = controle.errors['backend'] as { message: string } | undefined;
    if (backend) return backend.message;
    if (controle.errors['required']) return 'Campo obrigatório.';
    if (controle.errors['pattern'])
      return 'Use caixa alta, começando por letra, com letras, números e sublinhado.';
    if (controle.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }
}

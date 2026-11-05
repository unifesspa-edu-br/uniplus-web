import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { ReservaForm } from './edicao-das-reservas-demograficas';
import { mensagemDoCampo } from './reserva-demografica-formulario-mensagem';

@Component({
  selector: 'cfg-reserva-demografica-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reserva-demografica-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class ReservaDemograficaFormularioComponent {
  readonly form = input.required<FormGroup<ReservaForm>>();
  readonly aberto = input.required<boolean>();
  readonly salvando = input.required<boolean>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly formError = input.required<string | null>();
  readonly formHeading = input.required<string>();
  readonly anuncio = input('');
  readonly fechar = output<void>();
  readonly salvar = output<void>();
  readonly verificarCenso = output<void>();
  protected erroDoCampo(nome: keyof ReservaForm): string | null {
    return mensagemDoCampo(this.form(), nome);
  }
}

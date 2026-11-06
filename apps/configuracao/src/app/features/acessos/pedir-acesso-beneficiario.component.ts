import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { EdicaoDoPedidoDeAcesso } from './edicao-do-pedido-de-acesso';
import { campoInvalido, mensagemDoCampo, type FormDoPedido } from './pedir-acesso-campo';

/** Para quem é o acesso: para si ou, com o e-mail dela, para outra pessoa. */
@Component({
  selector: 'cfg-pedir-acesso-beneficiario',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedir-acesso-beneficiario.component.html',
  styleUrl: '../../shared/formulario/campos-do-formulario.css',
})
export class PedirAcessoBeneficiarioComponent {
  readonly form = input.required<FormDoPedido>();
  readonly paraQuem = input.required<ReturnType<EdicaoDoPedidoDeAcesso['paraQuem']>>();

  protected invalido(): boolean {
    return campoInvalido(this.form().controls.beneficiarioEmail);
  }

  protected mensagem(): string {
    return mensagemDoCampo(this.form().controls.beneficiarioEmail, 'Informe um e-mail válido.');
  }
}

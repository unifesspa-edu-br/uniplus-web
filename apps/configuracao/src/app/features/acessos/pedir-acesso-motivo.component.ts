import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { campoInvalido, mensagemDoCampo, type FormDoPedido } from './pedir-acesso-campo';

const JUSTIFICATIVA_PADRAO = 'A justificativa deve ter de 10 a 2000 caracteres.';

/** A justificativa do pedido e, para o perfil que não exige documento, o prazo sugerido. */
@Component({
  selector: 'cfg-pedir-acesso-motivo',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedir-acesso-motivo.component.html',
  styleUrl: '../../shared/formulario/campos-do-formulario.css',
})
export class PedirAcessoMotivoComponent {
  readonly form = input.required<FormDoPedido>();
  readonly exigeDocumento = input.required<boolean>();
  readonly hoje = input.required<string>();
  readonly mensagemDoPrazo = input.required<string>();

  protected invalidaJustificativa(): boolean {
    return campoInvalido(this.form().controls.justificativa);
  }

  protected mensagemDaJustificativa(): string {
    return mensagemDoCampo(this.form().controls.justificativa, JUSTIFICATIVA_PADRAO);
  }

  protected invalidoPrazo(): boolean {
    return campoInvalido(this.form().controls.validaAteSugerida);
  }

  protected mensagemDoPrazoInvalido(): string {
    return mensagemDoCampo(this.form().controls.validaAteSugerida, this.mensagemDoPrazo());
  }
}

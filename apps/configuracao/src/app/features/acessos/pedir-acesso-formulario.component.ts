import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import type { EdicaoDoPedidoDeAcesso } from './edicao-do-pedido-de-acesso';
import { PedidoDocumentoFormularioComponent } from './pedido-documento-formulario.component';

type Edicao = EdicaoDoPedidoDeAcesso;
type Campo = keyof Edicao['form']['controls'];

@Component({
  selector: 'cfg-pedir-acesso-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    SpinnerComponent,
    PedidoDocumentoFormularioComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedir-acesso-formulario.component.html',
})
export class PedirAcessoFormularioComponent {
  readonly form = input.required<Edicao['form']>();
  readonly perfis = input.required<ReturnType<Edicao['perfis']>>();
  readonly perfisIndisponiveis = input.required<string | null>();
  readonly perfilSelecionado = input.required<ReturnType<Edicao['perfilSelecionado']>>();
  readonly unidades = input.required<ReturnType<Edicao['unidades']>>();
  readonly paraQuem = input.required<ReturnType<Edicao['paraQuem']>>();
  readonly exigeUnidade = input.required<boolean>();
  readonly exigeDocumento = input.required<boolean>();
  readonly erroDoDocumento = input.required<string | null>();
  readonly enviando = input.required<boolean>();
  readonly aguardandoConfirmacao = input.required<boolean>();
  readonly faseDoEnvio = input.required<string | null>();
  readonly hoje = input.required<string>();
  readonly mensagemDoPrazo = input.required<string>();
  readonly arquivo = model.required<File | null>();
  readonly enviar = output<void>();

  protected invalido(nome: Campo): boolean {
    const controle = this.form().controls[nome];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected mensagemDoCampo(nome: Campo, padrao: string): string {
    return (
      (this.form().controls[nome].getError('backend') as { message: string } | null)?.message ??
      padrao
    );
  }

  protected aoEnviar(): void {
    if (!this.enviando()) this.enviar.emit();
  }

  protected aoClicar(evento: Event): void {
    if (this.enviando()) evento.preventDefault();
  }
}

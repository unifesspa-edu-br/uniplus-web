import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  AlertaNovaTentativaComponent,
  type FaseDaNovaTentativa,
} from '@uniplus/shared-ui/components';
import type { EdicaoDoPedidoDeAcesso } from './edicao-do-pedido-de-acesso';
import { campoInvalido, mensagemDoCampo, type FormDoPedido } from './pedir-acesso-campo';

type Edicao = EdicaoDoPedidoDeAcesso;

/** O perfil pedido e, quando o escopo dele é de unidade, a unidade. */
@Component({
  selector: 'cfg-pedir-acesso-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, AlertaNovaTentativaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedir-acesso-perfil.component.html',
  styleUrl: '../../shared/formulario/campos-do-formulario.css',
})
export class PedirAcessoPerfilComponent {
  readonly form = input.required<FormDoPedido>();
  readonly perfis = input.required<ReturnType<Edicao['perfis']>>();
  readonly perfisIndisponiveis = input.required<string | null>();
  readonly carregandoPerfis = input.required<boolean>();
  readonly fasePerfis = input.required<FaseDaNovaTentativa>();
  readonly perfilSelecionado = input.required<ReturnType<Edicao['perfilSelecionado']>>();
  readonly unidades = input.required<ReturnType<Edicao['unidades']>>();
  readonly exigeUnidade = input.required<boolean>();
  readonly tentarPerfisNovamente = output<void>();

  protected invalidoPerfil(): boolean {
    return campoInvalido(this.form().controls.perfilId);
  }

  protected mensagemDoPerfil(): string {
    return mensagemDoCampo(this.form().controls.perfilId, 'Selecione o perfil.');
  }

  protected invalidaUnidade(): boolean {
    return campoInvalido(this.form().controls.unidadeId);
  }

  protected mensagemDaUnidade(): string {
    return mensagemDoCampo(this.form().controls.unidadeId, 'Selecione a unidade.');
  }
}

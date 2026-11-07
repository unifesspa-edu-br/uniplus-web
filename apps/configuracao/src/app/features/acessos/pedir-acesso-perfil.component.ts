import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FalhaDeLeituraComponent, type LeituraAcompanhada } from '@uniplus/shared-ui/components';
import type { EdicaoDoPedidoDeAcesso } from './edicao-do-pedido-de-acesso';
import {
  ID_DO_PERFIL,
  campoInvalido,
  mensagemDoCampo,
  type FormDoPedido,
} from './pedir-acesso-campo';
import { RecusaDaLeituraComponent, type RecusaDaLeitura } from '../../shared/recusa-da-leitura';

type Edicao = EdicaoDoPedidoDeAcesso;

/** O perfil pedido e, quando o escopo dele é de unidade, a unidade. */
@Component({
  selector: 'cfg-pedir-acesso-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, FalhaDeLeituraComponent, RecusaDaLeituraComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedir-acesso-perfil.component.html',
  styleUrl: '../../shared/formulario/campos-do-formulario.css',
})
export class PedirAcessoPerfilComponent {
  readonly form = input.required<FormDoPedido>();
  readonly perfis = input.required<ReturnType<Edicao['perfis']>>();
  readonly leitura = input.required<LeituraAcompanhada>();
  readonly recusa = input.required<RecusaDaLeitura | null>();
  readonly perfilSelecionado = input.required<ReturnType<Edicao['perfilSelecionado']>>();
  readonly unidades = input.required<ReturnType<Edicao['unidades']>>();
  readonly exigeUnidade = input.required<boolean>();
  protected readonly idDoPerfil = ID_DO_PERFIL;

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

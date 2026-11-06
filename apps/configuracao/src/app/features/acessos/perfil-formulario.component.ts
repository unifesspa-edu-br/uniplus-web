import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { ModuloDoCatalogoDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import {
  type CampoDoPerfil,
  criarFormularioDePerfil,
  mensagemDoCampoDoPerfil,
} from './perfil-form';
import { sensibilidade } from './rotulos-de-acesso';

/** Destino do foco quando o catálogo volta a carregar depois de uma falha. */
export const ID_DAS_PERMISSOES = 'cfg-perfil-permissoes';

@Component({
  selector: 'cfg-perfil-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './perfil-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class PerfilFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<ReturnType<typeof criarFormularioDePerfil>>();
  readonly emEdicao = input.required<boolean>();
  readonly salvando = input.required<boolean>();
  readonly criacaoEmAberto = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly catalogo = input.required<readonly ModuloDoCatalogoDto[]>();
  readonly erroDoCatalogo = input.required<boolean>();
  readonly carregandoCatalogo = input.required<boolean>();
  readonly marcadas = input.required<readonly string[]>();
  readonly salvar = output<void>();
  readonly alternar = output<string>();
  readonly recarregarCatalogo = output<void>();
  protected readonly sensibilidadeDe = sensibilidade;
  protected readonly idDasPermissoes = ID_DAS_PERMISSOES;

  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected invalido(nome: CampoDoPerfil): boolean {
    const controle = this.form().controls[nome];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected mensagemDoCampo(nome: CampoDoPerfil): string | null {
    return mensagemDoCampoDoPerfil(nome, this.form().controls[nome]);
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }
}

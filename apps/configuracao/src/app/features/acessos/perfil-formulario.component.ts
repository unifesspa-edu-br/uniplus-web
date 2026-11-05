import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { ModuloDoCatalogoDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { criarFormularioDePerfil } from './perfil-form';
import { sensibilidade } from './rotulos-de-acesso';

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
  readonly marcadas = input.required<readonly string[]>();
  readonly salvar = output<void>();
  readonly alternar = output<string>();
  readonly recarregarCatalogo = output<void>();
  protected readonly sensibilidadeDe = sensibilidade;

  protected invalido(nome: 'nome' | 'descricao'): boolean {
    const controle = this.form().controls[nome];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected mensagemDoCampo(nome: 'nome' | 'descricao'): string | null {
    const controle = this.form().controls[nome];
    if (controle.hasError('required'))
      return nome === 'nome' ? 'Informe o nome do perfil.' : 'Descreva o perfil.';
    return mensagemDeErroDoControle(controle);
  }

  protected aoEnviar(): void {
    if (!this.salvando()) this.salvar.emit();
  }

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }
}

import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { OPCOES_DE_TIPO } from './tipos-de-unidade';
import { UnidadeForm, mensagemDoCampo } from './unidade-form';

const TIPO_NAO_RECONHECIDO = 'Tipo atual não reconhecido — selecione um tipo válido para salvar.';

/**
 * O drawer com o formulário de cadastro e edição de unidade. Os campos de unidade superior e de
 * cidade, que têm busca própria, chegam por projeção e ficam dentro do fieldset do formulário.
 */
@Component({
  selector: 'cfg-unidade-formulario',
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidade-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class UnidadeFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<UnidadeForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  readonly tipoNaoReconhecido = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();

  protected readonly tipos = OPCOES_DE_TIPO;
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected erroDoCampo(nome: keyof UnidadeForm): string | null {
    return mensagemDoCampo(this.form().controls[nome]);
  }

  /** A recusa do servidor vale mais; sem ela, o tipo que a API devolveu e a tela não conhece. */
  protected erroDoTipo(): string | null {
    const controle = this.form().controls.tipo;
    if (controle.hasError('backend')) return mensagemDoCampo(controle);
    return this.tipoNaoReconhecido() ? TIPO_NAO_RECONHECIDO : mensagemDoCampo(controle);
  }

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}

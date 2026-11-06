import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoCampoComFormato } from '../../shared/formulario';
import { DECLARACOES_DE_PUBLICACAO, SINALIZADORES } from './tipo-ato-campos';
import { AtoForm } from './tipo-ato-form';

/** Nenhum campo do tipo de ato tem validador de formato: a mensagem de formato nunca é a escolhida. */
const MENSAGEM_DE_FORMATO = 'Valor inválido.';

/** O drawer do cadastro e da edição de uma vigência de tipo de ato. */
@Component({
  selector: 'cfg-tipo-ato-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-ato-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class TipoAtoFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<AtoForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();

  protected readonly sinalizadores = SINALIZADORES;
  protected readonly declaracoes = DECLARACOES_DE_PUBLICACAO;

  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }

  protected erroDoCampo(nome: keyof AtoForm): string | null {
    return mensagemDeErroDoCampoComFormato(this.form().controls[nome], MENSAGEM_DE_FORMATO);
  }

  protected descricaoDoCampo(controle: keyof AtoForm): string {
    const ajuda = `${controle}-ajuda`;
    return this.erroDoCampo(controle) ? `${ajuda} ${controle}-erro` : ajuda;
  }
}

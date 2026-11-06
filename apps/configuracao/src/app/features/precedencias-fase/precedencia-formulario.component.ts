import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import type { OpcaoDeFase } from './fases-do-grafo.store';
import { PrecedenciaForm, mensagemDaSucessora } from './precedencia-form';

@Component({
  selector: 'cfg-precedencia-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './precedencia-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class PrecedenciaFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<PrecedenciaForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly opcoesDeFase = input.required<readonly OpcaoDeFase[]>();
  readonly falhaAoCarregarFases = input.required<boolean>();
  readonly carregandoFases = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  /** Andamento e desfecho da nova tentativa de ler o que o formulário usa; fica dentro do drawer, que torna a página inerte. */
  readonly anuncioDaLeitura = input('');
  readonly salvando = input.required<boolean>();
  /** Há escrita em curso ou a lista ainda recarrega: salvar fica indisponível, sem perder o foco. */
  readonly gravando = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly recarregarFases = output<void>();
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.gravando()) evento.preventDefault();
  }

  protected aoEnviar(): void {
    if (this.gravando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }

  protected erroDaAntecessora(): string | null {
    return mensagemDeErroDoControle(this.form().controls.antecessoraCodigo);
  }

  protected erroDaSucessora(): string | null {
    return mensagemDaSucessora(this.form());
  }
}

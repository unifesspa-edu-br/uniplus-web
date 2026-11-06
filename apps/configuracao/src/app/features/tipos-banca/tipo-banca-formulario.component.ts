import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { BancaForm } from './tipo-banca-form';
@Component({
  selector: 'cfg-tipo-banca-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-banca-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
  styles: [':host, :host > ui-drawer { display: contents; }'],
})
export class TipoBancaFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<BancaForm>>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  readonly sugestoesFaseTipica = input.required<readonly string[]>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }
  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
  protected erroDoCampo(nome: keyof BancaForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
}

import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FORMAS_ACEITE } from '@uniplus/shared-data/configuracao';
import { SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { CriarForm, TEXTO_MAX } from './termo-consentimento-form';

@Component({
  selector: 'cfg-termo-consentimento-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './termo-consentimento-formulario.component.html',
})
export class TermoConsentimentoFormularioComponent {
  readonly form = input.required<FormGroup<CriarForm>>();
  readonly criando = input.required<boolean>();
  readonly salvar = output<void>();
  protected readonly formasAceite = FORMAS_ACEITE;
  protected readonly textoMax = TEXTO_MAX;
  private readonly foco = acompanharFocoDoEnvio({
    salvando: this.criando,
    aberto: signal(true).asReadonly(),
  });

  protected erroDoCampo(nome: keyof CriarForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }

  protected aoEnviar(): void {
    if (this.criando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}

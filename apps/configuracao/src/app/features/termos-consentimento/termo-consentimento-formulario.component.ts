import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FORMAS_ACEITE } from '@uniplus/shared-data/configuracao';
import { SpinnerComponent } from '@uniplus/shared-ui/components';
import { TEXTO_MAX } from './termo-consentimento-form';
import { CriarForm } from './termo-consentimento-form';

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
  readonly tentouSalvar = input.required<boolean>();
  readonly salvar = output<void>();
  protected readonly formasAceite = FORMAS_ACEITE;
  protected readonly textoMax = TEXTO_MAX;
  protected erroDoCampo(control: FormControl<string>): string | null {
    if (!(control.touched || control.dirty || this.tentouSalvar()) || !control.errors) return null;
    if (control.errors['backend'])
      return (control.errors['backend'] as { message: string }).message;
    if (control.errors['required']) return 'Campo obrigatório.';
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }
}

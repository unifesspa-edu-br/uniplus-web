import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FORMAS_ACEITE } from '@uniplus/shared-data/configuracao';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { TEXTO_MAX } from './termo-consentimento-form';
import { computed } from '@angular/core';
import { TermoConsentimentoDto } from '@uniplus/shared-data/configuracao';
import { formatarDataBr } from '@uniplus/shared-utils';
import { AcaoTermo, RascunhoForm } from './termo-consentimento-form';

@Component({
  selector: 'cfg-termo-consentimento-detalhe',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './termo-consentimento-detalhe.component.html',
})
export class TermoConsentimentoDetalheComponent {
  readonly form = input.required<FormGroup<RascunhoForm>>();
  readonly termo = input.required<TermoConsentimentoDto | null>();
  readonly processando = input.required<boolean>();
  readonly acaoEmAndamento = input.required<AcaoTermo | null>();
  readonly tentouSalvar = input.required<boolean>();
  readonly podeRevisar = input.required<boolean>();
  readonly podePromover = input.required<boolean>();
  readonly podeRemover = input.required<boolean>();
  readonly salvar = output<void>();
  readonly revisar = output<void>();
  readonly promover = output<void>();
  readonly remover = output<void>();
  protected readonly formasAceite = FORMAS_ACEITE;
  protected readonly textoMax = TEXTO_MAX;
  protected readonly statusLabel = computed(() => {
    const termo = this.termo();
    return termo?.revisado && termo.revisadoEm
      ? `Revisado em ${formatarDataBr(termo.revisadoEm, 'datetime')}`
      : 'Em elaboração';
  });
  protected readonly motivoRevisaoIndisponivel = computed(() =>
    this.podeRevisar()
      ? null
      : 'Preencha texto e base legal do rascunho salvo antes de marcar como revisado.',
  );
  protected readonly motivoPromocaoIndisponivel = computed(() =>
    this.podePromover() ? null : 'Marque o rascunho como revisado antes de promover.',
  );
  protected readonly motivoRemocaoIndisponivel = computed(() =>
    this.podeRemover()
      ? null
      : 'Termo com versão promovida não pode ser removido — edite o rascunho e promova uma nova versão.',
  );
  protected formatarData(value: string): string {
    return formatarDataBr(value, 'datetime');
  }
  protected formaAceiteLabel(token: string): string {
    return this.formasAceite.find((o) => o.value === token)?.label ?? token;
  }
  protected hashTruncado(hash: string): string {
    return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
  }
  protected erroDoCampo(control: FormControl<string>): string | null {
    if (!(control.touched || control.dirty || this.tentouSalvar()) || !control.errors) return null;
    if (control.errors['backend'])
      return (control.errors['backend'] as { message: string }).message;
    if (control.errors['required']) return 'Campo obrigatório.';
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }
}

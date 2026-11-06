import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FORMAS_ACEITE, TermoConsentimentoDto } from '@uniplus/shared-data/configuracao';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { formatarDataBr } from '@uniplus/shared-utils';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { AcaoTermo, RascunhoForm, TEXTO_MAX } from './termo-consentimento-form';

const MOTIVO_DA_LEITURA_DEFASADA =
  'O termo foi alterado por outra pessoa e o texto na tela pode estar desatualizado. Recarregue os dados antes de continuar.';

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
  readonly leituraDefasada = input.required<boolean>();
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
  protected readonly motivoRevisaoIndisponivel = computed(() => {
    if (this.leituraDefasada()) return MOTIVO_DA_LEITURA_DEFASADA;
    return this.podeRevisar()
      ? null
      : 'Preencha texto e base legal do rascunho salvo antes de marcar como revisado.';
  });
  protected readonly motivoPromocaoIndisponivel = computed(() => {
    if (this.leituraDefasada()) return MOTIVO_DA_LEITURA_DEFASADA;
    return this.podePromover() ? null : 'Marque o rascunho como revisado antes de promover.';
  });
  protected readonly motivoRemocaoIndisponivel = computed(() =>
    (this.termo()?.versoes.length ?? 0) > 0
      ? 'Termo com versão promovida não pode ser removido.'
      : null,
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
  protected erroDoCampo(nome: keyof RascunhoForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
  private readonly foco = acompanharFocoDoEnvio({
    salvando: computed(() => this.acaoEmAndamento() === 'rascunho'),
    aberto: signal(true).asReadonly(),
  });

  protected aoEnviar(): void {
    if (this.processando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}

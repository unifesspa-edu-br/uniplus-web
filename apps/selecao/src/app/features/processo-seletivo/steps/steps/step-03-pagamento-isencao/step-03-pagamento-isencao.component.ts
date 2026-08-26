import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CRITERIOS_ISENCAO, FORMAS_PAGAMENTO } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';

@Component({
  selector: 'sel-step-03-pagamento-isencao',
  standalone: true,
  templateUrl: './step-03-pagamento-isencao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step03PagamentoIsencaoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly criterios = CRITERIOS_ISENCAO;
  readonly formasPagamento = FORMAS_PAGAMENTO;
  /** Campos inválidos detectados na última validação (chave → `.is-invalid`). */
  readonly invalidFields = signal<ReadonlySet<string>>(new Set());

  toggleFormaPagamento(code: string, checked: boolean): void {
    const current = this.store.draft().pagamento.formasPagamento;
    this.store.patchObjectSection('pagamento', {
      formasPagamento: checked ? [...current, code] : current.filter((item) => item !== code),
    });
  }

  toggleCriterioIsencao(id: string, checked: boolean): void {
    const isencao = this.store.draft().pagamento.isencao;
    const current = isencao.criterios;
    this.store.patchObjectSection('pagamento', {
      isencao: {
        ...isencao,
        criterios: checked ? [...current, id] : current.filter((item) => item !== id),
      },
    });
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const pagamento = this.store.draft().pagamento;
    const messages: string[] = [];
    const invalid = new Set<string>();

    if (!pagamento.taxaObrigatoria) {
      this.invalidFields.set(invalid);
      return { valid: true };
    }

    if (pagamento.valorTaxa === null || pagamento.valorTaxa <= 0) {
      messages.push('Informe o valor da taxa de inscrição.');
      invalid.add('valorTaxa');
    }
    if (!pagamento.formasPagamento.length) {
      messages.push('Selecione ao menos uma forma de pagamento.');
      invalid.add('formasPagamento');
    }
    if (!pagamento.dataLimite) {
      messages.push('Informe a data limite para pagamento.');
      invalid.add('dataLimite');
    }
    if (pagamento.isencao.disponivel) {
      if (!pagamento.isencao.criterios.length) {
        messages.push('Selecione ao menos um critério de isenção.');
        invalid.add('criteriosIsencao');
      }
      if (!pagamento.isencao.prazoSolicitacao) {
        messages.push('Informe o prazo para solicitação de isenção.');
        invalid.add('prazoSolicitacao');
      }
    }

    this.invalidFields.set(invalid);
    return messages.length ? { valid: false, messages } : { valid: true };
  }
}

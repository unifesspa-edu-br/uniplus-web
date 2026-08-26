import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  CRITERIOS_ISENCAO_OBRIGATORIOS,
  FORMAS_PAGAMENTO,
  PRAZOS_RECURSO_ISENCAO_DIAS_UTEIS,
} from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';

/** Dias corridos mínimos entre o início e o encerramento da solicitação de isenção. */
const MINIMO_DIAS_CORRIDOS_ISENCAO = 5;

@Component({
  selector: 'sel-step-03-pagamento-isencao',
  standalone: true,
  templateUrl: './step-03-pagamento-isencao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step03PagamentoIsencaoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly criteriosIsencao = CRITERIOS_ISENCAO_OBRIGATORIOS;
  readonly formasPagamento = FORMAS_PAGAMENTO;
  readonly prazosRecurso = PRAZOS_RECURSO_ISENCAO_DIAS_UTEIS;
  /** Campos inválidos detectados na última validação (chave → `.is-invalid`). */
  readonly invalidFields = signal<ReadonlySet<string>>(new Set());

  toggleFormaPagamento(code: string, checked: boolean): void {
    const current = this.store.draft().pagamento.formasPagamento;
    this.store.patchObjectSection('pagamento', {
      formasPagamento: checked ? [...current, code] : current.filter((item) => item !== code),
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

    // A isenção é obrigatória sempre que há cobrança — sem esta seção o
    // processo ficaria sem via de isenção, o que a regra de negócio proíbe.
    const { inicioSolicitacao, fimSolicitacao, prazoRecursoDiasUteis } = pagamento.isencao;
    if (!inicioSolicitacao) {
      messages.push('Informe o início da solicitação de isenção.');
      invalid.add('inicioSolicitacao');
    }
    if (!fimSolicitacao) {
      messages.push('Informe o encerramento da solicitação de isenção.');
      invalid.add('fimSolicitacao');
    }
    if (inicioSolicitacao && fimSolicitacao) {
      // Compara por dia de calendário (não por instante exato): o input
      // `datetime-local` não tem granularidade de segundo, e "5 dias
      // corridos, dia de abertura excluído" é uma contagem de dias inteiros.
      const diasCorridos = diferencaEmDiasCorridos(inicioSolicitacao, fimSolicitacao);

      if (diasCorridos < MINIMO_DIAS_CORRIDOS_ISENCAO) {
        messages.push(
          `O período de solicitação de isenção deve ter no mínimo ${MINIMO_DIAS_CORRIDOS_ISENCAO} dias corridos.`,
        );
        invalid.add('fimSolicitacao');
      }
    }
    if (prazoRecursoDiasUteis === null) {
      messages.push('Selecione o prazo para recurso da isenção.');
      invalid.add('prazoRecursoDiasUteis');
    }

    this.invalidFields.set(invalid);
    return messages.length ? { valid: false, messages } : { valid: true };
  }
}

/** Diferença em dias de calendário inteiros entre dois datetimes locais. */
function diferencaEmDiasCorridos(inicioIso: string, fimIso: string): number {
  const inicio = new Date(inicioIso);
  const fim = new Date(fimIso);
  const inicioMeiaNoite = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const fimMeiaNoite = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  return Math.round((fimMeiaNoite.getTime() - inicioMeiaNoite.getTime()) / 86_400_000);
}

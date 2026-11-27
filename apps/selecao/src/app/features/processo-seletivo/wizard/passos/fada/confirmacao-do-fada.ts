import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import type { WizardDraft } from '../../processo-seletivo.models';

export interface EntradaDaConfirmacaoDoFada {
  readonly fada: WizardDraft['fada'];
  readonly identificacaoDaBaseLegal: string | undefined;
  readonly citaElegibilidade: boolean;
  readonly fatoDeElegibilidade: string | null;
}

/** O resumo que a página confirma antes de gravar a declaração do Fator de Atenuação. */
export function confirmacaoDoFada(entrada: EntradaDaConfirmacaoDoFada): ConfirmacaoDeGravacao {
  if (entrada.fada.aplica === false) {
    return {
      titulo: 'Confirmar que o processo não aplica o Fator de Atenuação',
      aviso: 'O processo será declarado sem Fator de Atenuação.',
      rotuloDeConfirmar: 'Confirmar sem Fator de Atenuação',
      itens: [{ rotulo: 'Fator de Atenuação', valor: 'Não aplicado neste processo' }],
    };
  }
  return confirmacaoComFada(entrada);
}

function confirmacaoComFada(entrada: EntradaDaConfirmacaoDoFada): ConfirmacaoDeGravacao {
  const { fada } = entrada;
  return {
    titulo: 'Confirmar o Fator de Atenuação',
    aviso: 'Estes dados serão gravados como o Fator de Atenuação deste processo.',
    rotuloDeConfirmar: 'Gravar o Fator de Atenuação',
    itens: [
      { rotulo: 'Regra', valor: fada.regraCodigo },
      { rotulo: 'Multiplicador da nota', valor: fada.fator },
      { rotulo: 'Teto', valor: fada.teto === '' ? 'sem teto' : fada.teto },
      { rotulo: 'Base legal', valor: entrada.identificacaoDaBaseLegal ?? 'não selecionada' },
      ...itensDeElegibilidade(entrada),
    ],
  };
}

function itensDeElegibilidade(entrada: EntradaDaConfirmacaoDoFada) {
  if (!entrada.citaElegibilidade) return [];
  return [
    {
      rotulo: 'Quem recebe o Fator de Atenuação',
      valor: entrada.fatoDeElegibilidade ?? 'ainda não escolhido',
    },
  ];
}

import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import type { WizardDraft } from '../../processo-seletivo.models';

export interface EntradaDaConfirmacaoDoBonus {
  readonly bonus: WizardDraft['bonus'];
  readonly identificacaoDaBaseLegal: string | undefined;
  readonly citaElegibilidade: boolean;
  readonly fatoDeElegibilidade: string | null;
}

/** O resumo que a página confirma antes de gravar a declaração do FADA. */
export function confirmacaoDoBonus(entrada: EntradaDaConfirmacaoDoBonus): ConfirmacaoDeGravacao {
  if (entrada.bonus.aplica === false) {
    return {
      titulo: 'Confirmar que o processo não aplica o FADA',
      aviso: 'O processo será declarado sem FADA.',
      rotuloDeConfirmar: 'Confirmar sem FADA',
      itens: [{ rotulo: 'FADA', valor: 'Não aplicado neste processo' }],
    };
  }
  return confirmacaoComFada(entrada);
}

function confirmacaoComFada(entrada: EntradaDaConfirmacaoDoBonus): ConfirmacaoDeGravacao {
  const { bonus } = entrada;
  return {
    titulo: 'Confirmar o FADA',
    aviso: 'Estes dados serão gravados como o FADA deste processo.',
    rotuloDeConfirmar: 'Gravar FADA',
    itens: [
      { rotulo: 'Regra', valor: bonus.regraCodigo },
      { rotulo: 'Fator', valor: bonus.fator },
      { rotulo: 'Teto', valor: bonus.teto === '' ? 'sem teto' : bonus.teto },
      { rotulo: 'Base legal', valor: entrada.identificacaoDaBaseLegal ?? 'não selecionada' },
      ...itensDeElegibilidade(entrada),
    ],
  };
}

function itensDeElegibilidade(entrada: EntradaDaConfirmacaoDoBonus) {
  if (!entrada.citaElegibilidade) return [];
  return [
    {
      rotulo: 'Quem recebe o acréscimo',
      valor: entrada.fatoDeElegibilidade ?? 'ainda não escolhido',
    },
  ];
}

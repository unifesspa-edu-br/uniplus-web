import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import type { WizardDraft } from '../../processo-seletivo.models';

export interface EntradaDaConfirmacaoDoBonus {
  readonly bonus: WizardDraft['bonus'];
  readonly identificacaoDaBaseLegal: string | undefined;
  readonly citaElegibilidade: boolean;
  readonly fatoDeElegibilidade: string | null;
}

/** O resumo que a página confirma antes de gravar a declaração do bônus regional. */
export function confirmacaoDoBonus(entrada: EntradaDaConfirmacaoDoBonus): ConfirmacaoDeGravacao {
  const { bonus } = entrada;
  if (bonus.aplica === false) {
    return {
      titulo: 'Confirmar que o processo não aplica o bônus regional',
      aviso: 'O processo será declarado sem bônus regional.',
      rotuloDeConfirmar: 'Confirmar sem bônus',
      itens: [{ rotulo: 'Bônus regional', valor: 'Não aplicado neste processo' }],
    };
  }

  return {
    titulo: 'Confirmar o bônus regional',
    aviso: 'Estes dados serão gravados como o bônus regional deste processo.',
    rotuloDeConfirmar: 'Gravar bônus',
    itens: [
      { rotulo: 'Regra', valor: bonus.regraCodigo },
      { rotulo: 'Fator', valor: bonus.fator },
      { rotulo: 'Teto', valor: bonus.teto === '' ? 'sem teto' : bonus.teto },
      { rotulo: 'Base legal', valor: entrada.identificacaoDaBaseLegal ?? 'não selecionada' },
      ...(entrada.citaElegibilidade
        ? [
            {
              rotulo: 'Quem recebe o acréscimo',
              valor: entrada.fatoDeElegibilidade ?? 'ainda não escolhido',
            },
          ]
        : []),
    ],
  };
}

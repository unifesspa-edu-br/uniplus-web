import type { UnidadePrazo } from '@uniplus/shared-data/selecao';

import { decimalDoCampo } from './numero-do-campo';

/** O que a janela de recurso guarda sobre a instância superior, na fase e na etapa. */
export interface InstanciaSuperiorDaJanela {
  readonly admiteInstanciaSuperior: boolean | null;
  readonly suspensividadeSegundaInstanciaValor: string;
  readonly suspensividadeSegundaInstanciaUnidade: UnidadePrazo | '';
}

/**
 * A instância superior como o comando a recebe.
 *
 * Sem instância superior não há o que bloquear nela, e a API recusa o tempo de bloqueio
 * declarado. Os campos digitados antes da resposta "Não" ficam no rascunho, para que trocar de
 * ideia não custe o que já foi preenchido, mas só viajam quando a janela admite a instância.
 *
 * A pergunta em aberto (`null`) não chega aqui: a conferência do passo barra a gravação antes.
 */
export function instanciaSuperiorParaComando(janela: InstanciaSuperiorDaJanela): {
  readonly admiteInstanciaSuperior: boolean;
  readonly suspensividadeSegundaInstanciaValor: number | null;
  readonly suspensividadeSegundaInstanciaUnidade: UnidadePrazo | null;
} {
  const admite = janela.admiteInstanciaSuperior === true;

  return {
    admiteInstanciaSuperior: admite,
    suspensividadeSegundaInstanciaValor: admite
      ? decimalDoCampo(janela.suspensividadeSegundaInstanciaValor)
      : null,
    suspensividadeSegundaInstanciaUnidade:
      admite && janela.suspensividadeSegundaInstanciaUnidade !== ''
        ? janela.suspensividadeSegundaInstanciaUnidade
        : null,
  };
}

/** A recusa local da pergunta em aberto, no texto que o campo mostra. */
export const MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO =
  'Responda se esta janela admite recurso em instância superior.';

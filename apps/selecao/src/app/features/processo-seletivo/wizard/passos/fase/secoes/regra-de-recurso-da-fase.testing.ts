import type { FaseDoCronograma, RecursoDaFase } from '../../../processo-seletivo.models';
import {
  PARAMETROS_COM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from '../../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { fase, ID_AVALIACAO } from '../fase.testing';
import { prefixoDoRecursoDaFase } from '../ids-da-fase';

/** O prefixo dos `id` dos parâmetros do recurso da fase que estes cenários abrem. */
export const PREFIXO = prefixoDoRecursoDaFase(ID_AVALIACAO);

export const REGRA: RecursoDaFase = {
  regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
  regraVersao: 'v1',
  atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
  ...PARAMETROS_COM_INSTANCIA_SUPERIOR,
  leitura: umaLeituraDoRecurso({
    rotulos: {
      prazoUnidade: 'Dias úteis',
      prazoSegundaInstanciaUnidade: 'Dias úteis',
      efeitoSuspensivo: 'Sem efeito suspensivo',
      guardaDaVaga: 'Guarda a vaga até o resultado definitivo',
    },
  }),
  procedimentos: [],
};

/** A fase que publica o resultado preliminar, com a regra de recurso de `REGRA` alterada por `regra`, ou sem regra. */
export function faseComRegra(regra: Partial<RecursoDaFase> | null = {}): FaseDoCronograma {
  return fase({
    produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
    regraRecurso: regra === null ? null : { ...REGRA, ...regra },
  });
}

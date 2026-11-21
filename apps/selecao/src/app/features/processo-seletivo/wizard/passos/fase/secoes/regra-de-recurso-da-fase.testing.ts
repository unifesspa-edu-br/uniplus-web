import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import { fase } from '../fase.testing';

export const REGRA = {
  regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
  regraVersao: 'v1',
  prazoValor: '2',
  prazoUnidade: 'diasUteis',
  atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
  suspensividadePrimeiraInstanciaValor: '1',
  suspensividadePrimeiraInstanciaUnidade: 'horas',
  admiteInstanciaSuperior: true,
  suspensividadeSegundaInstanciaValor: '',
  suspensividadeSegundaInstanciaUnidade: '',
  procedimentos: [],
};

/** A fase que publica o resultado preliminar, com a regra de recurso de `REGRA` alterada por `regra`, ou sem regra. */
export function faseComRegra(regra: Partial<typeof REGRA> | null = {}): FaseDoCronograma {
  return fase({
    produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
    regraRecurso:
      regra === null ? null : ({ ...REGRA, ...regra } as FaseDoCronograma['regraRecurso']),
  });
}

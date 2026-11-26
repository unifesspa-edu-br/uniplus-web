import {
  ReferenciaTipoCodigo,
  type DefinirReferenciaTemporalFatosRequest,
} from '@uniplus/shared-data/selecao';
import { codigoExigidoDoContrato } from '@uniplus/shared-data/utils';
import type { ReferenciaTemporalConfig } from '../../processo-seletivo.models';

/**
 * A política temporal no que o comando recebe, com a fase resolvida de código para
 * identificador. Tudo nulo remove a política, que é o que o contrato entende por ausência.
 */
export function comoComandoDeReferenciaTemporal(
  referencia: ReferenciaTemporalConfig,
  faseIdPorCodigo: ReadonlyMap<string, string>,
): DefinirReferenciaTemporalFatosRequest {
  if (referencia.tipo === '') return { tipo: null, data: null, faseId: null };
  return {
    tipo: codigoExigidoDoContrato(ReferenciaTipoCodigo, referencia.tipo, 'referência temporal'),
    data: referencia.tipo === 'DATA_ESPECIFICA' && referencia.data !== '' ? referencia.data : null,
    faseId: referenciaEmFase(referencia.tipo)
      ? (faseIdPorCodigo.get(referencia.faseCodigo) ?? null)
      : null,
  };
}

/**
 * O fato de idade. É o único cujo gatilho obriga o certame a declarar uma política temporal —
 * a idade não é respondida pelo candidato, é apurada contra um instante.
 */
export const FATO_DA_IDADE = 'FAIXA_ETARIA';

/** As referências da apuração da idade, como a tela as nomeia. */
export const REFERENCIAS_DA_IDADE = [
  { valor: '', rotulo: 'Não apura idade' },
  { valor: 'DATA_ESPECIFICA', rotulo: 'Uma data fixa' },
  { valor: 'FIM_INSCRICAO', rotulo: 'O fim do período de inscrição' },
  { valor: 'INICIO_FASE', rotulo: 'O início de uma fase' },
  { valor: 'FIM_FASE', rotulo: 'O fim de uma fase' },
] as const;

/** A apuração da idade se ancora numa fase: o início ou o fim dela. */
export function referenciaEmFase(tipo: string): boolean {
  return tipo === 'INICIO_FASE' || tipo === 'FIM_FASE';
}

import type { RecusaDoProblema } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { umaFaseDoCronograma } from '../../../shared/fase-do-cronograma.testing';
import { distribuirRecusasDasFases } from './distribuicao-das-recusas-das-fases';

const COM_UMA_BANCA = umaFaseDoCronograma({
  faseCanonicaId: 'fase-1',
  produtos: [{ atoCodigo: 'EDITAL', papel: 'PRELIMINAR' }],
  bancasRequeridas: [
    {
      id: null,
      identificadorLocal: 'banca',
      copiaDoTipo: null,
      tipoBancaId: 'banca',
      categoriasDocumentoIds: [],
      regraDeDeliberacao: null,
    },
  ],
});

const recusa = (campo: string): RecusaDoProblema => ({
  campo,
  codigo: 'uniplus.selecao.exemplo.recusa',
  mensagem: 'Recusa.',
  pagina: null,
  ordem: 0,
  identificadores: [],
});

const camposDistribuidos = (...campos: string[]): string[] => {
  const { porFase } = distribuirRecusasDasFases(1, [COM_UMA_BANCA], campos.map(recusa), () => true);
  return (porFase.get('fase-1') ?? []).map((guardada) => guardada.campo);
};

describe('distribuirRecusasDasFases: linhas das listas da fase', () => {
  it('deixa a recusa à regra de uma banca na banca que a fase enviada tinha', () => {
    expect(camposDistribuidos('fases[0].bancasRequeridas[0].regraDeDeliberacao.quorum')).toEqual([
      'bancasRequeridas.0.quorum',
    ]);
  });

  it('leva à lista de bancas a recusa a uma banca que a fase enviada não tinha', () => {
    expect(camposDistribuidos('fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum')).toEqual([
      'bancasRequeridas',
    ]);
  });

  it('conta as linhas de cada lista por si', () => {
    expect(camposDistribuidos('fases[0].produtos[0].papel', 'fases[0].produtos[1].papel')).toEqual([
      'produtos.0.papel',
      'produtos',
    ]);
  });
});

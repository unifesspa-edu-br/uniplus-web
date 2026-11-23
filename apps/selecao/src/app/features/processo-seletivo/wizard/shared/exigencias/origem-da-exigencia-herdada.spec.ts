import { describe, expect, it } from 'vitest';

import { identificarRecusaDaExigencia } from './caminho-da-recusa-das-exigencias';
import { exigencia, rascunho, ID_RG } from './exigencias.testing';
import { regrasDeComprovacaoParaEnvio } from './gravacao-das-exigencias';

const PROCESSO = {
  faseIdPorCodigo: new Map([
    ['ISENCAO', 'fase-1'],
    ['AVALIACAO', 'fase-2'],
  ]),
  modalidadesOfertadas: [],
  etapasVivas: new Set<string>(),
  finalidadesPorFase: new Map<string, string[]>(),
};
const CAMPO = 'documento.requisitos.tamanhoMaximoBytes';

describe('Origem da exigência herdada', () => {
  it('identifica a linha herdada na fase acrescentada', () => {
    const exigencias = {
      ...rascunho(exigencia({ tipoDocumentoId: ID_RG, faseCodigo: 'ISENCAO' })),
      emTodasAsFases: [ID_RG],
    };
    const envio = regrasDeComprovacaoParaEnvio(exigencias, PROCESSO);
    const recusa = identificarRecusaDaExigencia(`regrasDeComprovacao[1].${CAMPO}`, envio.origens);
    expect(recusa).toEqual({ identificadorDaRegra: ID_RG, faseCodigo: 'AVALIACAO', campo: CAMPO });
  });
});

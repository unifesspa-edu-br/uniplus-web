import { describe, expect, it } from 'vitest';

import { comExigencia } from './exigencias-documentais';
import {
  comando,
  detalheDaApi,
  exigencia,
  exigenciaDaApi,
  grupoDaApi,
  ID_HABILITACAO,
  ID_RG,
  rascunho,
} from './exigencias.testing';
import { exigenciasDe } from './leitura-das-exigencias';

const CORPO_ESPERADO = [
  {
    forma: 'DOCUMENTO',
    documento: {
      tipoDocumento: { id: ID_RG },
      fatosComprovados: [],
      momento: { faseId: ID_HABILITACAO, etapaId: null, finalidade: 'HABILITACAO' },
      aplicabilidade: { tipo: 'GERAL', condicoes: [] },
      indeferimento: {
        obrigatorio: true,
        consequencia: null,
        basesLegais: [],
      },
      requisitos: {
        formatosPermitidos: ['PDF', 'JPEG', 'PNG'].map((formato) => ({
          formato,
          tamanhoMaximoBytesMax: null,
        })),
        tamanhoMaximoBytes: 5242880,
        prazoDeEmissao: null,
        validade: null,
        modelo: null,
      },
    },
    cardinalidade: null,
    indeferimento: null,
    itens: null,
    grupoDoFormularioParaRepeticao: null,
  },
];

describe('identificador da regra no rascunho', () => {
  it('identifica separadamente regras iguais, grupos e seus itens na leitura', () => {
    const documento = exigenciaDaApi();
    const grupo = grupoDaApi([documento]);
    const regras = exigenciasDe(detalheDaApi([documento, documento, grupo])).regrasDeComprovacao;
    const identificadores = regras.map((regra) => regra.identificadorNoRascunho);
    identificadores.push(regras[2].itens?.[0].identificadorNoRascunho ?? '');
    expect(identificadores.every((identificador) => identificador.length > 0)).toBe(true);
    expect(new Set(identificadores).size).toBe(4);
  });

  it('preserva o identificador ao editar uma exigência', () => {
    const antes = rascunho(exigencia());
    const depois = comExigencia(
      antes,
      antes.regrasDeComprovacao[0].identificadorNoRascunho,
      exigencia({ obrigatorio: false }),
    );
    expect(depois.regrasDeComprovacao[0].identificadorNoRascunho).toBe(
      antes.regrasDeComprovacao[0].identificadorNoRascunho,
    );
  });

  it('envia somente os campos do contrato', () => {
    const recebido = comando(rascunho(exigencia()));
    expect(recebido).toEqual(CORPO_ESPERADO);
  });
});

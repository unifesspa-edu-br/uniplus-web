import { describe, expect, it } from 'vitest';
import { recusaDaApresentacao, recusaDaSimulacao } from './recusas-do-arquivo';

describe('recusas do arquivo', () => {
  it('recusa máximo de grupo escrito como texto', () => {
    const formulario = {
      finalidade: '',
      etapas: [],
      termos: [],
      regras: {},
      pressupostos: { fatos: [] },
      coleta: {
        itens: [],
        grupos: [
          {
            codigo: '',
            ordem: 1,
            rotulo: '',
            ocorrencias: { minimo: 0, maximo: '1', incluiCandidato: false },
            subitens: [],
          },
        ],
      },
    };
    expect(recusaDaApresentacao(formulario)?.caminho).toBe('coleta.grupos[0].ocorrencias.maximo');
  });

  it('recusa ocorrência de grupo sem identificador', () => {
    expect(recusaDaSimulacao({ grupos: { familia: [{ respostas: {} }] } })?.caminho).toBe(
      'grupos.familia[0]',
    );
  });
});

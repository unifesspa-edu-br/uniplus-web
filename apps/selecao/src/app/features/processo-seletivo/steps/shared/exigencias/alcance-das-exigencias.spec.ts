import { describe, expect, it } from 'vitest';

import type { ExigenciasDoRascunho } from '../../processo-seletivo.models';
import {
  ID_HABILITACAO,
  ID_ISENCAO,
  ID_RG,
  comando,
  exigencia,
  rascunho,
} from './exigencias.testing';

describe('alcance de todas as fases', () => {
  /**
   * A intenção "vale em todas as fases" é materializada na SERIALIZAÇÃO, e não só no clique:
   * a fase acrescentada depois de a intenção ter sido declarada também precisa receber a
   * exigência. Materializar uma vez só deixava essa fase de fora sem nada denunciando.
   */
  it('exige o documento na fase acrescentada depois de declarada a intenção', () => {
    const declarado: ExigenciasDoRascunho = {
      ...rascunho(exigencia({ faseCodigo: 'HABILITACAO', obrigatorio: false })),
      emTodasAsFases: [ID_RG],
    };

    const raizes = comando(declarado);

    expect(raizes).toHaveLength(2);
    expect(raizes.map((raiz) => raiz.documento?.exigidoNaFaseId).sort()).toEqual(
      [ID_ISENCAO, ID_HABILITACAO].sort(),
    );
    // A fase nova herda o que foi declarado, não um formulário em branco.
    expect(raizes.every((raiz) => raiz.documento?.obrigatorio === false)).toBe(true);
  });

  /** Sem nada declarado, a intenção não inventa exigência. */
  it('não materializa documento que não tem exigência nenhuma na raiz', () => {
    const semModelo: ExigenciasDoRascunho = { raizes: [], emTodasAsFases: [ID_RG] };
    expect(comando(semModelo)).toHaveLength(0);
  });

  /**
   * O modelo sai das folhas de RAIZ. Copiar uma alternativa de grupo `OU` transformaria
   * "um destes dois basta" em "este, sozinho" nas demais fases.
   */
  it('não usa alternativa de grupo como modelo do alcance', () => {
    const soDentroDoGrupo: ExigenciasDoRascunho = {
      emTodasAsFases: [ID_RG],
      raizes: [
        {
          tipo: 'OU',
          documento: null,
          quantidadeMinima: 1,
          consequencia: null,
          basesLegais: null,
          filhos: [
            {
              tipo: 'FOLHA',
              documento: exigencia({ faseCodigo: 'HABILITACAO' }),
              quantidadeMinima: null,
              consequencia: null,
              basesLegais: null,
              filhos: null,
              chaveDistincao: null,
              dataReferencia: null,
              ocorrenciasEsperadas: null,
              repetePorEntidade: null,
            },
          ],
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
        },
      ],
    };

    const raizes = comando(soDentroDoGrupo);
    // O grupo continua inteiro, e nenhuma folha solta foi criada na outra fase.
    expect(raizes).toHaveLength(1);
    expect(raizes[0].tipo).toBe('OU');
  });
});

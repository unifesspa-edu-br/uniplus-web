import { describe, expect, it } from 'vitest';

import type { ExigenciasDoRascunho } from '../../processo-seletivo.models';
import {
  ID_HABILITACAO,
  ID_ISENCAO,
  ID_RG,
  comando,
  exigencia,
  rascunho,
  regraDoRascunho,
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

    const regrasDeComprovacao = comando(declarado);

    expect(regrasDeComprovacao).toHaveLength(2);
    expect(
      regrasDeComprovacao.map((regraPrincipal) => regraPrincipal.documento?.momento?.faseId).sort(),
    ).toEqual([ID_ISENCAO, ID_HABILITACAO].sort());
    // A fase nova herda o que foi declarado, não um formulário em branco.
    expect(
      regrasDeComprovacao.every(
        (regraPrincipal) => regraPrincipal.documento?.indeferimento?.obrigatorio === false,
      ),
    ).toBe(true);
  });

  /** Sem nada declarado, a intenção não inventa exigência. */
  it('não materializa documento que não tem exigência nenhuma na regra principal', () => {
    const semModelo: ExigenciasDoRascunho = { regrasDeComprovacao: [], emTodasAsFases: [ID_RG] };
    expect(comando(semModelo)).toHaveLength(0);
  });

  /**
   * O modelo sai das regras de documento de regra principal. Copiar uma alternativa de grupo de alternativas transformaria
   * "um destes dois basta" em "este, sozinho" nas demais fases.
   */
  it('não usa alternativa de grupo como modelo do alcance', () => {
    const soDentroDoGrupo: ExigenciasDoRascunho = {
      emTodasAsFases: [ID_RG],
      regrasDeComprovacao: [
        regraDoRascunho({
          forma: 'QUANTIDADE_MINIMA_DE_ITENS',
          quantidadeMinima: 1,
          itens: [regraDoRascunho({ forma: 'DOCUMENTO', documento: exigencia() })],
        }),
      ],
    };

    const regrasDeComprovacao = comando(soDentroDoGrupo);
    // O grupo continua inteiro, e nenhuma regra de documento solta foi criada na outra fase.
    expect(regrasDeComprovacao).toHaveLength(1);
    expect(regrasDeComprovacao[0].forma).toBe('QUANTIDADE_MINIMA_DE_ITENS');
  });
});

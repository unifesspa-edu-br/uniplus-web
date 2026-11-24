import { describe, expect, it } from 'vitest';

import type { FaseDoCronograma, RegraDeDeliberacaoDaBanca } from '../../processo-seletivo.models';
import { ATO_INDIVIDUAL, COLEGIADA } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import type { CampoDaFase } from './configuracao-da-fase';
import { campos, conferir, fase } from './configuracao-da-fase.testing';

describe('publicações que a fase declara', () => {
  it('fase sem publicação alguma é estado válido', () => {
    expect(conferir(fase())).toEqual([]);
  });

  it('cobra o tipo de ato da publicação em branco', () => {
    const problemas = conferir(fase({ produtos: [{ atoCodigo: '', papel: null }] }));

    expect(problemas[0].campo).toBe<CampoDaFase>('produtos');
    expect(problemas[0].mensagem).toContain('Escolha o tipo de ato');
  });

  it('recusa a mesma publicação declarada duas vezes', () => {
    const problemas = conferir(
      fase({
        produtos: [
          { atoCodigo: 'COMUNICADO', papel: null },
          { atoCodigo: 'COMUNICADO', papel: null },
        ],
      }),
    );

    expect(problemas.map((problema) => problema.mensagem)).toContain(
      'A fase não pode declarar a mesma publicação duas vezes no mesmo papel.',
    );
  });

  /**
   * O catálogo nomeia a matéria, não o papel: "Resultado da homologação das inscrições" é
   * um código só, publicado uma vez como preliminar — que abre o ciclo recursal — e outra
   * como definitiva, que o encerra. Recusar o par tornava esse ciclo inexprimível.
   */
  it('aceita a mesma matéria publicada como preliminar e como definitiva', () => {
    const problemas = conferir(
      fase({
        produtos: [
          { atoCodigo: 'RESULTADO_HOMOLOGACAO', papel: 'PRELIMINAR' },
          { atoCodigo: 'RESULTADO_HOMOLOGACAO', papel: 'DEFINITIVO' },
        ],
      }),
    );

    expect(
      problemas.filter((problema) => /mais de uma vez|duas vezes/.test(problema.mensagem)),
    ).toEqual([]);
  });

  /** Papel só existe em ato que o catálogo marca como resultado. */
  it('recusa papel em publicação que o catálogo não marca como resultado', () => {
    const problemas = conferir(
      fase({ produtos: [{ atoCodigo: 'COMUNICADO', papel: 'PRELIMINAR' }] }),
    );

    expect(problemas.map((problema) => problema.mensagem)).toContain(
      'A publicação Comunicado não é resultado no catálogo e não recebe papel preliminar nem definitivo.',
    );
  });

  /**
   * Ato fora do catálogo carregado não é acusado: quem arbitra é o servidor, e
   * recusar por desconhecimento bloquearia a edição de um cronograma que ele
   * aceita.
   */
  it('não acusa papel em ato que o catálogo carregado desconhece', () => {
    const declarados = campos(
      fase({
        produtos: [
          { atoCodigo: 'ATO_NOVO', papel: 'PRELIMINAR' },
          { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
        ],
      }),
    );

    expect(declarados).not.toContain<CampoDaFase>('produtos');
  });
});

describe('publicação preliminar e definitiva', () => {
  const PRELIMINAR = { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' };
  const DEFINITIVO = { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' };

  it('fase que publica preliminar e definitiva não relata problema', () => {
    expect(conferir(fase({ produtos: [PRELIMINAR, DEFINITIVO] }))).toEqual([]);
  });

  /** Cobrar a publicação do definitivo do mesmo tipo de ato é da API: a tela só orienta. */
  it('fase que publica preliminar sem o definitivo não é recusada pela tela', () => {
    expect(conferir(fase({ produtos: [PRELIMINAR] }))).toEqual([]);
  });
});

describe('parecer individual', () => {
  it('recusa a promessa de parecer em fase que não publica resultado', () => {
    const problemas = conferir(
      fase({ produtos: [{ atoCodigo: 'COMUNICADO', papel: null }], emiteParecerIndividual: true }),
    );

    expect(problemas[0].campo).toBe<CampoDaFase>('emiteParecerIndividual');
  });

  it('aceita a promessa quando a fase publica resultado definitivo', () => {
    expect(
      conferir(
        fase({
          produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
          emiteParecerIndividual: true,
        }),
      ),
    ).toEqual([]);
  });
});

describe('bancas requeridas e o recorte de competência', () => {
  it('banca única sem recorte é estado válido — ela julga tudo o que a fase exige', () => {
    expect(
      conferir(
        fase({
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              tipoBancaId: 'banca-hetero',
              categoriasDocumentoIds: [],
              regraDeDeliberacao: null,
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('não recusa categorias ausentes em bancas do mesmo tipo', () => {
    const problemas = conferir(
      fase({
        bancasRequeridas: [
          {
            id: null,
            identificadorLocal: 'banca-teste',
            copiaDoTipo: null,
            tipoBancaId: 'banca-hetero',
            categoriasDocumentoIds: ['raca'],
            regraDeDeliberacao: null,
          },
          {
            id: null,
            identificadorLocal: 'banca-teste',
            copiaDoTipo: null,
            tipoBancaId: 'banca-hetero',
            categoriasDocumentoIds: [],
            regraDeDeliberacao: null,
          },
        ],
      }),
    );

    expect(problemas).toEqual([]);
  });

  it('não recusa bancas do mesmo tipo com categorias idênticas', () => {
    const problemas = conferir(
      fase({
        bancasRequeridas: [
          {
            id: null,
            identificadorLocal: 'banca-teste',
            copiaDoTipo: null,
            tipoBancaId: 'banca-hetero',
            categoriasDocumentoIds: ['raca', 'renda'],
            regraDeDeliberacao: null,
          },
          {
            id: null,
            identificadorLocal: 'banca-teste',
            copiaDoTipo: null,
            tipoBancaId: 'banca-hetero',
            categoriasDocumentoIds: ['renda', 'raca'],
            regraDeDeliberacao: null,
          },
        ],
      }),
    );

    expect(problemas).toEqual([]);
  });

  it('aceita duas bancas do mesmo tipo com recortes que as distinguem', () => {
    expect(
      conferir(
        fase({
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              tipoBancaId: 'banca-hetero',
              categoriasDocumentoIds: ['raca'],
              regraDeDeliberacao: null,
            },
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              tipoBancaId: 'banca-hetero',
              categoriasDocumentoIds: ['renda'],
              regraDeDeliberacao: null,
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('cobra o tipo da banca em branco', () => {
    const problemas = campos(
      fase({
        bancasRequeridas: [
          {
            id: null,
            identificadorLocal: 'banca-teste',
            copiaDoTipo: null,
            tipoBancaId: '',
            categoriasDocumentoIds: [],
            regraDeDeliberacao: null,
          },
        ],
      }),
    );

    expect(problemas).toContain<CampoDaFase>('bancasRequeridas');
  });

  describe('regra de deliberação da banca', () => {
    const comRegra = (...bancas: FaseDoCronograma['bancasRequeridas']) =>
      conferir(fase({ bancasRequeridas: bancas }));
    const banca = (
      regraDeDeliberacao: RegraDeDeliberacaoDaBanca | null,
      tipoBancaId = 'banca-hetero',
    ) => ({
      id: null,
      identificadorLocal: 'banca-teste',
      copiaDoTipo: null,
      tipoBancaId,
      categoriasDocumentoIds: [],
      regraDeDeliberacao,
    });

    it('não cobra a banca sem regra: ela só é exigida na publicação', () => {
      expect(comRegra(banca(null))).toEqual([]);
    });

    it('aceita a regra completa', () => {
      expect(comRegra(banca(COLEGIADA), banca(ATO_INDIVIDUAL, 'banca-redacao'))).toEqual([]);
    });

    it('cobra o campo da regra sob a posição da banca que o tem em branco', () => {
      const problemas = comRegra(
        banca(COLEGIADA),
        banca({ ...COLEGIADA, criterio: '', quorum: '9' }, 'banca-redacao'),
      );

      expect(problemas.map((problema) => problema.campo)).toEqual([
        'bancasRequeridas.1.criterio',
        'bancasRequeridas.1.quorum',
      ]);
    });
  });
});

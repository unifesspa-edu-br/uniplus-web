import { describe, expect, it } from 'vitest';

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

describe('conclusão do ciclo recursal', () => {
  const PRELIMINAR = { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' };
  const DEFINITIVO = { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' };

  it('fase que publica preliminar e definitiva conclui a si mesma, sem declarar nada', () => {
    expect(conferir(fase({ produtos: [PRELIMINAR, DEFINITIVO] }))).toEqual([]);
  });

  it('cobra a fase concluinte de quem publica preliminar sem a definitiva', () => {
    const problemas = conferir(fase({ produtos: [PRELIMINAR] }));

    expect(problemas[0].campo).toBe<CampoDaFase>('faseConcluinteCodigo');
    expect(problemas[0].mensagem).toContain('declare qual fase conclui o ciclo recursal');
  });

  it('aceita a concluinte que publica definitiva e vem depois', () => {
    const recursos = fase({
      faseCanonicaId: 'id-2',
      codigo: 'RECURSOS',
      ordem: 2,
      produtos: [DEFINITIVO],
    });

    expect(
      conferir(fase({ produtos: [PRELIMINAR], faseConcluinteCodigo: 'RECURSOS' }), [recursos]),
    ).toEqual([]);
  });

  it('recusa a concluinte que não publica resultado definitivo', () => {
    const recursos = fase({ faseCanonicaId: 'id-2', codigo: 'RECURSOS', ordem: 2, produtos: [] });
    const problemas = conferir(fase({ produtos: [PRELIMINAR], faseConcluinteCodigo: 'RECURSOS' }), [
      recursos,
    ]);

    expect(problemas[0].mensagem).toContain('não publica resultado definitivo');
  });

  it('recusa a concluinte que vem antes na linha do tempo', () => {
    const antes = fase({
      faseCanonicaId: 'id-0',
      codigo: 'ANTERIOR',
      ordem: 1,
      produtos: [DEFINITIVO],
    });
    const problemas = conferir(
      fase({ ordem: 2, produtos: [PRELIMINAR], faseConcluinteCodigo: 'ANTERIOR' }),
      [antes],
    );

    expect(problemas[0].mensagem).toContain('vem antes desta na linha do tempo');
  });

  it('recusa a concluinte que não está no cronograma', () => {
    const problemas = conferir(fase({ produtos: [PRELIMINAR], faseConcluinteCodigo: 'AUSENTE' }));

    expect(problemas[0].mensagem).toContain('não está no cronograma');
  });

  it('recusa a fase que declara a si mesma como concluinte', () => {
    const problemas = conferir(fase({ produtos: [PRELIMINAR], faseConcluinteCodigo: 'AVALIACAO' }));

    expect(problemas[0].mensagem).toContain('não conclui a si mesma por declaração');
  });

  it('recusa conclusão declarada por fase que não publica preliminar', () => {
    const problemas = conferir(fase({ produtos: [DEFINITIVO], faseConcluinteCodigo: 'RECURSOS' }));

    expect(problemas[0].campo).toBe<CampoDaFase>('faseConcluinteCodigo');
    expect(problemas[0].mensagem).toContain('Só fase que publica resultado preliminar');
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
        fase({ bancasRequeridas: [{ tipoBancaId: 'banca-hetero', categoriasDocumentoIds: [] }] }),
      ),
    ).toEqual([]);
  });

  it('exige recorte quando a fase requer duas bancas do mesmo tipo', () => {
    const problemas = conferir(
      fase({
        bancasRequeridas: [
          { tipoBancaId: 'banca-hetero', categoriasDocumentoIds: ['raca'] },
          { tipoBancaId: 'banca-hetero', categoriasDocumentoIds: [] },
        ],
      }),
    );

    expect(problemas[0].campo).toBe<CampoDaFase>('bancasRequeridas');
    expect(problemas[0].mensagem).toContain('mais de uma banca de Heteroidentificação');
  });

  it('recusa duas bancas do mesmo tipo com recortes idênticos', () => {
    const problemas = conferir(
      fase({
        bancasRequeridas: [
          { tipoBancaId: 'banca-hetero', categoriasDocumentoIds: ['raca', 'renda'] },
          { tipoBancaId: 'banca-hetero', categoriasDocumentoIds: ['renda', 'raca'] },
        ],
      }),
    );

    expect(problemas[0].mensagem).toContain('mesmo recorte de competência');
  });

  it('aceita duas bancas do mesmo tipo com recortes que as distinguem', () => {
    expect(
      conferir(
        fase({
          bancasRequeridas: [
            { tipoBancaId: 'banca-hetero', categoriasDocumentoIds: ['raca'] },
            { tipoBancaId: 'banca-hetero', categoriasDocumentoIds: ['renda'] },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('cobra o tipo da banca em branco', () => {
    const problemas = campos(
      fase({ bancasRequeridas: [{ tipoBancaId: '', categoriasDocumentoIds: [] }] }),
    );

    expect(problemas).toContain<CampoDaFase>('bancasRequeridas');
  });
});

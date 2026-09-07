import { describe, expect, it } from 'vitest';

import type { ProblemDetails } from '@uniplus/shared-core/http';

import type { FaseDoCronograma, RecursoDaFase } from '../../processo-seletivo.models';
import {
  problemasDaFase,
  traduzirRecusa,
  type AtoDoCatalogo,
  type CampoDaFase,
} from './configuracao-da-fase';

const CATALOGO: ReadonlyMap<string, AtoDoCatalogo> = new Map([
  ['RESULTADO_PRELIMINAR', { nome: 'Resultado preliminar', ehResultado: true }],
  ['GABARITO_PRELIMINAR', { nome: 'Gabarito preliminar', ehResultado: true }],
  ['RESULTADO_FINAL', { nome: 'Resultado final', ehResultado: true }],
  ['COMUNICADO', { nome: 'Comunicado', ehResultado: false }],
]);

function fase(parcial: Partial<FaseDoCronograma> = {}): FaseDoCronograma {
  return {
    faseCanonicaId: 'id-1',
    codigo: 'AVALIACAO',
    ordem: 1,
    inicio: null,
    fim: null,
    produtos: [],
    faseConcluinteCodigo: null,
    emiteParecerIndividual: false,
    bancasRequeridas: [],
    regraRecurso: null,
    congelados: null,
    ...parcial,
  };
}

function recurso(parcial: Partial<RecursoDaFase> = {}): RecursoDaFase {
  return {
    regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
    regraVersao: 'v1',
    prazoValor: '2',
    prazoUnidade: 'diasUteis',
    atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
    suspensividadePrimeiraInstanciaValor: '',
    suspensividadePrimeiraInstanciaUnidade: '',
    suspensividadeSegundaInstanciaValor: '',
    suspensividadeSegundaInstanciaUnidade: '',
    ...parcial,
  };
}

const nomeDaBanca = (id: string): string => (id === 'banca-hetero' ? 'Heteroidentificação' : id);

function conferir(alvo: FaseDoCronograma, outras: readonly FaseDoCronograma[] = []) {
  return problemasDaFase(alvo, [alvo, ...outras], CATALOGO, nomeDaBanca);
}

function campos(alvo: FaseDoCronograma, outras: readonly FaseDoCronograma[] = []) {
  return conferir(alvo, outras).map((problema) => problema.campo);
}

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
      'A fase não pode declarar o mesmo tipo de ato mais de uma vez.',
    );
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

describe('regra de recurso', () => {
  const comPreliminar = (parcial: Partial<RecursoDaFase> = {}): FaseDoCronograma =>
    fase({
      produtos: [
        { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
        { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
      ],
      regraRecurso: recurso(parcial),
    });

  it('regra completa e coerente não relata problema', () => {
    expect(conferir(comPreliminar())).toEqual([]);
  });

  it('recusa prazo de interposição em dias corridos', () => {
    const problemas = conferir(comPreliminar({ prazoUnidade: 'dias' }));

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.prazo');
    expect(problemas[0].mensagem).toContain('dias corridos não é aceito');
  });

  it('recusa fração de dia útil no prazo de interposição', () => {
    const problemas = conferir(comPreliminar({ prazoValor: '1,5' }));

    expect(problemas[0].mensagem).toContain('dias úteis exige valor inteiro');
  });

  it('recusa prazo não positivo', () => {
    const problemas = conferir(comPreliminar({ prazoValor: '0' }));

    expect(problemas[0].mensagem).toContain('maior que zero');
  });

  it('cobra a unidade do prazo', () => {
    const problemas = conferir(comPreliminar({ prazoUnidade: '' }));

    expect(problemas.map((problema) => problema.mensagem)).toContain(
      'Declare a unidade do prazo de interposição: dias úteis ou horas.',
    );
  });

  it('cobra a regra de contagem escolhida no catálogo', () => {
    const problemas = conferir(comPreliminar({ regraCodigo: '' }));

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.regra');
  });

  it('recusa suspensividade com metade do par preenchida', () => {
    const problemas = conferir(comPreliminar({ suspensividadePrimeiraInstanciaValor: '3' }));

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.suspensividadePrimeiraInstancia');
    expect(problemas[0].mensagem).toContain('valor e unidade juntos');
  });

  it('aceita o par de suspensividade inteiro em branco como desativação', () => {
    expect(conferir(comPreliminar())).toEqual([]);
  });

  /**
   * A âncora é escolhida entre os preliminares da própria fase. Sem nenhum, o
   * problema é a publicação que falta — não a escolha.
   */
  it('aponta a publicação preliminar que falta quando a fase admite recurso sem ter uma', () => {
    const problemas = conferir(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
        regraRecurso: recurso({ atoAncoraCodigo: '' }),
      }),
    );

    expect(problemas.map((problema) => problema.campo)).toContain<CampoDaFase>('produtos');
  });

  it('cobra a escolha da âncora quando a fase publica dois preliminares', () => {
    const problemas = conferir(
      fase({
        produtos: [
          { atoCodigo: 'GABARITO_PRELIMINAR', papel: 'PRELIMINAR' },
          { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
          { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
        ],
        regraRecurso: recurso({ atoAncoraCodigo: '' }),
      }),
    );

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.ancora');
    expect(problemas[0].mensagem).toContain('Escolha a publicação preliminar');
  });

  it('recusa a âncora que a fase não publica como preliminar', () => {
    const problemas = conferir(comPreliminar({ atoAncoraCodigo: 'RESULTADO_FINAL' }));

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.ancora');
    expect(problemas[0].mensagem).toContain('publicado por esta própria fase');
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

describe('tradução das recusas do domínio', () => {
  function recusa(erros: readonly { field: string; code: string }[]): ProblemDetails {
    return {
      type: 'about:blank',
      title: 'Configuração recusada',
      status: 422,
      code: 'uniplus.selecao.processo_seletivo.cronograma_invalido',
      traceId: '00000000000000000000000000000001',
      errors: erros.map((erro) => ({ ...erro, message: 'detalhe do servidor' })),
    };
  }

  const nomeDaFase = (indice: number): string => (indice === 0 ? 'Avaliação' : 'Recursos');

  it('leva a recusa da fase aberta para o campo que ela nomeia', () => {
    const traduzida = traduzirRecusa(
      recusa([
        {
          field: 'fases[0].regraRecurso',
          code: 'uniplus.selecao.regra_recurso_fase.prazo_em_dias_corridos',
        },
      ]),
      0,
      nomeDaFase,
    );

    expect(traduzida.porCampo.get('recurso.prazo')).toContain('dias corridos não é aceito');
    expect(traduzida.gerais).toEqual([]);
  });

  /**
   * Apontar no controle à vista uma recusa que é de outra fase mandaria
   * corrigir o que não está errado.
   */
  it('manda ao resumo, nomeando a fase, a recusa que é de outra', () => {
    const traduzida = traduzirRecusa(
      recusa([
        {
          field: 'fases[1].faseConcluinteCodigo',
          code: 'uniplus.selecao.processo_seletivo.conclusao_nao_declarada',
        },
      ]),
      0,
      nomeDaFase,
    );

    expect(traduzida.porCampo.size).toBe(0);
    expect(traduzida.gerais[0]).toContain('Na fase Recursos');
  });

  it('traduz a recusa da âncora que não é preliminar da própria fase', () => {
    const traduzida = traduzirRecusa(
      recusa([
        {
          field: 'fases[0].regraRecurso.atoAncoraCodigo',
          code: 'uniplus.selecao.regra_recurso_fase.ancora_nao_eh_produto_preliminar_da_fase',
        },
      ]),
      0,
      nomeDaFase,
    );

    expect(traduzida.porCampo.get('recurso.ancora')).toContain('esta própria fase');
  });

  it('traduz a recusa do recorte obrigatório entre bancas do mesmo tipo', () => {
    const traduzida = traduzirRecusa(
      recusa([
        {
          field: 'fases[0].bancasRequeridas[1]',
          code: 'uniplus.selecao.banca_requerida.recorte_de_competencia_obrigatorio',
        },
      ]),
      0,
      nomeDaFase,
    );

    expect(traduzida.porCampo.get('bancasRequeridas')).toContain(
      'categorias de documento que julga',
    );
  });

  /** Esconder a recusa seria pior do que exibi-la genérica. */
  it('manda ao resumo o código que ainda não tem tradução', () => {
    const traduzida = traduzirRecusa(
      recusa([{ field: 'fases[0]', code: 'uniplus.selecao.fase_cronograma.codigo_inventado' }]),
      0,
      nomeDaFase,
    );

    expect(traduzida.gerais).toEqual(['Configuração recusada']);
  });

  it('devolve o título quando a recusa não traz campo algum', () => {
    const semCampos: ProblemDetails = {
      type: 'about:blank',
      title: 'Processo não está em rascunho',
      status: 409,
      code: 'uniplus.selecao.processo_seletivo.mutacao_nao_permitida',
      traceId: '00000000000000000000000000000002',
    };

    expect(traduzirRecusa(semCampos, 0, nomeDaFase).gerais).toEqual([
      'Processo não está em rascunho',
    ]);
  });
});

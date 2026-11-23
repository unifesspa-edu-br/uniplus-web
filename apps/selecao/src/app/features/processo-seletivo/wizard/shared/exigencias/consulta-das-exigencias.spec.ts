import { describe, expect, it } from 'vitest';

import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  RegraDeComprovacao,
} from '../../processo-seletivo.models';
import {
  exigenciasDaFase,
  exigenciasLocalizadasDaFase,
  gruposQueDecidem,
  gruposSemNormaResolvida,
} from './consulta-das-exigencias';
import { baseLegalNova, regraDeDocumento, semAExigencia, semAFase } from './exigencias-documentais';
import {
  ID_CONTRACHEQUE,
  ID_DIPLOMA,
  ID_RG,
  exigencia,
  rascunho,
  regraDoRascunho,
} from './exigencias.testing';

describe('onde cada exigência está no conjunto de regras', () => {
  /** Um grupo de alternativas com duas alternativas, como a configuração o traz. */
  function comGrupoDeAlternativas(
    documentos: readonly ExigenciaDeDocumento[],
    patch: Partial<RegraDeComprovacao> = {},
  ): ExigenciasDoRascunho {
    return {
      regrasDeComprovacao: [
        regraDoRascunho({
          forma: 'QUANTIDADE_MINIMA_DE_ITENS',
          itens: documentos.map(regraDeDocumento),
          ...patch,
        }),
      ],
      emTodasAsFases: [],
    };
  }

  /**
   * A regra de documento de dentro de um grupo não é exigida por si — basta satisfazer o grupo. Enquanto a
   * lista a mostrava igual a uma exigência solta, as duas pareciam a mesma coisa.
   */
  it('diz a que grupo a regra de documento pertence', () => {
    const localizadas = exigenciasLocalizadasDaFase(
      comGrupoDeAlternativas([exigencia(), exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })]),
      'HABILITACAO',
    );

    expect(localizadas).toHaveLength(2);
    expect(localizadas[0].grupo).toEqual({
      forma: 'QUANTIDADE_MINIMA_DE_ITENS',
      quantidadeMinima: null,
      alternativas: 2,
    });
  });

  it('seleciona documentos da fase em grupos aninhados, preservando a ordem', () => {
    const primeira = exigencia();
    const outraFase = exigencia({ tipoDocumentoId: ID_DIPLOMA, faseCodigo: 'ISENCAO' });
    const ultima = exigencia({ tipoDocumentoId: ID_CONTRACHEQUE });
    const grupo = comGrupoDeAlternativas([outraFase, ultima]).regrasDeComprovacao[0];
    const conjunto = comGrupoDeAlternativas([], { itens: [regraDeDocumento(primeira), grupo] });

    expect(exigenciasDaFase(conjunto, 'HABILITACAO')).toEqual([primeira, ultima]);
  });

  it('resume grupos decisivos aninhados e suas fases na ordem de declaração', () => {
    const interno = comGrupoDeAlternativas([exigencia({ faseCodigo: 'ISENCAO' })], {
      consequencia: 'INDEFERIMENTO',
      basesLegais: [],
    }).regrasDeComprovacao[0];
    const conjunto = comGrupoDeAlternativas([], {
      consequencia: 'INDEFERIMENTO',
      basesLegais: [],
      itens: [regraDeDocumento(exigencia()), interno],
    });

    expect(gruposQueDecidem(conjunto).map((grupo) => grupo.fases)).toEqual([
      ['HABILITACAO', 'ISENCAO'],
      ['ISENCAO'],
    ]);
  });

  it('exigência solta não tem grupo', () => {
    const localizadas = exigenciasLocalizadasDaFase(rascunho(exigencia()), 'HABILITACAO');

    expect(localizadas).toHaveLength(1);
    expect(localizadas[0].grupo).toBeNull();
  });

  /**
   * O mesmo documento declarado solto E dentro de um grupo são duas exigências distintas — a
   * lista as colapsava numa linha só, e editar essa linha mexia numa das duas por acaso da
   * ordem.
   */
  it('não colapsa o documento declarado solto e dentro de um grupo', () => {
    const comAsDuas: ExigenciasDoRascunho = {
      regrasDeComprovacao: [
        ...comGrupoDeAlternativas([exigencia(), exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })])
          .regrasDeComprovacao,
        regraDeDocumento(exigencia()),
      ],
      emTodasAsFases: [],
    };

    const doRg = exigenciasLocalizadasDaFase(comAsDuas, 'HABILITACAO').filter(
      (achada) => achada.documento.tipoDocumentoId === ID_RG,
    );

    expect(doRg).toHaveLength(2);
    expect(doRg[0].grupo?.forma).toBe('QUANTIDADE_MINIMA_DE_ITENS');
    expect(doRg[1].grupo).toBeNull();
  });

  /**
   * A publicação cobra do grupo que decide o resultado a mesma norma que cobra da exigência
   * individual. Sem espelhar, a pessoa descobre no último passo sem saber de qual grupo se
   * trata.
   */
  it('acusa o grupo que decide o resultado sem norma resolvida', () => {
    const pendentes = gruposSemNormaResolvida(
      comGrupoDeAlternativas([exigencia(), exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })], {
        consequencia: 'INDEFERIMENTO',
        basesLegais: [],
      }),
    );

    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].documentos).toEqual([ID_RG, ID_CONTRACHEQUE]);
  });

  it('grupo sem consequência própria não precisa de norma', () => {
    expect(gruposSemNormaResolvida(comGrupoDeAlternativas([exigencia()]))).toEqual([]);
  });

  /**
   * O caminho real da redução: o operador tira da fase um dos documentos de um grupo que pedia
   * duas alternativas. Sem reduzir, o grupo continuaria pedindo duas com uma só, o agregado
   * recusaria, e a recusa chegaria depois de etapas, cronograma e formulário já gravados —
   * falando de um campo que esta tela não mostra, e sem conserto: reacrescentar o documento o
   * põe na regra principal, não de volta no grupo.
   */
  it('a quantidade mínima do grupo acompanha a saída de uma das alternativas', () => {
    const comTres = comGrupoDeAlternativas(
      [
        exigencia(),
        exigencia({ tipoDocumentoId: ID_CONTRACHEQUE }),
        exigencia({ tipoDocumentoId: ID_DIPLOMA }),
      ],
      { quantidadeMinima: 2 },
    );

    const comDuas = semAExigencia(comTres, ID_DIPLOMA, 'HABILITACAO');
    expect(comDuas.regrasDeComprovacao[0].itens).toHaveLength(2);
    expect(comDuas.regrasDeComprovacao[0].quantidadeMinima).toBe(2);

    const comUma = semAExigencia(comDuas, ID_CONTRACHEQUE, 'HABILITACAO');
    expect(comUma.regrasDeComprovacao[0].itens).toHaveLength(1);
    expect(comUma.regrasDeComprovacao[0].quantidadeMinima).toBe(1);
  });

  /** Reduzir é teto, não piso: o grupo que não encolheu mantém o que pedia. */
  it('a quantidade mínima não muda quando o grupo não encolheu', () => {
    const comDois = comGrupoDeAlternativas(
      [exigencia(), exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })],
      {
        quantidadeMinima: 2,
      },
    );

    expect(semAFase(comDois, 'ISENCAO').regrasDeComprovacao[0].quantidadeMinima).toBe(2);
  });

  /** Grupo transparente nunca declara quantidade, e a poda não pode inventar uma. */
  it('grupo que exige todos os itens continua sem quantidade mínima depois da poda', () => {
    const conjunto: ExigenciasDoRascunho = {
      regrasDeComprovacao: [
        {
          ...comGrupoDeAlternativas([exigencia(), exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })])
            .regrasDeComprovacao[0],
          forma: 'TODOS_OS_ITENS',
        },
      ],
      emTodasAsFases: [],
    };

    const comUma = semAExigencia(conjunto, ID_CONTRACHEQUE, 'HABILITACAO');
    expect(comUma.regrasDeComprovacao[0].quantidadeMinima).toBeNull();
  });

  /** Um grupo pode reunir outros grupos — contar só as regras de documento diretas diria "uma das 1". */
  it('conta como alternativa o item que é outro grupo', () => {
    const comGrupoInterno: ExigenciasDoRascunho = {
      regrasDeComprovacao: [
        {
          ...comGrupoDeAlternativas([exigencia()]).regrasDeComprovacao[0],
          itens: [
            regraDeDocumento(exigencia()),
            comGrupoDeAlternativas([exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })])
              .regrasDeComprovacao[0],
          ],
        },
      ],
      emTodasAsFases: [],
    };

    const localizadas = exigenciasLocalizadasDaFase(comGrupoInterno, 'HABILITACAO');
    expect(localizadas[0].grupo?.alternativas).toBe(2);
  });

  /** Grupo cujos itens são grupos ficava sem nome nenhum na mensagem que deveria nomeá-lo. */
  it('nomeia os documentos de toda a grupo de regras do grupo', () => {
    const comGrupoInterno: ExigenciasDoRascunho = {
      regrasDeComprovacao: [
        {
          ...comGrupoDeAlternativas([exigencia()], {
            consequencia: 'INDEFERIMENTO',
            basesLegais: [],
          }).regrasDeComprovacao[0],
          itens: [
            comGrupoDeAlternativas([exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })])
              .regrasDeComprovacao[0],
          ],
        },
      ],
      emTodasAsFases: [],
    };

    expect(gruposSemNormaResolvida(comGrupoInterno)[0].documentos).toEqual([ID_CONTRACHEQUE]);
  });

  it('grupo com norma resolvida não é acusado', () => {
    const pendentes = gruposSemNormaResolvida(
      comGrupoDeAlternativas([exigencia()], {
        consequencia: 'INDEFERIMENTO',
        basesLegais: [{ ...baseLegalNova(), referencia: 'Lei 12.711/2012' }],
      }),
    );

    expect(pendentes).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  NoDeExigencia,
} from '../../processo-seletivo.models';
import { exigenciasLocalizadasDaFase, gruposSemNormaResolvida } from './consulta-das-exigencias';
import { baseLegalNova, folhaDe, semAExigencia, semAFase } from './exigencias-documentais';
import { ID_CONTRACHEQUE, ID_DIPLOMA, ID_RG, exigencia, rascunho } from './exigencias.testing';

describe('onde cada exigência está na árvore', () => {
  /** Um grupo OU com duas alternativas, como a configuração o traz. */
  function comGrupoOu(
    documentos: readonly ExigenciaDeDocumento[],
    patch: Partial<NoDeExigencia> = {},
  ): ExigenciasDoRascunho {
    return {
      raizes: [
        {
          tipo: 'OU',
          documento: null,
          quantidadeMinima: null,
          consequencia: null,
          basesLegais: null,
          filhos: documentos.map(folhaDe),
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
          ...patch,
        },
      ],
      emTodasAsFases: [],
    };
  }

  /**
   * A folha de dentro de um grupo não é exigida por si — basta satisfazer o grupo. Enquanto a
   * lista a mostrava igual a uma exigência solta, as duas pareciam a mesma coisa.
   */
  it('diz a que grupo a folha pertence', () => {
    const localizadas = exigenciasLocalizadasDaFase(
      comGrupoOu([exigencia(), exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })]),
      'HABILITACAO',
    );

    expect(localizadas).toHaveLength(2);
    expect(localizadas[0].grupo).toEqual({ tipo: 'OU', quantidadeMinima: null, alternativas: 2 });
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
      raizes: [
        ...comGrupoOu([exigencia(), exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })]).raizes,
        folhaDe(exigencia()),
      ],
      emTodasAsFases: [],
    };

    const doRg = exigenciasLocalizadasDaFase(comAsDuas, 'HABILITACAO').filter(
      (achada) => achada.documento.tipoDocumentoId === ID_RG,
    );

    expect(doRg).toHaveLength(2);
    expect(doRg[0].grupo?.tipo).toBe('OU');
    expect(doRg[1].grupo).toBeNull();
  });

  /**
   * A publicação cobra do grupo que decide o resultado a mesma norma que cobra da exigência
   * individual. Sem espelhar, a pessoa descobre no último passo sem saber de qual grupo se
   * trata.
   */
  it('acusa o grupo que decide o resultado sem norma resolvida', () => {
    const pendentes = gruposSemNormaResolvida(
      comGrupoOu([exigencia(), exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })], {
        consequencia: 'INDEFERIMENTO',
        basesLegais: [],
      }),
    );

    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].documentos).toEqual([ID_RG, ID_CONTRACHEQUE]);
  });

  it('grupo sem consequência própria não precisa de norma', () => {
    expect(gruposSemNormaResolvida(comGrupoOu([exigencia()]))).toEqual([]);
  });

  /**
   * O caminho real da redução: o operador tira da fase um dos documentos de um grupo que pedia
   * duas alternativas. Sem reduzir, o grupo continuaria pedindo duas com uma só, o agregado
   * recusaria, e a recusa chegaria depois de etapas, cronograma e formulário já gravados —
   * falando de um campo que esta tela não mostra, e sem conserto: reacrescentar o documento o
   * põe na raiz, não de volta no grupo.
   */
  it('a quantidade mínima do grupo acompanha a saída de uma das alternativas', () => {
    const comTres = comGrupoOu(
      [
        exigencia(),
        exigencia({ tipoDocumentoId: ID_CONTRACHEQUE }),
        exigencia({ tipoDocumentoId: ID_DIPLOMA }),
      ],
      { quantidadeMinima: 2 },
    );

    const comDuas = semAExigencia(comTres, ID_DIPLOMA, 'HABILITACAO');
    expect(comDuas.raizes[0].filhos).toHaveLength(2);
    expect(comDuas.raizes[0].quantidadeMinima).toBe(2);

    const comUma = semAExigencia(comDuas, ID_CONTRACHEQUE, 'HABILITACAO');
    expect(comUma.raizes[0].filhos).toHaveLength(1);
    expect(comUma.raizes[0].quantidadeMinima).toBe(1);
  });

  /** Reduzir é teto, não piso: o grupo que não encolheu mantém o que pedia. */
  it('a quantidade mínima não muda quando o grupo não encolheu', () => {
    const comDois = comGrupoOu([exigencia(), exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })], {
      quantidadeMinima: 2,
    });

    expect(semAFase(comDois, 'ISENCAO').raizes[0].quantidadeMinima).toBe(2);
  });

  /** Grupo transparente nunca declara quantidade, e a poda não pode inventar uma. */
  it('grupo E continua sem quantidade mínima depois da poda', () => {
    const conjunto: ExigenciasDoRascunho = {
      raizes: [
        {
          ...comGrupoOu([exigencia(), exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })]).raizes[0],
          tipo: 'E',
        },
      ],
      emTodasAsFases: [],
    };

    const comUma = semAExigencia(conjunto, ID_CONTRACHEQUE, 'HABILITACAO');
    expect(comUma.raizes[0].quantidadeMinima).toBeNull();
  });

  /** Um grupo pode reunir outros grupos — contar só as folhas diretas diria "uma das 1". */
  it('conta como alternativa o filho que é outro grupo', () => {
    const aninhado: ExigenciasDoRascunho = {
      raizes: [
        {
          ...comGrupoOu([exigencia()]).raizes[0],
          filhos: [
            folhaDe(exigencia()),
            comGrupoOu([exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })]).raizes[0],
          ],
        },
      ],
      emTodasAsFases: [],
    };

    const localizadas = exigenciasLocalizadasDaFase(aninhado, 'HABILITACAO');
    expect(localizadas[0].grupo?.alternativas).toBe(2);
  });

  /** Grupo cujos filhos são grupos ficava sem nome nenhum na mensagem que deveria nomeá-lo. */
  it('nomeia os documentos de toda a subárvore do grupo', () => {
    const aninhado: ExigenciasDoRascunho = {
      raizes: [
        {
          ...comGrupoOu([exigencia()], {
            consequencia: 'INDEFERIMENTO',
            basesLegais: [],
          }).raizes[0],
          filhos: [comGrupoOu([exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })]).raizes[0]],
        },
      ],
      emTodasAsFases: [],
    };

    expect(gruposSemNormaResolvida(aninhado)[0].documentos).toEqual([ID_CONTRACHEQUE]);
  });

  it('grupo com norma resolvida não é acusado', () => {
    const pendentes = gruposSemNormaResolvida(
      comGrupoOu([exigencia()], {
        consequencia: 'INDEFERIMENTO',
        basesLegais: [{ ...baseLegalNova(), referencia: 'Lei 12.711/2012' }],
      }),
    );

    expect(pendentes).toEqual([]);
  });
});

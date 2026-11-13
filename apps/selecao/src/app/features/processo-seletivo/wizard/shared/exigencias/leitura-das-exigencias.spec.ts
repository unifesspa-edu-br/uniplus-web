import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { ExigenciasDoRascunho } from '../../processo-seletivo.models';
import { exigenciasDaFase, exigenciasDaRaiz, todasAsExigencias } from './consulta-das-exigencias';
import { comExigenciaNaRaiz, exigenciaNova, semAFase } from './exigencias-documentais';
import { arvoreDeExigencias } from './gravacao-das-exigencias';
import { exigenciasDe } from './leitura-das-exigencias';
import { modalidadesDaExigencia } from './recorte-por-modalidade';
import {
  ETAPAS_VIVAS,
  FASES,
  FINALIDADES_POR_FASE,
  ID_ETAPA_RENDA,
  ID_HABILITACAO,
  ID_ISENCAO,
  ID_RG,
  comando,
} from './exigencias.testing';

describe('exigenciasDe — do processo de volta ao rascunho', () => {
  function detalhe(raizes: readonly unknown[]): ProcessoSeletivoDto {
    return {
      cronogramaFases: [
        { id: ID_ISENCAO, codigo: 'ISENCAO' },
        { id: ID_HABILITACAO, codigo: 'HABILITACAO' },
      ],
      raizesExigencia: raizes,
    } as unknown as ProcessoSeletivoDto;
  }

  function folhaDto(patch: Record<string, unknown> = {}) {
    return {
      id: 'no-1',
      tipo: 'FOLHA',
      quantidadeMinima: null,
      consequencia: null,
      basesLegais: [],
      filhos: [],
      chaveDistincao: null,
      dataReferencia: null,
      ocorrenciasEsperadas: null,
      repetePorEntidade: null,
      documento: {
        id: 'doc-1',
        exigidoNaFaseId: ID_HABILITACAO,
        tipoDocumentoOrigemId: ID_RG,
        aplicabilidade: 'GERAL',
        obrigatorio: true,
        consequenciaIndeferimento: null,
        condicoes: [],
        basesLegais: [],
        idadeMaximaEmissao: null,
        formatosPermitidos: 'QUALQUER',
        tamanhoMaximoBytes: null,
        exigidoNaEtapaId: null,
        modelo: null,
        ...patch,
      },
    };
  }

  /**
   * A perda central: a API guarda uma exigência por (documento, fase) e o rascunho as
   * achatava num registro por documento. Entrega, consequência e norma da segunda fase
   * voltavam com o valor da primeira, e a gravação seguinte reescrevia as duas iguais.
   */
  it('mantém separadas as duas exigências do mesmo documento em fases diferentes', () => {
    const lido = exigenciasDe(
      detalhe([
        folhaDto({
          exigidoNaFaseId: ID_ISENCAO,
          obrigatorio: true,
          consequenciaIndeferimento: 'ELIMINA',
        }),
        folhaDto({
          exigidoNaFaseId: ID_HABILITACAO,
          obrigatorio: false,
          consequenciaIndeferimento: null,
        }),
      ]),
    );

    const naIsencao = exigenciasDaFase(lido, 'ISENCAO');
    const naHabilitacao = exigenciasDaFase(lido, 'HABILITACAO');

    expect(naIsencao).toHaveLength(1);
    expect(naHabilitacao).toHaveLength(1);
    expect(naIsencao[0].obrigatorio).toBe(true);
    expect(naIsencao[0].consequenciaIndeferimento).toBe('ELIMINA');
    expect(naHabilitacao[0].obrigatorio).toBe(false);
    expect(naHabilitacao[0].consequenciaIndeferimento).toBe('');
  });

  /**
   * "Vale em todas as fases" não trafega — o contrato recebe as folhas já materializadas. Sem
   * reler a intenção, reabrir o processo a rebaixava a uma escolha fase a fase, e a fase criada
   * depois disso ficava sem o documento, sem nada na tela denunciando a ausência.
   */
  it('relê o alcance de todas as fases do documento presente em cada uma', () => {
    const lido = exigenciasDe(
      detalhe([
        folhaDto({ exigidoNaFaseId: ID_ISENCAO }),
        folhaDto({ exigidoNaFaseId: ID_HABILITACAO }),
      ]),
    );

    expect(lido.emTodasAsFases).toEqual([ID_RG]);
  });

  /**
   * Estar em todas as fases não é declarar alcance global: o certame pode exigir o mesmo
   * documento em cada uma por razões próprias. Lidas como alcance global, a fase criada depois
   * receberia uma cópia arbitrária de uma dessas declarações — configuração que ninguém pediu.
   */
  it('não infere alcance global quando as declarações por fase divergem', () => {
    const lido = exigenciasDe(
      detalhe([
        folhaDto({ exigidoNaFaseId: ID_ISENCAO, obrigatorio: true }),
        folhaDto({ exigidoNaFaseId: ID_HABILITACAO, obrigatorio: false }),
      ]),
    );

    expect(lido.emTodasAsFases).toEqual([]);
  });

  /**
   * O modelo oferecido é conteúdo da exigência: lidas como alcance global, a fase criada depois
   * receberia o modelo de uma das fases, ou nenhum, sem que ninguém o tivesse escolhido.
   */
  it('não infere alcance global quando as fases oferecem modelos diferentes', () => {
    const modelo = {
      modeloId: 'modelo-1',
      nomeArquivo: 'autodeclaracao.odt',
      formato: 'ODT',
      hashSha256: 'a'.repeat(64),
      urlDownload: null,
    };
    const lido = exigenciasDe(
      detalhe([
        folhaDto({ exigidoNaFaseId: ID_ISENCAO, modelo }),
        folhaDto({ exigidoNaFaseId: ID_HABILITACAO }),
      ]),
    );

    expect(lido.emTodasAsFases).toEqual([]);
  });

  /**
   * A repetição é da folha: "um por membro" numa fase e "um por candidato" noutra são declarações
   * diferentes, e lidas como alcance global a gravação seguinte igualaria as duas sem ninguém pedir.
   */
  it('não infere alcance global quando só uma fase repete o documento por um grupo', () => {
    const lido = exigenciasDe(
      detalhe([
        { ...folhaDto({ exigidoNaFaseId: ID_ISENCAO }), repetePorEntidade: 'FAMILIA' },
        folhaDto({ exigidoNaFaseId: ID_HABILITACAO }),
      ]),
    );

    expect(lido.emTodasAsFases).toEqual([]);
  });

  /**
   * Exigido numa fase e apenas ALTERNATIVO noutra não é alcance global. Lido como se fosse, a
   * gravação seguinte materializaria exigências novas — a alternativa do grupo viraria
   * documento cobrado, e uma fase criada depois também o cobraria.
   */
  it('não infere alcance global de documento que noutra fase é só alternativa de grupo', () => {
    const lido = exigenciasDe(
      detalhe([
        folhaDto({ exigidoNaFaseId: ID_ISENCAO }),
        {
          id: 'grupo-1',
          tipo: 'OU',
          quantidadeMinima: 1,
          consequencia: null,
          basesLegais: [],
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
          documento: null,
          filhos: [folhaDto({ exigidoNaFaseId: ID_HABILITACAO })],
        },
      ]),
    );

    // A folha do grupo foi lida — a árvore está inteira —, mas não conta como declaração.
    expect(exigenciasDaFase(lido, 'HABILITACAO')).toHaveLength(1);
    expect(lido.emTodasAsFases).toEqual([]);
  });

  /**
   * A marca de alcance global precisa de um modelo de onde copiar. Removida a última fase que
   * tinha a declaração de raiz, ela fica órfã: a tela segue anunciando o documento como
   * exigido, a materialização não tem de onde copiá-lo, e a gravação sai sem ele — sem nada
   * dizendo que a exigência deixou de existir.
   */
  it('a marca de todas as fases cai com a última declaração que lhe servia de modelo', () => {
    const global: ExigenciasDoRascunho = {
      emTodasAsFases: [ID_RG],
      raizes: [
        {
          tipo: 'FOLHA',
          documento: exigenciaNova(ID_RG, 'HABILITACAO'),
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
    };

    const semHabilitacao = semAFase(global, 'HABILITACAO');

    expect(semHabilitacao.raizes).toEqual([]);
    expect(semHabilitacao.emTodasAsFases).toEqual([]);
  });

  /** Havendo outra declaração de raiz, a marca continua: ainda há de onde copiar. */
  it('a marca de todas as fases sobrevive enquanto resta uma declaração de raiz', () => {
    const global: ExigenciasDoRascunho = {
      emTodasAsFases: [ID_RG],
      raizes: [
        {
          tipo: 'FOLHA',
          documento: exigenciaNova(ID_RG, 'HABILITACAO'),
          quantidadeMinima: null,
          consequencia: null,
          basesLegais: null,
          filhos: null,
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
        },
        {
          tipo: 'FOLHA',
          documento: exigenciaNova(ID_RG, 'ISENCAO'),
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
    };

    expect(semAFase(global, 'HABILITACAO').emTodasAsFases).toEqual([ID_RG]);
  });

  /**
   * O acréscimo em raiz não pode passar pela substituição que percorre a árvore: ela troca a
   * PRIMEIRA folha que casa por (documento, fase), e essa primeira pode ser a alternativa
   * dentro de um grupo OU. Sobrescrevê-la transformaria "este documento serve" em "este
   * documento é exigido" — e a raiz continuaria sem a declaração prometida.
   */
  it('acrescenta na raiz sem tocar na alternativa homônima do grupo', () => {
    const comGrupo: ExigenciasDoRascunho = {
      emTodasAsFases: [],
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
              documento: exigenciaNova(ID_RG, 'HABILITACAO'),
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

    const comRaiz = comExigenciaNaRaiz(comGrupo, exigenciaNova(ID_RG, 'HABILITACAO'));

    expect(comRaiz.raizes, 'o grupo continua, e a declaração de raiz nasce ao lado').toHaveLength(
      2,
    );
    expect(comRaiz.raizes[0].tipo).toBe('OU');
    expect(comRaiz.raizes[0].filhos).toHaveLength(1);
    expect(exigenciasDaRaiz(comRaiz).map((e) => e.tipoDocumentoId)).toEqual([ID_RG]);
  });

  /** Presente em uma fase só, entre duas, é escolha explícita — e continua sendo. */
  it('não inventa alcance de todas as fases para o documento de uma fase só', () => {
    const lido = exigenciasDe(detalhe([folhaDto({ exigidoNaFaseId: ID_HABILITACAO })]));

    expect(lido.emTodasAsFases).toEqual([]);
  });

  /** As normas 2..N eram descartadas: a leitura lia só `basesLegais[0]`. */
  it('lê todas as normas da exigência, e a observação de cada uma', () => {
    const lido = exigenciasDe(
      detalhe([
        folhaDto({
          basesLegais: [
            {
              id: 'b1',
              referencia: 'Lei 12.711/2012',
              abrangencia: 'FEDERAL',
              status: 'RESOLVIDO',
              observacao: 'cotas',
            },
            {
              id: 'b2',
              referencia: 'Edital 01/2027',
              abrangencia: 'INTERNA_EDITAL',
              status: 'PENDENTE',
              observacao: null,
            },
          ],
        }),
      ]),
    );

    const bases = exigenciasDaFase(lido, 'HABILITACAO')[0].basesLegais;
    expect(bases).toHaveLength(2);
    expect(bases[0]).toEqual({
      referencia: 'Lei 12.711/2012',
      abrangencia: 'FEDERAL',
      status: 'RESOLVIDO',
      observacao: 'cotas',
    });
    expect(bases[1].status).toBe('PENDENTE');
    // A ausência chega e fica como `null`, a mesma da norma recém-declarada.
    expect(bases[1].observacao).toBeNull();
  });

  it('guarda a fase pelo código, não pelo identificador', () => {
    const lido = exigenciasDe(detalhe([folhaDto()]));
    expect(todasAsExigencias(lido)[0].faseCodigo).toBe('HABILITACAO');
  });

  it('traz a etapa que coleta, quando declarada', () => {
    const lido = exigenciasDe(detalhe([folhaDto({ exigidoNaEtapaId: ID_ETAPA_RENDA })]));
    expect(todasAsExigencias(lido)[0].etapaId).toBe(ID_ETAPA_RENDA);
  });

  it('reconstrói o recorte de modalidade a partir do gatilho', () => {
    const lido = exigenciasDe(
      detalhe([
        folhaDto({
          aplicabilidade: 'CONDICIONAL',
          condicoes: [
            { id: 'c1', clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["LB_PPI"]' },
          ],
        }),
      ]),
    );

    expect(modalidadesDaExigencia(todasAsExigencias(lido)[0])).toEqual(['LB_PPI']);
  });

  it('descarta a exigência cuja fase não está no cronograma lido', () => {
    const lido = exigenciasDe(detalhe([folhaDto({ exigidoNaFaseId: 'fase-desconhecida' })]));
    expect(todasAsExigencias(lido)).toHaveLength(0);
  });

  /** O ida-e-volta completo: ler e regravar não pode mudar nada. */
  it('lê o formulário declarado e o regrava', () => {
    const lido = exigenciasDe(
      detalhe([folhaDto({ exigidoNaFaseId: ID_ISENCAO, finalidade: 'ISENCAO_TAXA' })]),
    );

    expect(comando(lido)[0].documento?.finalidade).toBe('ISENCAO_TAXA');
  });

  it('lê e regrava sem perder nada', () => {
    const lido = exigenciasDe(
      detalhe([
        folhaDto({
          exigidoNaEtapaId: ID_ETAPA_RENDA,
          obrigatorio: false,
          consequenciaIndeferimento: 'PENDENCIA_REENVIO',
          basesLegais: [
            {
              id: 'b1',
              referencia: 'Lei 12.711/2012',
              abrangencia: 'FEDERAL',
              status: 'RESOLVIDO',
              observacao: 'cotas',
            },
            {
              id: 'b2',
              referencia: 'Edital 01/2027',
              abrangencia: 'INTERNA_EDITAL',
              status: 'RESOLVIDO',
              observacao: null,
            },
          ],
          formatosPermitidos: ['PDF'],
          tamanhoMaximoBytes: 3000000,
        }),
      ]),
    );

    const raizes = arvoreDeExigencias(lido, {
      faseIdPorCodigo: FASES,
      modalidadesOfertadas: ['AC'],
      etapasVivas: ETAPAS_VIVAS,
      finalidadesPorFase: FINALIDADES_POR_FASE,
    });

    expect(raizes[0].documento).toMatchObject({
      exigidoNaFaseId: ID_HABILITACAO,
      exigidoNaEtapaId: ID_ETAPA_RENDA,
      tipoDocumentoId: ID_RG,
      obrigatorio: false,
      consequenciaIndeferimento: 'PENDENCIA_REENVIO',
      formatosPermitidos: ['PDF'],
      tamanhoMaximoBytes: 3000000,
    });
    expect(raizes[0].documento?.basesLegais).toHaveLength(2);
    expect(raizes[0].documento?.basesLegais[0].observacao).toBe('cotas');
  });

  /** O `PUT` substitui a árvore inteira: o modelo que não volta no comando é desvinculado. */
  it('regrava o modelo de documento que a exigência oferece', () => {
    const modelo = {
      modeloId: '01960000-0000-7000-0000-00000000a0de',
      nomeArquivo: 'autodeclaracao.docx',
      formato: 'DOCX',
      hashSha256: 'ab'.repeat(32),
    };
    const lido = exigenciasDe(detalhe([folhaDto({ modelo })]));

    const raizes = arvoreDeExigencias(lido, {
      faseIdPorCodigo: FASES,
      modalidadesOfertadas: ['AC'],
      etapasVivas: ETAPAS_VIVAS,
      finalidadesPorFase: FINALIDADES_POR_FASE,
    });

    expect(raizes[0].documento?.modeloId).toBe(modelo.modeloId);
  });
});

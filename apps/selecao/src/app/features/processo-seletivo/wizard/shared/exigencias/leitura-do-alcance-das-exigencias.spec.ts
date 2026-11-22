import { FormaDeComprovacaoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { ModeloDaExigenciaDto } from '@uniplus/shared-data/selecao';

import type { ExigenciasDoRascunho } from '../../processo-seletivo.models';
import { exigenciasDaFase, exigenciasSemGrupo } from './consulta-das-exigencias';
import {
  comExigenciaSemGrupo,
  exigenciaNova,
  regraDeDocumento,
  semAFase,
} from './exigencias-documentais';
import { exigenciasDe } from './leitura-das-exigencias';
import {
  ID_HABILITACAO,
  ID_ISENCAO,
  ID_RG,
  detalheDaApi,
  exigenciaDaApi,
  regraDoRascunho,
} from './exigencias.testing';

describe('Alcance da exigência de documento entre fases', () => {
  /**
   * "Vale em todas as fases" não trafega — o contrato recebe as regras de documento já materializadas. Sem
   * reler a intenção, reabrir o processo a rebaixava a uma escolha fase a fase, e a fase criada
   * depois disso ficava sem o documento, sem nada na tela denunciando a ausência.
   */
  it('relê o alcance de todas as fases do documento presente em cada uma', () => {
    const lido = exigenciasDe(
      detalheDaApi([
        exigenciaDaApi({ faseId: ID_ISENCAO }),
        exigenciaDaApi({ faseId: ID_HABILITACAO }),
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
      detalheDaApi([
        exigenciaDaApi({ faseId: ID_ISENCAO, indeferimento: { obrigatorio: true } }),
        exigenciaDaApi({ faseId: ID_HABILITACAO, indeferimento: { obrigatorio: false } }),
      ]),
    );

    expect(lido.emTodasAsFases).toEqual([]);
  });

  /**
   * O modelo oferecido é conteúdo da exigência: lidas como alcance global, a fase criada depois
   * receberia o modelo de uma das fases, ou nenhum, sem que ninguém o tivesse escolhido.
   */
  it('não infere alcance global quando as fases oferecem modelos diferentes', () => {
    const modelo: ModeloDaExigenciaDto = {
      modeloId: 'modelo-1',
      nomeArquivo: 'autodeclaracao.odt',
      formato: 'ODT',
      hashSha256: 'a'.repeat(64),
    };
    const lido = exigenciasDe(
      detalheDaApi([
        exigenciaDaApi({ faseId: ID_ISENCAO, requisitos: { modelo } }),
        exigenciaDaApi({ faseId: ID_HABILITACAO }),
      ]),
    );

    expect(lido.emTodasAsFases).toEqual([]);
  });

  /**
   * A repetição é da regra de documento: "um por membro" numa fase e "um por candidato" noutra são declarações
   * diferentes, e lidas como alcance global a gravação seguinte igualaria as duas sem ninguém pedir.
   */
  it('não infere alcance global quando só uma fase repete o documento por um grupo', () => {
    const lido = exigenciasDe(
      detalheDaApi([
        { ...exigenciaDaApi({ faseId: ID_ISENCAO }), grupoDoFormularioParaRepeticao: 'FAMILIA' },
        exigenciaDaApi({ faseId: ID_HABILITACAO }),
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
      detalheDaApi([
        exigenciaDaApi({ faseId: ID_ISENCAO }),
        {
          id: 'grupo-1',
          forma: {
            codigo: FormaDeComprovacaoCodigo.QUANTIDADE_MINIMA_DE_ITENS,
            rotulo: 'Quantidade mínima',
          },
          cardinalidade: { quantidadeMinima: 1, distincao: null },
          indeferimento: { consequencia: null, basesLegais: [] },
          grupoDoFormularioParaRepeticao: null,
          documento: null,
          itens: [exigenciaDaApi({ faseId: ID_HABILITACAO })],
        },
      ]),
    );

    // A regra de documento do grupo foi lida — a estrutura de regras está inteira —, mas não conta como declaração.
    expect(exigenciasDaFase(lido, 'HABILITACAO')).toHaveLength(1);
    expect(lido.emTodasAsFases).toEqual([]);
  });

  /**
   * A marca de alcance global precisa de um modelo de onde copiar. Removida a última fase que
   * tinha a declaração de regra principal, ela fica órfã: a tela segue anunciando o documento como
   * exigido, a materialização não tem de onde copiá-lo, e a gravação sai sem ele — sem nada
   * dizendo que a exigência deixou de existir.
   */
  it('a marca de todas as fases cai com a última declaração que lhe servia de modelo', () => {
    const global: ExigenciasDoRascunho = {
      emTodasAsFases: [ID_RG],
      regrasDeComprovacao: [regraDeDocumento(exigenciaNova(ID_RG, 'HABILITACAO'))],
    };

    const semHabilitacao = semAFase(global, 'HABILITACAO');

    expect(semHabilitacao.regrasDeComprovacao).toEqual([]);
    expect(semHabilitacao.emTodasAsFases).toEqual([]);
  });

  /** Havendo outra declaração de regra principal, a marca continua: ainda há de onde copiar. */
  it('a marca de todas as fases sobrevive enquanto resta uma declaração de regra principal', () => {
    const global: ExigenciasDoRascunho = {
      emTodasAsFases: [ID_RG],
      regrasDeComprovacao: [
        regraDeDocumento(exigenciaNova(ID_RG, 'HABILITACAO')),
        regraDeDocumento(exigenciaNova(ID_RG, 'ISENCAO')),
      ],
    };

    expect(semAFase(global, 'HABILITACAO').emTodasAsFases).toEqual([ID_RG]);
  });

  /**
   * O acréscimo em regra principal não pode passar pela substituição que percorre a estrutura de regras: ela troca a
   * PRIMEIRA regra de documento que casa por (documento, fase), e essa primeira pode ser a alternativa
   * dentro de um grupo de alternativas. Sobrescrevê-la transformaria "este documento serve" em "este
   * documento é exigido" — e a regra principal continuaria sem a declaração prometida.
   */
  it('acrescenta na regra principal sem tocar na alternativa homônima do grupo', () => {
    const comGrupo: ExigenciasDoRascunho = {
      emTodasAsFases: [],
      regrasDeComprovacao: [
        regraDoRascunho({
          forma: 'QUANTIDADE_MINIMA_DE_ITENS',
          quantidadeMinima: 1,
          itens: [regraDeDocumento(exigenciaNova(ID_RG, 'HABILITACAO'))],
        }),
      ],
    };

    const comRegraPrincipal = comExigenciaSemGrupo(comGrupo, exigenciaNova(ID_RG, 'HABILITACAO'));

    expect(
      comRegraPrincipal.regrasDeComprovacao,
      'o grupo continua, e a declaração sem grupo nasce ao lado',
    ).toHaveLength(2);
    expect(comRegraPrincipal.regrasDeComprovacao[0].forma).toBe('QUANTIDADE_MINIMA_DE_ITENS');
    expect(comRegraPrincipal.regrasDeComprovacao[0].itens).toHaveLength(1);
    expect(exigenciasSemGrupo(comRegraPrincipal).map((e) => e.tipoDocumentoId)).toEqual([ID_RG]);
  });

  /** Presente em uma fase só, entre duas, é escolha explícita — e continua sendo. */
  it('não inventa alcance de todas as fases para o documento de uma fase só', () => {
    const lido = exigenciasDe(detalheDaApi([exigenciaDaApi({ faseId: ID_HABILITACAO })]));

    expect(lido.emTodasAsFases).toEqual([]);
  });
});

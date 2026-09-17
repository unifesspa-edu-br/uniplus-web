import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  NoDeExigencia,
} from '../processo-seletivo.models';
import {
  arvoreDeExigencias,
  baseLegalNova,
  comAlcanceDeTodasAsFases,
  comExigencia,
  comExigenciaNaRaiz,
  comModalidades,
  exigenciaNova,
  exigenciasDaFase,
  exigenciasDaRaiz,
  exigenciasDe,
  exigenciasLocalizadasDaFase,
  folhaDe,
  formatosDeclarados,
  gruposSemNormaResolvida,
  modalidadesDaExigencia,
  semAEtapa,
  semAExigencia,
  semAFase,
  todasAsExigencias,
} from './exigencias-documentais';

const ID_ISENCAO = '01960000-0000-7000-0000-0000000000f1';
const ID_HABILITACAO = '01960000-0000-7000-0000-0000000000f2';
const ID_ETAPA_RENDA = '01960000-0000-7000-0000-0000000000e1';
const ID_RG = '01960000-0000-7000-0000-0000000000d1';
const ID_CONTRACHEQUE = '01960000-0000-7000-0000-0000000000d2';
const ID_DIPLOMA = '01960000-0000-7000-0000-0000000000d3';

/** As etapas que o processo tem hoje — é contra elas que a exigência aponta. */
const ETAPAS_VIVAS = new Set([ID_ETAPA_RENDA]);

const FASES = new Map([
  ['ISENCAO', ID_ISENCAO],
  ['HABILITACAO', ID_HABILITACAO],
]);

/** O cadastro de tipos de documento, de onde saem formato aceito e tamanho máximo. */
const RESTRICAO_RG = { formatosAceitos: 'PDF,JPEG,PNG', tamanhoMaximoMb: 5 };

function exigencia(patch: Partial<ExigenciaDeDocumento> = {}): ExigenciaDeDocumento {
  return { ...exigenciaNova(ID_RG, 'HABILITACAO', RESTRICAO_RG), ...patch };
}

function rascunho(...exigencias: readonly ExigenciaDeDocumento[]): ExigenciasDoRascunho {
  return exigencias.reduce<ExigenciasDoRascunho>(
    (acumulado, atual) => comExigencia(acumulado, atual),
    { raizes: [], emTodasAsFases: [] },
  );
}

function comando(rascunhoDado: ExigenciasDoRascunho, modalidades: readonly string[] = ['AC']) {
  return arvoreDeExigencias(rascunhoDado, FASES, modalidades, ETAPAS_VIVAS);
}

describe('arvoreDeExigencias — do rascunho para o comando', () => {
  it('manda uma folha por exigência declarada', () => {
    const raizes = comando(
      rascunho(exigencia({ faseCodigo: 'ISENCAO' }), exigencia({ faseCodigo: 'HABILITACAO' })),
    );

    expect(raizes).toHaveLength(2);
    expect(raizes.map((raiz) => raiz.documento?.exigidoNaFaseId)).toEqual([
      ID_ISENCAO,
      ID_HABILITACAO,
    ]);
    expect(raizes.every((raiz) => raiz.tipo === 'FOLHA')).toBe(true);
  });

  it('resolve a fase pelo código, que é o que sobrevive à reconciliação do servidor', () => {
    const raizes = comando(rascunho(exigencia({ faseCodigo: 'ISENCAO' })));
    expect(raizes[0].documento?.exigidoNaFaseId).toBe(ID_ISENCAO);
  });

  it('leva a etapa que coleta o documento naquela fase', () => {
    const raizes = comando(rascunho(exigencia({ etapaId: ID_ETAPA_RENDA })));
    expect(raizes[0].documento?.exigidoNaEtapaId).toBe(ID_ETAPA_RENDA);
  });

  it('descarta a exigência cuja fase saiu do cronograma', () => {
    const raizes = comando(rascunho(exigencia({ faseCodigo: 'RECURSOS' })));
    expect(raizes).toHaveLength(0);
  });

  it('devolve o documento à fase inteira quando a etapa que o coletava saiu', () => {
    const raizes = comando(rascunho(exigencia({ etapaId: 'etapa-que-nao-existe-mais' })));
    expect(raizes[0].documento?.exigidoNaEtapaId).toBeNull();
  });

  it('sem recorte de modalidade, o documento é exigido de todo candidato', () => {
    const raizes = comando(rascunho(exigencia()));
    expect(raizes[0].documento?.aplicabilidade).toBe('GERAL');
    expect(raizes[0].documento?.condicoes).toEqual([]);
  });

  it('o recorte de modalidade vira a cláusula do gatilho', () => {
    const raizes = comando(
      rascunho(comModalidades(exigencia(), ['LB_PPI'])),
      ['AC', 'LB_PPI'],
    );

    expect(raizes[0].documento?.aplicabilidade).toBe('CONDICIONAL');
    expect(raizes[0].documento?.condicoes).toEqual([
      { clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["LB_PPI"]' },
    ]);
  });

  /**
   * O recorte esvaziado pelo quadro de vagas NÃO vira "exigido de todos": alargar em silêncio o
   * alcance de um documento é decisão de negócio que ninguém tomou. A cláusula sai — o agregado
   * recusa cláusula vazia —, a aplicabilidade declarada permanece, e o preflight acusa que a
   * exigência não alcança modalidade nenhuma.
   */
  it('recorte esvaziado pelo quadro de vagas não alarga o alcance sozinho', () => {
    const raizes = comando(rascunho(comModalidades(exigencia(), ['LB_PPI'])), ['AC']);
    expect(raizes[0].documento?.aplicabilidade).toBe('CONDICIONAL');
    expect(raizes[0].documento?.condicoes).toEqual([]);
  });

  /**
   * O recorte que passou a cobrir toda a oferta só é podado quando resta outra condição
   * sustentando a exigência. Sem ela, podá-lo deixaria uma exigência "de quem satisfaz" com
   * gatilho vazio — cobrada de ninguém —, e o documento sumiria do edital em silêncio por
   * causa de uma mudança no quadro de vagas que ninguém ligou a ele.
   */
  it('recorte que cobre toda a oferta é preservado quando é a única condição', () => {
    const raizes = comando(rascunho(comModalidades(exigencia(), ['AC'])), ['AC']);
    expect(raizes[0].documento?.condicoes).toEqual([
      { clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["AC"]' },
    ]);
  });

  /** Havendo outra condição, o recorte redundante sai e a exigência acompanha o quadro. */
  it('recorte que cobre toda a oferta sai quando outra condição sustenta a exigência', () => {
    const porSexo = exigencia({
      aplicabilidade: 'CONDICIONAL',
      condicoes: [{ clausula: 1, fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' }],
    });

    const raizes = comando(rascunho(comModalidades(porSexo, ['AC'])), ['AC']);

    expect(raizes[0].documento?.condicoes).toEqual([
      { clausula: 1, fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' },
    ]);
  });

  /**
   * O controle de "quem deve entregar" só sabe reescrever a cláusula que ele próprio escreve.
   * Uma comparação de modalidade de outra forma — que o domínio aceita e este wizard não
   * escreve — sobrevive, em vez de ser apagada no servidor a cada gravação.
   */
  it('comparação de modalidade que a tela não escreve sobrevive ao ida-e-volta', () => {
    const porOutraForma = exigencia({
      aplicabilidade: 'CONDICIONAL',
      condicoes: [{ clausula: 1, fato: 'MODALIDADE', operador: 'IGUAL', valor: '"AC"' }],
    });

    const raizes = comando(rascunho(porOutraForma), ['AC', 'LB_PPI']);

    expect(raizes[0].documento?.condicoes).toEqual([
      { clausula: 1, fato: 'MODALIDADE', operador: 'IGUAL', valor: '"AC"' },
    ]);
  });

  /**
   * Exigido de todos descarta TODA condição, não só a de modalidade: o agregado recusa a
   * exigência geral que carrega gatilho, e antes disto uma condição sobre outro fato viajava
   * junto com a aplicabilidade rebaixada.
   */
  it('exigida de todos não carrega condição nenhuma', () => {
    const comCondicaoDeOutroFato = exigencia({
      aplicabilidade: 'GERAL',
      condicoes: [{ clausula: 0, fato: 'SEXO', operador: 'IGUAL', valor: '"MASCULINO"' }],
    });

    const raizes = comando(rascunho(comCondicaoDeOutroFato));

    expect(raizes[0].documento?.aplicabilidade).toBe('GERAL');
    expect(raizes[0].documento?.condicoes).toEqual([]);
  });

  /** Condição sobre fato que não é modalidade sobrevive ao ida-e-volta. */
  it('preserva a condição por fato do candidato', () => {
    const porSexo = exigencia({
      aplicabilidade: 'CONDICIONAL',
      condicoes: [{ clausula: 0, fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' }],
    });

    const raizes = comando(rascunho(porSexo));

    expect(raizes[0].documento?.aplicabilidade).toBe('CONDICIONAL');
    expect(raizes[0].documento?.condicoes).toEqual([
      { clausula: 0, fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' },
    ]);
  });

  it('formato e tamanho vêm do cadastro do tipo de documento', () => {
    const raizes = comando(rascunho(exigencia()));
    expect(raizes[0].documento?.formatosPermitidos).toEqual(['PDF', 'JPEG', 'PNG']);
    expect(raizes[0].documento?.tamanhoMaximoBytes).toBe(5 * 1024 * 1024);
  });

  it('tipo sem restrição declarada aceita qualquer formato, sem teto', () => {
    const raizes = comando(rascunho(exigenciaNova(ID_CONTRACHEQUE, 'HABILITACAO')));
    expect(raizes[0].documento?.formatosPermitidos).toBe('QUALQUER');
    expect(raizes[0].documento?.tamanhoMaximoBytes).toBeNull();
  });

  it('a obrigatoriedade e a consequência acompanham a exigência', () => {
    const raizes = comando(
      rascunho(exigencia({ obrigatorio: false, consequenciaIndeferimento: 'ELIMINA' })),
    );
    expect(raizes[0].documento?.obrigatorio).toBe(false);
    expect(raizes[0].documento?.consequenciaIndeferimento).toBe('ELIMINA');
  });

  it('consequência vazia vira ausência, não texto vazio', () => {
    const raizes = comando(rascunho(exigencia({ consequenciaIndeferimento: '' })));
    expect(raizes[0].documento?.consequenciaIndeferimento).toBeNull();
  });

  /**
   * A perda que motivou a frente: o contrato aceita N normas por exigência (ADR-0074), e o
   * rascunho guardava três campos escalares — a segunda norma não tinha onde existir.
   */
  it('manda TODAS as normas declaradas, não só a primeira', () => {
    const raizes = comando(
      rascunho(
        exigencia({
          basesLegais: [
            { referencia: 'Lei 12.711/2012', abrangencia: 'FEDERAL', status: 'RESOLVIDO', observacao: '' },
            { referencia: 'Edital 01/2027, art. 4º', abrangencia: 'INTERNA_EDITAL', status: 'RESOLVIDO', observacao: 'cláusula do certame' },
          ],
        }),
      ),
    );

    expect(raizes[0].documento?.basesLegais).toEqual([
      { referencia: 'Lei 12.711/2012', abrangencia: 'FEDERAL', status: 'RESOLVIDO', observacao: null },
      {
        referencia: 'Edital 01/2027, art. 4º',
        abrangencia: 'INTERNA_EDITAL',
        status: 'RESOLVIDO',
        observacao: 'cláusula do certame',
      },
    ]);
  });

  it('norma em branco não viaja — é linha do formulário, não declaração', () => {
    const raizes = comando(rascunho(exigencia()));
    expect(raizes[0].documento?.basesLegais).toEqual([]);
  });

  /** O grupo `OU` e a consequência própria dele sobrevivem a um salvamento que não os toca. */
  it('preserva o grupo OU que a tela não edita', () => {
    const grupo: ExigenciasDoRascunho = {
      emTodasAsFases: [],
      raizes: [
        {
          tipo: 'OU',
          documento: null,
          quantidadeMinima: 1,
          consequencia: 'ELIMINA',
          basesLegais: [
            { referencia: 'Lei 12.711/2012', abrangencia: 'FEDERAL', status: 'RESOLVIDO', observacao: '' },
          ],
          filhos: [
            { tipo: 'FOLHA', documento: exigencia(), quantidadeMinima: null, consequencia: null, basesLegais: null, filhos: null, chaveDistincao: null, dataReferencia: null, ocorrenciasEsperadas: null, repetePorEntidade: null },
          ],
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
        },
      ],
    };

    const raizes = comando(grupo);
    expect(raizes).toHaveLength(1);
    expect(raizes[0].tipo).toBe('OU');
    expect(raizes[0].consequencia).toBe('ELIMINA');
    expect(raizes[0].quantidadeMinima).toBe(1);
    expect(raizes[0].basesLegais).toHaveLength(1);
    expect(raizes[0].filhos).toHaveLength(1);
  });

  /**
   * "Vale em todas as fases" é exigência em cada uma. O mesmo documento pode estar na fase como
   * ALTERNATIVA dentro de um grupo OU — ali ele é uma das saídas possíveis, não uma exigência.
   * Aceitar essa folha como satisfeita transformava "este documento é exigido" em "este
   * documento serve", sem nada na tela dizendo.
   */
  it('materializa o alcance global mesmo onde o documento só aparece dentro de um grupo OU', () => {
    const comGrupo: ExigenciasDoRascunho = {
      emTodasAsFases: [ID_RG],
      raizes: [
        { tipo: 'FOLHA', documento: exigenciaNova(ID_RG, 'ISENCAO'), quantidadeMinima: null, consequencia: null, basesLegais: null, filhos: null, chaveDistincao: null, dataReferencia: null, ocorrenciasEsperadas: null, repetePorEntidade: null },
        {
          tipo: 'OU',
          documento: null,
          quantidadeMinima: 1,
          consequencia: null,
          basesLegais: null,
          filhos: [
            { tipo: 'FOLHA', documento: exigenciaNova(ID_RG, 'HABILITACAO'), quantidadeMinima: null, consequencia: null, basesLegais: null, filhos: null, chaveDistincao: null, dataReferencia: null, ocorrenciasEsperadas: null, repetePorEntidade: null },
          ],
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
        },
      ],
    };

    const completas = comAlcanceDeTodasAsFases(comGrupo, ['ISENCAO', 'HABILITACAO']);

    // A folha do grupo continua onde estava, e a exigência de raiz passa a existir ao lado.
    expect(exigenciasDaFase(completas, 'HABILITACAO')).toHaveLength(2);
    expect(
      completas.raizes.filter(
        (no) => no.tipo === 'FOLHA' && no.documento?.faseCodigo === 'HABILITACAO',
      ),
    ).toHaveLength(1);
  });

  /** Grupo que perdeu todos os filhos sai junto — o servidor recusa grupo vazio. */
  it('colapsa o grupo que ficou sem filho', () => {
    const grupo: ExigenciasDoRascunho = {
      emTodasAsFases: [],
      raizes: [
        {
          tipo: 'OU',
          documento: null,
          quantidadeMinima: 1,
          consequencia: null,
          basesLegais: null,
          filhos: [
            { tipo: 'FOLHA', documento: exigencia({ faseCodigo: 'FASE_QUE_SAIU' }), quantidadeMinima: null, consequencia: null, basesLegais: null, filhos: null, chaveDistincao: null, dataReferencia: null, ocorrenciasEsperadas: null, repetePorEntidade: null },
          ],
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
        },
      ],
    };

    expect(comando(grupo)).toHaveLength(0);
  });

  /** A cardinalidade qualificada da folha viaja intocada — a tela não a edita. */
  it('preserva cardinalidade e repetição por entidade da folha', () => {
    const comCardinalidade: ExigenciasDoRascunho = {
      emTodasAsFases: [],
      raizes: [
        {
          tipo: 'FOLHA',
          documento: exigencia(),
          quantidadeMinima: 3,
          consequencia: null,
          basesLegais: null,
          filhos: null,
          chaveDistincao: 'COMPETENCIA_MENSAL',
          dataReferencia: '2027-03-01',
          ocorrenciasEsperadas: null,
          repetePorEntidade: 'MEMBRO_FAMILIA',
        },
      ],
    };

    const raizes = comando(comCardinalidade);
    expect(raizes[0].quantidadeMinima).toBe(3);
    expect(raizes[0].chaveDistincao).toBe('COMPETENCIA_MENSAL');
    expect(raizes[0].dataReferencia).toBe('2027-03-01');
    expect(raizes[0].repetePorEntidade).toBe('MEMBRO_FAMILIA');
  });

  /** A idade máxima ancorada em fase que saiu perde a âncora, em vez de recusar a gravação. */
  it('limpa a âncora de idade máxima cuja fase saiu do cronograma', () => {
    const raizes = comando(
      rascunho(
        exigencia({
          idadeMaximaEmissao: {
            valor: 90,
            unidade: 'DIAS',
            referenciaTipo: 'INICIO_FASE',
            data: null,
            referenciaFaseCodigo: 'FASE_QUE_SAIU',
          },
        }),
      ),
    );

    expect(raizes[0].documento?.idadeMaximaEmissao).toBeNull();
  });

  it('resolve a âncora de idade máxima para o id da fase viva', () => {
    const raizes = comando(
      rascunho(
        exigencia({
          idadeMaximaEmissao: {
            valor: 90,
            unidade: 'DIAS',
            referenciaTipo: 'INICIO_FASE',
            data: null,
            referenciaFaseCodigo: 'ISENCAO',
          },
        }),
      ),
    );

    expect(raizes[0].documento?.idadeMaximaEmissao?.referenciaFaseId).toBe(ID_ISENCAO);
  });
});

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
        folhaDto({ exigidoNaFaseId: ID_ISENCAO, obrigatorio: true, consequenciaIndeferimento: 'ELIMINA' }),
        folhaDto({ exigidoNaFaseId: ID_HABILITACAO, obrigatorio: false, consequenciaIndeferimento: null }),
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
        { tipo: 'FOLHA', documento: exigenciaNova(ID_RG, 'HABILITACAO'), quantidadeMinima: null, consequencia: null, basesLegais: null, filhos: null, chaveDistincao: null, dataReferencia: null, ocorrenciasEsperadas: null, repetePorEntidade: null },
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
        { tipo: 'FOLHA', documento: exigenciaNova(ID_RG, 'HABILITACAO'), quantidadeMinima: null, consequencia: null, basesLegais: null, filhos: null, chaveDistincao: null, dataReferencia: null, ocorrenciasEsperadas: null, repetePorEntidade: null },
        { tipo: 'FOLHA', documento: exigenciaNova(ID_RG, 'ISENCAO'), quantidadeMinima: null, consequencia: null, basesLegais: null, filhos: null, chaveDistincao: null, dataReferencia: null, ocorrenciasEsperadas: null, repetePorEntidade: null },
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
            { tipo: 'FOLHA', documento: exigenciaNova(ID_RG, 'HABILITACAO'), quantidadeMinima: null, consequencia: null, basesLegais: null, filhos: null, chaveDistincao: null, dataReferencia: null, ocorrenciasEsperadas: null, repetePorEntidade: null },
          ],
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
        },
      ],
    };

    const comRaiz = comExigenciaNaRaiz(comGrupo, exigenciaNova(ID_RG, 'HABILITACAO'));

    expect(comRaiz.raizes).toHaveLength(2, 'o grupo continua, e a declaração de raiz nasce ao lado');
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
            { id: 'b1', referencia: 'Lei 12.711/2012', abrangencia: 'FEDERAL', status: 'RESOLVIDO', observacao: 'cotas' },
            { id: 'b2', referencia: 'Edital 01/2027', abrangencia: 'INTERNA_EDITAL', status: 'PENDENTE', observacao: null },
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
    expect(bases[1].observacao).toBe('');
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
          condicoes: [{ id: 'c1', clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["LB_PPI"]' }],
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
  it('lê e regrava sem perder nada', () => {
    const lido = exigenciasDe(
      detalhe([
        folhaDto({
          exigidoNaEtapaId: ID_ETAPA_RENDA,
          obrigatorio: false,
          consequenciaIndeferimento: 'PENDENCIA_REENVIO',
          basesLegais: [
            { id: 'b1', referencia: 'Lei 12.711/2012', abrangencia: 'FEDERAL', status: 'RESOLVIDO', observacao: 'cotas' },
            { id: 'b2', referencia: 'Edital 01/2027', abrangencia: 'INTERNA_EDITAL', status: 'RESOLVIDO', observacao: null },
          ],
          formatosPermitidos: ['PDF'],
          tamanhoMaximoBytes: 3000000,
        }),
      ]),
    );

    const raizes = arvoreDeExigencias(lido, FASES, ['AC'], ETAPAS_VIVAS);

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
});

describe('operações sobre a árvore do rascunho', () => {
  it('semAFase tira a exigência daquela fase e deixa a das outras', () => {
    const antes = rascunho(
      exigencia({ faseCodigo: 'ISENCAO' }),
      exigencia({ faseCodigo: 'HABILITACAO' }),
    );

    const depois = semAFase(antes, 'ISENCAO');
    expect(todasAsExigencias(depois)).toHaveLength(1);
    expect(todasAsExigencias(depois)[0].faseCodigo).toBe('HABILITACAO');
  });

  it('semAEtapa devolve o documento à fase inteira', () => {
    const depois = semAEtapa(rascunho(exigencia({ etapaId: ID_ETAPA_RENDA })), ID_ETAPA_RENDA);
    expect(todasAsExigencias(depois)[0].etapaId).toBeNull();
  });

  it('semAExigencia remove só o par (documento, fase) indicado', () => {
    const antes = rascunho(
      exigencia({ faseCodigo: 'ISENCAO' }),
      exigencia({ faseCodigo: 'HABILITACAO' }),
    );

    const depois = semAExigencia(antes, ID_RG, 'ISENCAO');
    expect(todasAsExigencias(depois)).toHaveLength(1);
    expect(todasAsExigencias(depois)[0].faseCodigo).toBe('HABILITACAO');
  });

  it('comExigencia substitui a existente em vez de duplicar', () => {
    const antes = rascunho(exigencia());
    const depois = comExigencia(antes, exigencia({ obrigatorio: false }));

    expect(todasAsExigencias(depois)).toHaveLength(1);
    expect(todasAsExigencias(depois)[0].obrigatorio).toBe(false);
  });
});

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
            { tipo: 'FOLHA', documento: exigencia({ faseCodigo: 'HABILITACAO' }), quantidadeMinima: null, consequencia: null, basesLegais: null, filhos: null, chaveDistincao: null, dataReferencia: null, ocorrenciasEsperadas: null, repetePorEntidade: null },
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

describe('edição não atropela a folha homônima do grupo', () => {
  /** O mesmo documento pode estar solto e como alternativa de um `OU` na mesma fase. */
  function soltaEAgrupada(): ExigenciasDoRascunho {
    return {
      emTodasAsFases: [],
      raizes: [
        { tipo: 'FOLHA', documento: exigencia({ obrigatorio: true }), quantidadeMinima: null, consequencia: null, basesLegais: null, filhos: null, chaveDistincao: null, dataReferencia: null, ocorrenciasEsperadas: null, repetePorEntidade: null },
        {
          tipo: 'OU',
          documento: null,
          quantidadeMinima: 1,
          consequencia: null,
          basesLegais: null,
          filhos: [
            { tipo: 'FOLHA', documento: exigencia({ obrigatorio: true }), quantidadeMinima: null, consequencia: null, basesLegais: null, filhos: null, chaveDistincao: null, dataReferencia: null, ocorrenciasEsperadas: null, repetePorEntidade: null },
          ],
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
        },
      ],
    };
  }

  it('comExigencia troca só a primeira folha que casa', () => {
    const depois = comExigencia(soltaEAgrupada(), exigencia({ obrigatorio: false }));
    const todas = todasAsExigencias(depois);

    expect(todas).toHaveLength(2);
    expect(todas[0].obrigatorio).toBe(false);
    // A alternativa do grupo continua como estava.
    expect(todas[1].obrigatorio).toBe(true);
  });

  it('semAExigencia remove só a primeira folha que casa', () => {
    const depois = semAExigencia(soltaEAgrupada(), ID_RG, 'HABILITACAO');

    expect(todasAsExigencias(depois)).toHaveLength(1);
    // O grupo sobreviveu — não foi esvaziado junto.
    expect(depois.raizes.some((no) => no.tipo === 'OU')).toBe(true);
  });
});

describe('teto de tamanho', () => {
  /**
   * O contrato recebe o teto como `int32`; o cadastro não limita o valor em MB. Acima do que
   * o campo comporta, a gravação da árvore inteira voltaria 400 por causa de um documento.
   */
  it('omite o teto que não cabe no inteiro de 32 bits', () => {
    const raizes = comando(
      rascunho(exigenciaNova(ID_CONTRACHEQUE, 'HABILITACAO', { tamanhoMaximoMb: 4096 })),
    );
    expect(raizes[0].documento?.tamanhoMaximoBytes).toBeNull();
  });

  it('mantém o teto que cabe', () => {
    const raizes = comando(
      rascunho(exigenciaNova(ID_CONTRACHEQUE, 'HABILITACAO', { tamanhoMaximoMb: 5 })),
    );
    expect(raizes[0].documento?.tamanhoMaximoBytes).toBe(5 * 1024 * 1024);
  });
});

describe('formatosDeclarados', () => {
  it('traduz as grafias do cadastro para o vocabulário do contrato', () => {
    expect(formatosDeclarados('PDF, jpg; PNG').tokens).toEqual(['PDF', 'JPEG', 'PNG']);
  });

  it('reporta o formato que o contrato não expressa em vez de descartá-lo', () => {
    const { tokens, naoExpressos } = formatosDeclarados('PDF, TIFF');
    expect(tokens).toEqual(['PDF']);
    expect(naoExpressos).toEqual(['TIFF']);
  });

  it('cadastro sem restrição não declara formato nenhum', () => {
    expect(formatosDeclarados(null).tokens).toEqual([]);
  });
});

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
          ...comGrupoOu(
            [exigencia(), exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })],
          ).raizes[0],
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

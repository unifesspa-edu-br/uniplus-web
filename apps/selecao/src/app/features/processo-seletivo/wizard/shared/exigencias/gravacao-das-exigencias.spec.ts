import { describe, expect, it } from 'vitest';

import type { ExigenciasDoRascunho } from '../../processo-seletivo.models';
import { comAlcanceDeTodasAsFases } from './alcance-das-exigencias';
import { exigenciasDaFase } from './consulta-das-exigencias';
import { exigenciaNova } from './exigencias-documentais';
import { comModalidades } from './recorte-por-modalidade';
import {
  ID_CONTRACHEQUE,
  ID_ETAPA_RENDA,
  ID_HABILITACAO,
  ID_ISENCAO,
  ID_RG,
  comando,
  exigencia,
  rascunho,
} from './exigencias.testing';

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
    const raizes = comando(rascunho(comModalidades(exigencia(), ['LB_PPI'])), ['AC', 'LB_PPI']);

    expect(raizes[0].documento?.aplicabilidade).toBe('CONDICIONAL');
    expect(raizes[0].documento?.condicoes).toEqual([
      { clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["LB_PPI"]' },
    ]);
  });

  /**
   * O recorte esvaziado pelo quadro de vagas NÃO vira "exigido de todos": alargar em silêncio o
   * alcance de um documento é decisão de negócio que ninguém tomou. A cláusula sai — o agregado
   * recusa cláusula vazia —, a aplicabilidade declarada permanece, e a prontidão acusa que a
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
            {
              referencia: 'Lei 12.711/2012',
              abrangencia: 'FEDERAL',
              status: 'RESOLVIDO',
              observacao: '',
            },
            {
              referencia: 'Edital 01/2027, art. 4º',
              abrangencia: 'INTERNA_EDITAL',
              status: 'RESOLVIDO',
              observacao: 'cláusula do certame',
            },
          ],
        }),
      ),
    );

    expect(raizes[0].documento?.basesLegais).toEqual([
      {
        referencia: 'Lei 12.711/2012',
        abrangencia: 'FEDERAL',
        status: 'RESOLVIDO',
        observacao: null,
      },
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
            {
              referencia: 'Lei 12.711/2012',
              abrangencia: 'FEDERAL',
              status: 'RESOLVIDO',
              observacao: '',
            },
          ],
          filhos: [
            {
              tipo: 'FOLHA',
              documento: exigencia(),
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
            {
              tipo: 'FOLHA',
              documento: exigencia({ faseCodigo: 'FASE_QUE_SAIU' }),
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

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
  regraDoRascunho,
  rascunho,
} from './exigencias.testing';

describe('regrasDeComprovacaoParaEnvio — do rascunho para o comando', () => {
  it('manda uma regra de documento por exigência declarada', () => {
    const regrasDeComprovacao = comando(
      rascunho(exigencia({ faseCodigo: 'ISENCAO' }), exigencia({ faseCodigo: 'HABILITACAO' })),
    );

    expect(regrasDeComprovacao).toHaveLength(2);
    expect(
      regrasDeComprovacao.map((regraPrincipal) => regraPrincipal.documento?.momento?.faseId),
    ).toEqual([ID_ISENCAO, ID_HABILITACAO]);
    expect(
      regrasDeComprovacao.every((regraPrincipal) => regraPrincipal.forma === 'DOCUMENTO'),
    ).toBe(true);
  });

  it('resolve a fase pelo código, que é o que sobrevive à reconciliação do servidor', () => {
    const regrasDeComprovacao = comando(rascunho(exigencia({ faseCodigo: 'ISENCAO' })));
    expect(regrasDeComprovacao[0].documento?.momento?.faseId).toBe(ID_ISENCAO);
  });

  it('leva a etapa que coleta o documento naquela fase', () => {
    const regrasDeComprovacao = comando(rascunho(exigencia({ etapaId: ID_ETAPA_RENDA })));
    expect(regrasDeComprovacao[0].documento?.momento?.etapaId).toBe(ID_ETAPA_RENDA);
  });

  it('descarta a exigência cuja fase saiu do cronograma', () => {
    const regrasDeComprovacao = comando(rascunho(exigencia({ faseCodigo: 'RECURSOS' })));
    expect(regrasDeComprovacao).toHaveLength(0);
  });

  it('devolve o documento à fase inteira quando a etapa que o coletava saiu', () => {
    const regrasDeComprovacao = comando(
      rascunho(exigencia({ etapaId: 'etapa-que-nao-existe-mais' })),
    );
    expect(regrasDeComprovacao[0].documento?.momento?.etapaId).toBeNull();
  });

  it('sem recorte de modalidade, o documento é exigido de todo candidato', () => {
    const regrasDeComprovacao = comando(rascunho(exigencia()));
    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.tipo).toBe('GERAL');
    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.condicoes).toEqual([]);
  });

  it('o recorte de modalidade vira a cláusula do gatilho', () => {
    const regrasDeComprovacao = comando(rascunho(comModalidades(exigencia(), ['LB_PPI'])), [
      'AC',
      'LB_PPI',
    ]);

    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.tipo).toBe('CONDICIONAL');
    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.condicoes).toEqual([
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
    const regrasDeComprovacao = comando(rascunho(comModalidades(exigencia(), ['LB_PPI'])), ['AC']);
    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.tipo).toBe('CONDICIONAL');
    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.condicoes).toEqual([]);
  });

  /**
   * O recorte que passou a cobrir toda a oferta só é podado quando resta outra condição
   * sustentando a exigência. Sem ela, podá-lo deixaria uma exigência "de quem satisfaz" com
   * gatilho vazio — cobrada de ninguém —, e o documento sumiria do edital em silêncio por
   * causa de uma mudança no quadro de vagas que ninguém ligou a ele.
   */
  it('recorte que cobre toda a oferta é preservado quando é a única condição', () => {
    const regrasDeComprovacao = comando(rascunho(comModalidades(exigencia(), ['AC'])), ['AC']);
    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.condicoes).toEqual([
      { clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["AC"]' },
    ]);
  });

  /** Havendo outra condição, o recorte redundante sai e a exigência acompanha o quadro. */
  it('recorte que cobre toda a oferta sai quando outra condição sustenta a exigência', () => {
    const porSexo = exigencia({
      aplicabilidade: 'CONDICIONAL',
      condicoes: [{ clausula: 1, fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' }],
    });

    const regrasDeComprovacao = comando(rascunho(comModalidades(porSexo, ['AC'])), ['AC']);

    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.condicoes).toEqual([
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

    const regrasDeComprovacao = comando(rascunho(porOutraForma), ['AC', 'LB_PPI']);

    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.condicoes).toEqual([
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

    const regrasDeComprovacao = comando(rascunho(comCondicaoDeOutroFato));

    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.tipo).toBe('GERAL');
    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.condicoes).toEqual([]);
  });

  /** Condição sobre fato que não é modalidade sobrevive ao ida-e-volta. */
  it('preserva a condição por fato do candidato', () => {
    const porSexo = exigencia({
      aplicabilidade: 'CONDICIONAL',
      condicoes: [{ clausula: 0, fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' }],
    });

    const regrasDeComprovacao = comando(rascunho(porSexo));

    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.tipo).toBe('CONDICIONAL');
    expect(regrasDeComprovacao[0].documento?.aplicabilidade?.condicoes).toEqual([
      { clausula: 0, fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' },
    ]);
  });

  it('formato e tamanho vêm do cadastro do tipo de documento', () => {
    const regrasDeComprovacao = comando(rascunho(exigencia()));
    expect(regrasDeComprovacao[0].documento?.requisitos?.formatosPermitidos).toEqual([
      { formato: 'PDF', tamanhoMaximoBytesMax: null },
      { formato: 'JPEG', tamanhoMaximoBytesMax: null },
      { formato: 'PNG', tamanhoMaximoBytesMax: null },
    ]);
    expect(regrasDeComprovacao[0].documento?.requisitos?.tamanhoMaximoBytes).toBe(5 * 1024 * 1024);
  });

  it('tipo sem restrição declarada aceita qualquer formato, sem teto', () => {
    const regrasDeComprovacao = comando(rascunho(exigenciaNova(ID_CONTRACHEQUE, 'HABILITACAO')));
    expect(regrasDeComprovacao[0].documento?.requisitos?.formatosPermitidos).toBe('QUALQUER');
    expect(regrasDeComprovacao[0].documento?.requisitos?.tamanhoMaximoBytes).toBeNull();
  });

  it('a obrigatoriedade e a consequência acompanham a exigência', () => {
    const regrasDeComprovacao = comando(
      rascunho(exigencia({ obrigatorio: false, consequenciaIndeferimento: 'ELIMINA' })),
    );
    expect(regrasDeComprovacao[0].documento?.indeferimento?.obrigatorio).toBe(false);
    expect(regrasDeComprovacao[0].documento?.indeferimento?.consequencia).toBe('ELIMINA');
  });

  it('consequência vazia vira ausência, não texto vazio', () => {
    const regrasDeComprovacao = comando(rascunho(exigencia({ consequenciaIndeferimento: '' })));
    expect(regrasDeComprovacao[0].documento?.indeferimento?.consequencia).toBeNull();
  });

  /**
   * A perda que motivou a frente: o contrato aceita N normas por exigência (ADR-0074), e o
   * rascunho guardava três campos escalares — a segunda norma não tinha onde existir.
   */
  it('manda TODAS as normas declaradas, não só a primeira', () => {
    const regrasDeComprovacao = comando(
      rascunho(
        exigencia({
          basesLegais: [
            {
              referencia: 'Lei 12.711/2012',
              abrangencia: 'FEDERAL',
              situacao: 'RESOLVIDO',
              observacao: '',
            },
            {
              referencia: 'Edital 01/2027, art. 4º',
              abrangencia: 'INTERNA_EDITAL',
              situacao: 'RESOLVIDO',
              observacao: 'cláusula do certame',
            },
          ],
        }),
      ),
    );

    expect(regrasDeComprovacao[0].documento?.indeferimento?.basesLegais).toEqual([
      {
        referencia: 'Lei 12.711/2012',
        abrangencia: 'FEDERAL',
        situacao: 'RESOLVIDO',
        observacao: null,
      },
      {
        referencia: 'Edital 01/2027, art. 4º',
        abrangencia: 'INTERNA_EDITAL',
        situacao: 'RESOLVIDO',
        observacao: 'cláusula do certame',
      },
    ]);
  });

  it('norma em branco não viaja — é linha do formulário, não declaração', () => {
    const regrasDeComprovacao = comando(rascunho(exigencia()));
    expect(regrasDeComprovacao[0].documento?.indeferimento?.basesLegais).toEqual([]);
  });

  /** O grupo de alternativas e a consequência própria dele sobrevivem a um salvamento que não os toca. */
  it('preserva o grupo de alternativas que a tela não edita', () => {
    const grupo: ExigenciasDoRascunho = {
      emTodasAsFases: [],
      regrasDeComprovacao: [
        regraDoRascunho({
          forma: 'QUANTIDADE_MINIMA_DE_ITENS',
          quantidadeMinima: 1,
          consequencia: 'ELIMINA',
          basesLegais: [
            {
              referencia: 'Lei 12.711/2012',
              abrangencia: 'FEDERAL',
              situacao: 'RESOLVIDO',
              observacao: '',
            },
          ],
          itens: [regraDoRascunho({ forma: 'DOCUMENTO', documento: exigencia() })],
        }),
      ],
    };

    const regrasDeComprovacao = comando(grupo);
    expect(regrasDeComprovacao).toHaveLength(1);
    expect(regrasDeComprovacao[0].forma).toBe('QUANTIDADE_MINIMA_DE_ITENS');
    expect(regrasDeComprovacao[0].indeferimento?.consequencia).toBe('ELIMINA');
    expect(regrasDeComprovacao[0].cardinalidade?.quantidadeMinima).toBe(1);
    expect(regrasDeComprovacao[0].indeferimento?.basesLegais).toHaveLength(1);
    expect(regrasDeComprovacao[0].itens).toHaveLength(1);
  });

  /**
   * "Vale em todas as fases" é exigência em cada uma. O mesmo documento pode estar na fase como
   * ALTERNATIVA dentro de um grupo de alternativas — ali ele é uma das saídas possíveis, não uma exigência.
   * Aceitar essa regra de documento como satisfeita transformava "este documento é exigido" em "este
   * documento serve", sem nada na tela dizendo.
   */
  it('materializa o alcance global mesmo onde o documento só aparece dentro de um grupo de alternativas', () => {
    const comGrupo: ExigenciasDoRascunho = {
      emTodasAsFases: [ID_RG],
      regrasDeComprovacao: [
        regraDoRascunho({ forma: 'DOCUMENTO', documento: exigenciaNova(ID_RG, 'ISENCAO') }),
        regraDoRascunho({
          forma: 'QUANTIDADE_MINIMA_DE_ITENS',
          quantidadeMinima: 1,
          itens: [
            regraDoRascunho({ forma: 'DOCUMENTO', documento: exigenciaNova(ID_RG, 'HABILITACAO') }),
          ],
        }),
      ],
    };

    const completas = comAlcanceDeTodasAsFases(comGrupo, ['ISENCAO', 'HABILITACAO']);

    // A regra de documento do grupo continua onde estava, e a exigência de regra principal passa a existir ao lado.
    expect(exigenciasDaFase(completas, 'HABILITACAO')).toHaveLength(2);
    expect(
      completas.regrasDeComprovacao.filter(
        (regra) => regra.forma === 'DOCUMENTO' && regra.documento?.faseCodigo === 'HABILITACAO',
      ),
    ).toHaveLength(1);
  });

  /** Grupo que perdeu todos os itens sai junto — o servidor recusa grupo vazio. */
  it('colapsa o grupo que ficou sem item', () => {
    const grupo: ExigenciasDoRascunho = {
      emTodasAsFases: [],
      regrasDeComprovacao: [
        regraDoRascunho({
          forma: 'QUANTIDADE_MINIMA_DE_ITENS',
          quantidadeMinima: 1,
          itens: [
            regraDoRascunho({
              forma: 'DOCUMENTO',
              documento: exigencia({ faseCodigo: 'FASE_QUE_SAIU' }),
            }),
          ],
        }),
      ],
    };

    expect(comando(grupo)).toHaveLength(0);
  });

  /** A cardinalidade qualificada da regra de documento viaja intocada — a tela não a edita. */
  it('preserva cardinalidade e repetição por entidade da regra de documento', () => {
    const comCardinalidade: ExigenciasDoRascunho = {
      emTodasAsFases: [],
      regrasDeComprovacao: [
        regraDoRascunho({
          forma: 'DOCUMENTO',
          documento: exigencia(),
          quantidadeMinima: 3,
          criterioDeDistincao: 'COMPETENCIA_MENSAL',
          dataReferencia: '2027-03-01',
          grupoDoFormularioParaRepeticao: 'MEMBRO_FAMILIA',
        }),
      ],
    };

    const regrasDeComprovacao = comando(comCardinalidade);
    expect(regrasDeComprovacao[0].cardinalidade).toEqual({
      quantidadeMinima: 3,
      distincao: {
        criterioDeDistincao: 'COMPETENCIA_MENSAL',
        dataReferencia: '2027-03-01',
        ocorrenciasEsperadas: null,
      },
    });
    expect(regrasDeComprovacao[0].grupoDoFormularioParaRepeticao).toBe('MEMBRO_FAMILIA');
  });

});

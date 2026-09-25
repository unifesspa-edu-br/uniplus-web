import { describe, expect, it } from 'vitest';

import type { ExigenciaDeDocumento } from '../../processo-seletivo.models';
import {
  APLICABILIDADE_CONDICIONAL,
  comExigidoDeTodos,
  comModalidades,
  exigenciaNova,
} from '../../shared/exigencias-documentais';
import {
  comClausula,
  comCondicaoTrocada,
  semCondicao,
  type FatoEscolhivel,
} from '../../shared/gatilho-de-exigencia';
import {
  alcancaOPublico,
  composicaoResumida,
  descreverCondicao,
  descreverCondicaoDeModalidade,
  descreverNorma,
  descreverPublico,
  normaComum,
  publicoDaExigencia,
  rotuloDaConsequencia,
} from './resumo-da-exigencia';

const COR_RACA: FatoEscolhivel = {
  codigo: 'COR_RACA',
  nome: 'Cor/raça',
  tipoDominio: 'CATEGORICO_ESTATICO',
  valores: ['Preta', 'Parda', 'Indígena'],
  coletavel: true,
};
const ESTRANGEIRO: FatoEscolhivel = {
  codigo: 'ESTRANGEIRO',
  nome: 'Estrangeiro',
  tipoDominio: 'BOOLEANO',
  valores: [],
  coletavel: true,
};
const FATOS = new Map([COR_RACA, ESTRANGEIRO].map((fato) => [fato.codigo, fato]));

/** A exigência "de quem satisfaz" com as condições dadas, por cláusula. */
function condicional(
  condicoes: ExigenciaDeDocumento['condicoes'],
  modalidades: readonly string[] | null = null,
): ExigenciaDeDocumento {
  const base = comModalidades(
    { ...exigenciaNova('DOC', 'HABILITACAO'), aplicabilidade: APLICABILIDADE_CONDICIONAL },
    modalidades,
  );
  return { ...base, condicoes: [...base.condicoes, ...condicoes] };
}

describe('resumo da exigência documental', () => {
  it('diz "todo candidato" da exigência geral', () => {
    const publico = publicoDaExigencia(exigenciaNova('DOC', 'HABILITACAO'), FATOS);

    expect(descreverPublico(publico)).toBe('Todo candidato');
  });

  it('nomeia as modalidades do recorte pelo código', () => {
    const publico = publicoDaExigencia(condicional([], ['LB_PPI', 'LI_PPI']), FATOS);

    expect(descreverPublico(publico)).toBe('Modalidades LB_PPI, LI_PPI');
  });

  it('lê as condições por E dentro da alternativa e por OU entre elas', () => {
    const exigencia = condicional([
      { clausula: 1, fato: 'COR_RACA', operador: 'EM', valor: '["Preta","Parda"]' },
      { clausula: 1, fato: 'ESTRANGEIRO', operador: 'IGUAL', valor: 'false' },
      { clausula: 2, fato: 'COR_RACA', operador: 'IGUAL', valor: '"Indígena"' },
    ]);

    expect(descreverPublico(publicoDaExigencia(exigencia, FATOS))).toBe(
      'Quem: Cor/raça é um de Preta, Parda e Estrangeiro é não, ou Cor/raça é Indígena',
    );
  });

  it('junta o recorte por modalidade e as condições', () => {
    const exigencia = condicional(
      [{ clausula: 1, fato: 'COR_RACA', operador: 'IGUAL', valor: '"Indígena"' }],
      ['LB_PPI'],
    );

    expect(descreverPublico(publicoDaExigencia(exigencia, FATOS))).toBe(
      'Modalidades LB_PPI, de quem: Cor/raça é Indígena',
    );
  });

  /**
   * O domínio aceita condição de modalidade com qualquer operador, gravada por outro caminho
   * que não o editor: ela aparece descrita e decide o filtro por modalidade como na publicação.
   */
  describe('condição de modalidade de outra forma que o recorte', () => {
    const igual = condicional([
      { clausula: 1, fato: 'MODALIDADE', operador: 'IGUAL', valor: '"LB_PPI"' },
    ]);
    const exceto = condicional([
      { clausula: 1, fato: 'MODALIDADE', operador: 'NAO_EM', valor: '["LB_PPI","LI_PPI"]' },
      { clausula: 1, fato: 'COR_RACA', operador: 'IGUAL', valor: '"Indígena"' },
    ]);

    it('descreve a condição em vez de dizer que ninguém entrega', () => {
      expect(descreverPublico(publicoDaExigencia(igual, FATOS))).toBe('Quem: Modalidade LB_PPI');
      expect(descreverPublico(publicoDaExigencia(exceto, FATOS))).toBe(
        'Quem: Modalidades exceto LB_PPI, LI_PPI e Cor/raça é Indígena',
      );
    });

    it('filtra por modalidade com a regra da publicação', () => {
      const deIgual = publicoDaExigencia(igual, FATOS);
      const deExceto = publicoDaExigencia(exceto, FATOS);

      expect(alcancaOPublico(deIgual, { tipo: 'modalidade', codigo: 'LB_PPI' })).toBe(true);
      expect(alcancaOPublico(deIgual, { tipo: 'modalidade', codigo: 'AC' })).toBe(false);
      expect(alcancaOPublico(deExceto, { tipo: 'modalidade', codigo: 'LB_PPI' })).toBe(false);
      expect(alcancaOPublico(deExceto, { tipo: 'modalidade', codigo: 'AC' })).toBe(true);
    });

    it('descreve cada operador de modalidade', () => {
      const frase = (operador: string, valor: string) =>
        descreverCondicaoDeModalidade({ fato: 'MODALIDADE', operador, valor });

      expect(frase('IGUAL', '"LB_PPI"')).toBe('Modalidade LB_PPI');
      expect(frase('DIFERENTE', '"LB_PPI"')).toBe('Modalidades exceto LB_PPI');
      expect(frase('EM', '["LB_PPI","LI_PPI"]')).toBe('Modalidades LB_PPI, LI_PPI');
      expect(frase('NAO_EM', '["AC"]')).toBe('Modalidades exceto AC');
    });
  });

  /**
   * As alternativas se combinam por OU: a que só tem o recorte cobra o documento de toda a
   * modalidade recortada, e a condição da outra não restringe nada além dela.
   */
  describe('alternativa que só tem o recorte', () => {
    const SEXO: FatoEscolhivel = {
      codigo: 'SEXO',
      nome: 'Sexo',
      tipoDominio: 'CATEGORICO_ESTATICO',
      valores: ['F', 'M'],
      coletavel: true,
    };
    const recortada = condicional([], ['LB_PPI']);
    const feminino = (documento: ExigenciaDeDocumento, indice: number) =>
      comCondicaoTrocada(documento, indice, {
        ...documento.condicoes[indice],
        valor: '"F"',
      });

    it('ao acrescentar alternativa, cobra de toda a modalidade', () => {
      const comOutra = comClausula(recortada, SEXO);
      const indice = comOutra.condicoes.findIndex((condicao) => condicao.fato === 'SEXO');
      const publico = publicoDaExigencia(feminino(comOutra, indice), FATOS);

      expect(descreverPublico(publico)).toBe('Modalidades LB_PPI');
      expect(alcancaOPublico(publico, { tipo: 'condicao', condicao: 'Cor/raça é Indígena' })).toBe(
        true,
      );
    });

    it('ao remover a condição de uma das alternativas, cobra de toda a modalidade', () => {
      const duas = condicional(
        [
          { clausula: 1, fato: 'ESTRANGEIRO', operador: 'IGUAL', valor: 'false' },
          { clausula: 2, fato: 'COR_RACA', operador: 'IGUAL', valor: '"Indígena"' },
          { clausula: 2, fato: 'MODALIDADE', operador: 'EM', valor: '["LB_PPI"]' },
        ],
        ['LB_PPI'],
      );
      expect(descreverPublico(publicoDaExigencia(duas, FATOS))).toBe(
        'Modalidades LB_PPI, de quem: Estrangeiro é não, ou Cor/raça é Indígena',
      );

      const indice = duas.condicoes.findIndex((condicao) => condicao.fato === 'ESTRANGEIRO');
      expect(descreverPublico(publicoDaExigencia(semCondicao(duas, indice), FATOS))).toBe(
        'Modalidades LB_PPI',
      );
    });
  });

  /**
   * O `EM` de modalidade só é recorte quando está, com a mesma lista, em todas as alternativas.
   * Fora disso é condição da própria alternativa, e o domínio a lê assim.
   */
  describe('recorte que não está em todas as alternativas', () => {
    const idade: FatoEscolhivel = {
      codigo: 'IDADE',
      nome: 'Idade',
      tipoDominio: 'NUMERICO',
      valores: [],
      coletavel: true,
    };
    const fatos = new Map([...FATOS, [idade.codigo, idade]]);
    const soNaPrimeira = condicional([
      { clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["LB_PPI"]' },
      { clausula: 2, fato: 'COR_RACA', operador: 'IGUAL', valor: '"Indígena"' },
    ]);
    const comOutraCondicao = condicional([
      { clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["A"]' },
      { clausula: 1, fato: 'ESTRANGEIRO', operador: 'IGUAL', valor: 'true' },
      { clausula: 2, fato: 'IDADE', operador: 'MAIOR_IGUAL', valor: '60' },
    ]);

    it('descreve o EM dentro da alternativa, não como recorte do gatilho', () => {
      const primeira = publicoDaExigencia(soNaPrimeira, fatos);
      const segunda = publicoDaExigencia(comOutraCondicao, fatos);

      expect(primeira.modalidades).toBeNull();
      expect(descreverPublico(primeira)).toBe('Quem: Modalidade LB_PPI, ou Cor/raça é Indígena');
      expect(descreverPublico(segunda)).toBe(
        'Quem: Modalidade A e Estrangeiro é sim, ou Idade é maior ou igual a 60',
      );
    });

    it('filtra por condição e por modalidade como o domínio', () => {
      const primeira = publicoDaExigencia(soNaPrimeira, fatos);
      const segunda = publicoDaExigencia(comOutraCondicao, fatos);
      const indigena = { tipo: 'condicao', condicao: 'Cor/raça é Indígena' } as const;

      // As opções do filtro por condição saem das alternativas: a da cor/raça continua lá.
      expect(primeira.alternativas.flat()).toContain('Cor/raça é Indígena');
      expect(alcancaOPublico(primeira, indigena)).toBe(true);
      expect(alcancaOPublico(primeira, { tipo: 'modalidade', codigo: 'AC' })).toBe(true);
      expect(alcancaOPublico(segunda, { tipo: 'modalidade', codigo: 'B' })).toBe(true);
      expect(alcancaOPublico(segunda, indigena)).toBe(false);
    });

    it('mantém o recorte que o editor grava em todas as alternativas', () => {
      const uniforme = condicional(
        [
          { clausula: 1, fato: 'ESTRANGEIRO', operador: 'IGUAL', valor: 'false' },
          { clausula: 2, fato: 'COR_RACA', operador: 'IGUAL', valor: '"Indígena"' },
          { clausula: 2, fato: 'MODALIDADE', operador: 'EM', valor: '["LB_PPI"]' },
        ],
        ['LB_PPI'],
      );

      expect(descreverPublico(publicoDaExigencia(uniforme, fatos))).toBe(
        'Modalidades LB_PPI, de quem: Estrangeiro é não, ou Cor/raça é Indígena',
      );
    });
  });

  /** A exigência "de quem satisfaz" sem nada declarado não é cobrada de ninguém. */
  it('diz que ninguém entrega a exigência condicional sem condição', () => {
    expect(descreverPublico(publicoDaExigencia(condicional([]), FATOS))).toBe(
      'Ninguém: nenhuma condição declarada',
    );
  });

  it('nomeia o fato que saiu do catálogo e a condição ainda sem valor', () => {
    expect(descreverCondicao({ fato: 'RENDA', operador: 'IGUAL', valor: '1' }, undefined)).toBe(
      'RENDA — fora do catálogo',
    );
    expect(descreverCondicao({ fato: 'COR_RACA', operador: 'IGUAL', valor: '' }, COR_RACA)).toBe(
      'Cor/raça é (valor não escolhido)',
    );
  });

  describe('filtro por público', () => {
    const geral = publicoDaExigencia(exigenciaNova('DOC', 'HABILITACAO'), FATOS);
    const soPpi = publicoDaExigencia(condicional([], ['LB_PPI']), FATOS);
    const indigena = publicoDaExigencia(
      condicional([{ clausula: 1, fato: 'COR_RACA', operador: 'IGUAL', valor: '"Indígena"' }]),
      FATOS,
    );
    const deNinguem = publicoDaExigencia(condicional([]), FATOS);

    it('por modalidade: o geral, o recorte que a inclui e a condição sobre outro fato', () => {
      const filtro = { tipo: 'modalidade', codigo: 'LB_PPI' } as const;

      expect(alcancaOPublico(geral, filtro)).toBe(true);
      expect(alcancaOPublico(soPpi, filtro)).toBe(true);
      expect(alcancaOPublico(indigena, filtro)).toBe(true);
      expect(alcancaOPublico(deNinguem, filtro)).toBe(false);
      expect(alcancaOPublico(soPpi, { tipo: 'modalidade', codigo: 'AC' })).toBe(false);
    });

    it('todo candidato: só a exigência geral', () => {
      expect(alcancaOPublico(geral, { tipo: 'todo-candidato' })).toBe(true);
      expect(alcancaOPublico(soPpi, { tipo: 'todo-candidato' })).toBe(false);
    });

    it('por condição: a que a declara e a que não depende de outro fato', () => {
      const filtro = { tipo: 'condicao', condicao: 'Cor/raça é Indígena' } as const;
      const estrangeiro = publicoDaExigencia(
        condicional([{ clausula: 1, fato: 'ESTRANGEIRO', operador: 'IGUAL', valor: 'true' }]),
        FATOS,
      );

      expect(alcancaOPublico(indigena, filtro)).toBe(true);
      expect(alcancaOPublico(geral, filtro)).toBe(true);
      expect(alcancaOPublico(soPpi, filtro)).toBe(true);
      expect(alcancaOPublico(estrangeiro, filtro)).toBe(false);
      expect(alcancaOPublico(deNinguem, filtro)).toBe(false);
    });

    it('a exigência geral deixa de ser geral ao receber recorte', () => {
      const recortada = comExigidoDeTodos(exigenciaNova('DOC', 'HABILITACAO'), false);

      expect(publicoDaExigencia(recortada, FATOS).deTodos).toBe(false);
    });
  });

  it('nomeia a consequência da falta, sem mentir sobre a obrigatória', () => {
    expect(rotuloDaConsequencia('ELIMINA', true)).toBe('Elimina do processo');
    expect(rotuloDaConsequencia('', false)).toBe('Não decide sozinha');
    expect(rotuloDaConsequencia('', true)).toBe('Nada além de faltar o documento obrigatório');
  });

  it('descreve a norma pelo alcance e pela identificação', () => {
    expect(
      descreverNorma({
        referencia: ' Lei 12.711/2012, art. 3º ',
        abrangencia: 'FEDERAL',
        status: 'PENDENTE',
        observacao: '',
      }),
    ).toEqual({
      referencia: 'Lei 12.711/2012, art. 3º',
      detalhe: 'Lei federal · Pendente',
      observacao: '',
    });
    expect(
      descreverNorma({
        referencia: '',
        abrangencia: 'INTERNA_EDITAL',
        status: 'RESOLVIDO',
        observacao: '',
      }).referencia,
    ).toBe('Sem referência declarada');
  });

  describe('norma comum da fase', () => {
    const norma = {
      referencia: 'Edital nº 1/2027, Anexo III',
      abrangencia: 'INTERNA_EDITAL',
      status: 'RESOLVIDO',
      observacao: '',
    };

    it('é a norma única e resolvida de todas as exigências', () => {
      expect(
        normaComum([[norma], [{ ...norma, referencia: ' Edital nº 1/2027, Anexo III ' }]]),
      ).toBe(norma);
    });

    it('não existe quando alguma exigência tem outra norma, duas ou nenhuma', () => {
      expect(normaComum([[norma], [{ ...norma, referencia: 'Anexo IV' }]])).toBeNull();
      expect(normaComum([[norma], [norma, norma]])).toBeNull();
      expect(normaComum([[norma], []])).toBeNull();
      expect(normaComum([])).toBeNull();
    });

    /** A pendente continua acusada em cada linha que a publicação recusaria. */
    it('não sobe a norma pendente, mesmo igual em todas', () => {
      const pendente = { ...norma, status: 'PENDENTE' };

      expect(normaComum([[pendente], [pendente]])).toBeNull();
    });
  });

  it('resume como o documento compõe o grupo', () => {
    expect(composicaoResumida(null)).toBe('');
    expect(composicaoResumida({ tipo: 'OU', quantidadeMinima: null, alternativas: 3 })).toBe(
      'Basta 1 entre 3 alternativas',
    );
    expect(composicaoResumida({ tipo: 'OU', quantidadeMinima: 2, alternativas: 3 })).toBe(
      '2 entre 3 alternativas',
    );
    expect(composicaoResumida({ tipo: 'E', quantidadeMinima: null, alternativas: 2 })).toBe(
      'Conjunto de 2 documentos',
    );
  });
});

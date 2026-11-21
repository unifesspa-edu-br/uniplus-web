import { describe, expect, it } from 'vitest';
import { CODIGOS_EM_TEXTO, conteudoComCodigos, type TrocaDeCodigos } from './codigos-do-conteudo';
import type { ConteudoDoFormulario, ItemDoFormulario } from './tipos';

const EM_MAIUSCULAS: TrocaDeCodigos<string, string, string, string> = {
  operador: (codigo) => codigo.toUpperCase(),
  tipoRenderizacao: (codigo) => codigo.toUpperCase(),
};

const QUANDO = [[{ fato: 'ESCOLA_PUBLICA', operador: 'igual', valor: true }]];
const QUANDO_TROCADO = [[{ fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: true }]];

const item: ItemDoFormulario<number> = {
  fatoCodigo: 'ESCOLA_PUBLICA',
  ordem: 1,
  apresentacao: {
    rotulo: 'Estudou em escola pública?',
    tipoRenderizacao: 'booleano',
    pedirConfirmacao: false,
  },
  regras: {
    exibicao: QUANDO,
    obrigatoriedade: { tipo: 'QUANDO', predicado: QUANDO },
    restricoes: [{ tipo: 'SUBCONJUNTO', entradas: [{ quando: QUANDO, valores: ['true'] }] }],
    impedimento: { quando: QUANDO, mensagem: 'Só para egressos.' },
  },
};

const conteudo: ConteudoDoFormulario<number> = {
  titulo: 'Inscrição',
  etapas: [
    {
      codigo: 'SECAO_1',
      ordem: 1,
      tipo: 'SECAO',
      bloco: null,
      apresentacao: { titulo: 'Dados', descricao: null, aviso: null },
      exibicao: QUANDO,
    },
  ],
  itens: [item],
  grupos: [
    {
      codigo: 'FAMILIA',
      ordem: 2,
      rotulo: 'Composição familiar',
      etapaCodigo: null,
      ocorrencias: { minimo: 1, maximo: null, incluiCandidato: true },
      regras: { exibicao: QUANDO, obrigatoriedade: { tipo: 'QUANDO', predicado: QUANDO } },
      subitens: [item],
    },
  ],
  termos: [
    {
      codigo: 'LGPD',
      ordem: 3,
      termo: { termoId: 'T1', versaoId: 'V1' },
      regras: { exibicao: QUANDO, obrigatoriedade: { tipo: 'QUANDO', predicado: QUANDO } },
    },
  ],
  pressupostos: ['NOME'],
  documentosExigidos: [
    {
      faseCodigo: 'INSCRICAO',
      tipoDocumentoCodigo: 'LAUDO_MEDICO',
      obrigatorio: true,
      quando: QUANDO,
      consequenciaIndeferimento: 'ELIMINA',
      basesLegais: null,
    },
  ],
};

describe('conteudoComCodigos', () => {
  const trocado = conteudoComCodigos(conteudo, EM_MAIUSCULAS);
  const [itemTrocado] = trocado.itens ?? [];

  it('troca o operador da exibição da etapa', () => {
    expect(trocado.etapas?.[0].exibicao).toEqual(QUANDO_TROCADO);
  });

  it('troca o tipo de renderização e todos os predicados do item', () => {
    expect(itemTrocado.apresentacao.tipoRenderizacao).toBe('BOOLEANO');
    expect(itemTrocado.regras.exibicao).toEqual(QUANDO_TROCADO);
    expect(itemTrocado.regras.obrigatoriedade.predicado).toEqual(QUANDO_TROCADO);
  });

  it('troca o predicado do impedimento e o das entradas de cada restrição', () => {
    expect(itemTrocado.regras.impedimento?.quando).toEqual(QUANDO_TROCADO);
    expect(itemTrocado.regras.restricoes?.[0].entradas?.[0].quando).toEqual(QUANDO_TROCADO);
  });

  it('troca os predicados do grupo e os dos subitens dele', () => {
    const [grupo] = trocado.grupos ?? [];

    expect(grupo.regras.exibicao).toEqual(QUANDO_TROCADO);
    expect(grupo.regras.obrigatoriedade.predicado).toEqual(QUANDO_TROCADO);
    expect(grupo.subitens[0].apresentacao.tipoRenderizacao).toBe('BOOLEANO');
    expect(grupo.subitens[0].regras.exibicao).toEqual(QUANDO_TROCADO);
  });

  it('troca os predicados do termo e o do documento exigido', () => {
    expect(trocado.termos?.[0].regras.exibicao).toEqual(QUANDO_TROCADO);
    expect(trocado.termos?.[0].regras.obrigatoriedade.predicado).toEqual(QUANDO_TROCADO);
    expect(trocado.documentosExigidos?.[0].quando).toEqual(QUANDO_TROCADO);
  });

  it('mantém o que o conteúdo não codifica', () => {
    expect(trocado.titulo).toBe('Inscrição');
    expect(trocado.pressupostos).toEqual(['NOME']);
    expect(itemTrocado.apresentacao.rotulo).toBe(item.apresentacao.rotulo);
    expect(trocado.termos?.[0].termo.termoId).toBe('T1');
  });

  it('lido e não editado, o conteúdo serializa igual: cada bloco mantém a ordem das chaves', () => {
    const mesmoCodigo = conteudoComCodigos(conteudo, {
      operador: (codigo: string) => codigo,
      tipoRenderizacao: (codigo: string) => codigo,
    });

    expect(JSON.stringify(mesmoCodigo)).toBe(JSON.stringify(conteudo));
  });

  it('mantém ausente o que veio ausente', () => {
    const semNada = conteudoComCodigos(
      {
        ...conteudo,
        itens: [
          {
            ...item,
            regras: { ...item.regras, exibicao: null, impedimento: null, restricoes: undefined },
          },
        ],
        etapas: null,
        grupos: undefined,
        termos: null,
        documentosExigidos: undefined,
      },
      EM_MAIUSCULAS,
    );

    expect(semNada.itens?.[0].regras.exibicao).toBeNull();
    expect(semNada.itens?.[0].regras.impedimento).toBeNull();
    expect(semNada.itens?.[0].regras.restricoes).toBeUndefined();
    expect(semNada.etapas).toBeNull();
    expect(semNada.grupos).toBeUndefined();
    expect(semNada.termos).toBeNull();
    expect(semNada.documentosExigidos).toBeUndefined();
  });

  it('entrega a cada código o que o tradutor devolve para ele, também quando é desconhecido', () => {
    const somenteConhecidos: TrocaDeCodigos<string, string, string | null, number | null> = {
      operador: (codigo) => (codigo === 'igual' ? 'IGUAL' : null),
      tipoRenderizacao: (codigo) => (codigo === 'booleano' ? 1 : null),
    };
    const desconhecido = conteudoComCodigos(
      {
        ...conteudo,
        itens: [
          {
            ...item,
            apresentacao: { ...item.apresentacao, tipoRenderizacao: 'inventado' },
            regras: { ...item.regras, exibicao: [[{ fato: 'A', operador: 'parecido', valor: 1 }]] },
          },
        ],
      },
      somenteConhecidos,
    );

    expect(desconhecido.itens?.[0].apresentacao.tipoRenderizacao).toBeNull();
    expect(desconhecido.itens?.[0].regras.exibicao?.[0][0].operador).toBeNull();
    expect(desconhecido.etapas?.[0].exibicao?.[0][0].operador).toBe('IGUAL');
  });
});

describe('CODIGOS_EM_TEXTO', () => {
  it('mantém o texto que o contrato informa', () => {
    expect(CODIGOS_EM_TEXTO.operador('IGUAL')).toBe('IGUAL');
    expect(CODIGOS_EM_TEXTO.tipoRenderizacao('TEXTO')).toBe('TEXTO');
  });

  it('troca o código que o contrato não informa por texto vazio', () => {
    expect(CODIGOS_EM_TEXTO.operador(null)).toBe('');
    expect(CODIGOS_EM_TEXTO.tipoRenderizacao(null)).toBe('');
  });
});

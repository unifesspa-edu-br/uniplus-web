import {
  FinalidadeDoFormulario,
  TipoDaReferenciaTemporal,
  type DocumentoDaConfiguracao,
  type DocumentoDaConfiguracaoFormulario,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { exemploDoContrato } from '../exemplos.testing';
import { definirReferenciaTemporal, definirRegrasDeDerivacao } from './coleta.edicao';
import {
  acrescentarParte,
  aplicarModelo,
  criarFormulario,
  definirFaseDoFormulario,
  definirTitulo,
  PAGINAS,
  formularioDaFinalidade,
  ITENS,
  moverParte,
  removerFormulario,
  retirarParte,
  TERMOS,
} from './formulario.edicao';

const INSCRICAO = FinalidadeDoFormulario.INSCRICAO;
const ISENCAO = FinalidadeDoFormulario.ISENCAO_TAXA;

function umDocumento(): DocumentoDaConfiguracao {
  return {
    ...exemploDoContrato('inscricao-pelo-sistema'),
    coleta: {
      calculosDosDados: [{ codigoDoDado: 'FAIXA_DE_RENDA', regras: [] }],
    },
  };
}

function formulario(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracaoFormulario {
  const encontrado = formularioDaFinalidade(documento, INSCRICAO);
  if (encontrado === undefined) throw new Error('O exemplo tem o formulário de inscrição.');
  return encontrado;
}

describe('cabeçalho do formulário', () => {
  it('troca o título e a fase só no formulário da finalidade', () => {
    const documento = umDocumento();

    const editado = definirFaseDoFormulario(
      definirTitulo(documento, INSCRICAO, 'Outro título'),
      INSCRICAO,
      'avaliacao',
    );

    expect(formulario(editado)).toMatchObject({ titulo: 'Outro título', faseChave: 'avaliacao' });
    expect(formulario(editado).itens).toBe(formulario(documento).itens);
  });

  it('finalidade sem formulário não ganha um ao editar o título', () => {
    const documento = umDocumento();

    expect(definirTitulo(documento, ISENCAO, 'Título')).toBe(documento);
  });

  it('esvaziar o título o tira do formulário', () => {
    expect(formulario(definirTitulo(umDocumento(), INSCRICAO, '  '))).not.toHaveProperty('titulo');
  });
});

describe('criar, remover e aplicar modelo', () => {
  it('criar nasce só com a finalidade, e a finalidade que já tem formulário não ganha outro', () => {
    const documento = umDocumento();

    const criado = criarFormulario(documento, ISENCAO);

    expect(criado.formularios?.at(-1)).toEqual({ finalidade: ISENCAO });
    expect(criarFormulario(criado, ISENCAO)).toBe(criado);
  });

  it('remover tira só o formulário da finalidade e não persegue o que o cita', () => {
    const documento = umDocumento();

    const editado = removerFormulario(documento, INSCRICAO);

    expect(editado.formularios).toEqual([]);
    expect(editado.documentosExigidos).toBe(documento.documentosExigidos);
    expect(removerFormulario(documento, ISENCAO)).toEqual(documento);
  });

  it('o modelo aplicado substitui o formulário da finalidade e traz o modelo de origem', () => {
    const documento = umDocumento();
    const copia: DocumentoDaConfiguracaoFormulario = {
      finalidade: ISENCAO,
      titulo: 'Do modelo',
      modeloOrigemCodigo: 'MODELO_PADRAO',
      itens: [{ codigoDoDado: 'RENDA' }],
    };

    const editado = aplicarModelo(documento, INSCRICAO, copia);

    expect(editado.formularios).toEqual([{ ...copia, finalidade: INSCRICAO }]);
  });

  it('o modelo aplicado a uma finalidade sem formulário entra ao fim', () => {
    const documento = umDocumento();

    const editado = aplicarModelo(documento, ISENCAO, { finalidade: ISENCAO, titulo: 'Do modelo' });

    expect(editado.formularios).toHaveLength(2);
    expect(editado.formularios?.[0]).toBe(documento.formularios?.[0]);
  });
});

describe('partes do formulário', () => {
  it('mover um item renumera a `ordem` da lista a partir de 0', () => {
    const documento = umDocumento();
    const [primeiro, segundo] = formulario(documento).itens ?? [];

    const editado = moverParte(documento, INSCRICAO, ITENS, { de: 0, para: 1 });

    expect(formulario(editado).itens?.map((item) => [item.codigoDoDado, item.ordem])).toEqual([
      [segundo.codigoDoDado, 0],
      [primeiro.codigoDoDado, 1],
    ]);
  });

  it('mover para a mesma posição devolve o documento como estava', () => {
    const documento = umDocumento();

    expect(moverParte(documento, INSCRICAO, PAGINAS, { de: 1, para: 1 })).toBe(documento);
  });

  it('mover uma posição que não existe não muda nada', () => {
    const documento = umDocumento();

    expect(moverParte(documento, INSCRICAO, PAGINAS, { de: 9, para: 0 })).toBe(documento);
  });

  it('acrescentar põe ao fim e retirar não renumera as que ficam', () => {
    const documento = umDocumento();

    const comTermo = acrescentarParte(documento, INSCRICAO, TERMOS, {
      codigo: 'termo-novo',
      termoCodigo: 'TERMO_NOVO',
      versaoNumero: 1,
    });
    const semPrimeiroItem = retirarParte(comTermo, INSCRICAO, ITENS, 0);

    expect(formulario(comTermo).termos?.at(-1)).toMatchObject({ codigo: 'termo-novo', ordem: 1 });
    expect(formulario(semPrimeiroItem).itens?.map((item) => item.ordem)).toEqual([1]);
  });
});

describe('coleta', () => {
  it('a referência temporal nasce, muda e sai; o resto da coleta fica', () => {
    const documento = umDocumento();

    const trocada = definirReferenciaTemporal(documento, {
      tipo: TipoDaReferenciaTemporal.DATA_ESPECIFICA,
      data: '2027-01-10',
      faseChave: '',
    });
    const sem = definirReferenciaTemporal(documento, null);

    expect(trocada.coleta?.referenciaTemporalDosDados).toEqual({
      tipo: 'DATA_ESPECIFICA',
      data: '2027-01-10',
    });
    expect(sem.coleta).not.toHaveProperty('referenciaTemporalDosDados');
    expect(trocada.coleta?.calculosDosDados).toBe(documento.coleta?.calculosDosDados);
  });

  it('as regras de um fato são trocadas sem tocar nas dos outros; o fato novo entra ao fim', () => {
    const documento = umDocumento();
    const [faixa] = documento.coleta?.calculosDosDados ?? [];

    const trocada = definirRegrasDeDerivacao(documento, 'FAIXA_DE_RENDA', []);
    const nova = definirRegrasDeDerivacao(documento, 'OUTRO_FATO', [
      { ordem: 0, contribui: 'A', quando: null },
    ]);

    expect(trocada.coleta?.calculosDosDados).toEqual([
      { codigoDoDado: 'FAIXA_DE_RENDA', regras: [] },
    ]);
    expect(nova.coleta?.calculosDosDados?.[0]).toBe(faixa);
    expect(nova.coleta?.calculosDosDados?.[1].codigoDoDado).toBe('OUTRO_FATO');
  });

  it('declarar as mesmas regras devolve o documento como estava', () => {
    const documento = umDocumento();
    const [faixa] = documento.coleta?.calculosDosDados ?? [];

    expect(definirRegrasDeDerivacao(documento, 'FAIXA_DE_RENDA', faixa.regras)).toBe(documento);
  });
});

describe('ocorrências e movimentos atípicos', () => {
  it('preserva ordens quando o movimento é nulo ou a origem não existe', () => {
    const documento: DocumentoDaConfiguracao = {
      ...umDocumento(),
      formularios: [{ finalidade: INSCRICAO, itens: [{ codigoDoDado: 'A', ordem: 7 }] }],
    };
    expect(moverParte(documento, INSCRICAO, ITENS, { de: 0, para: 0 })).toBe(documento);
    expect(moverParte(documento, INSCRICAO, ITENS, { de: 8, para: 0 })).toBe(documento);
  });

  it('edita somente a ocorrência indicada de um fato repetido', () => {
    const entradas = [
      { codigoDoDado: 'A', regras: [] },
      { codigoDoDado: 'A', regras: [] },
    ];
    const documento: DocumentoDaConfiguracao = {
      ...umDocumento(),
      coleta: { calculosDosDados: entradas },
    };
    const resultado = definirRegrasDeDerivacao(documento, 'A', [
      { ordem: 0, contribui: 'B', quando: null },
    ]);
    expect(resultado.coleta?.calculosDosDados?.[1]).toBe(entradas[1]);
    const segunda = definirRegrasDeDerivacao(
      documento,
      'A',
      [{ ordem: 0, contribui: 'B', quando: null }],
      1,
    );
    expect(segunda.coleta?.calculosDosDados?.[0]).toBe(entradas[0]);
    expect(segunda.coleta?.calculosDosDados?.[1].regras).toEqual([
      { ordem: 0, contribui: 'B', quando: null },
    ]);
  });
});

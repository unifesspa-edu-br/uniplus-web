import type { TipoConceitoDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import { alternarConceito, opcoesDeConceito } from './conceitos-admitidos';
import { recusasComMensagemDosConceitos } from './mensagens-dos-conceitos';

function conceito(codigo: string, nome: string, ativo = true): TipoConceitoDto {
  return {
    id: codigo,
    codigo,
    nome,
    descricao: null,
    natureza: 'categorico',
    ativo,
    numerico: null,
    valores: [],
  };
}

describe('opcoesDeConceito', () => {
  const catalogo = [
    conceito('B', 'Banca'),
    conceito('A', 'Análise'),
    conceito('X', 'Extinto', false),
  ];

  it('oferece só os ativos, em ordem de nome', () => {
    expect(opcoesDeConceito(catalogo, []).map((opcao) => opcao.codigo)).toEqual(['A', 'B']);
  });

  it('mantém, como inativo, o admitido que saiu do catálogo ativo', () => {
    const opcoes = opcoesDeConceito(catalogo, ['A', 'X', 'SUMIU']);

    expect(opcoes.filter((opcao) => opcao.inativo)).toEqual([
      { codigo: 'X', nome: 'Extinto', inativo: true },
      { codigo: 'SUMIU', nome: 'SUMIU', inativo: true },
    ]);
  });
});

describe('alternarConceito', () => {
  it('marca sem repetir e desmarca só o conceito pedido', () => {
    expect(alternarConceito(['A'], 'B', true)).toEqual(['A', 'B']);
    expect(alternarConceito(['A', 'B'], 'B', true)).toEqual(['A', 'B']);
    expect(alternarConceito(['A', 'B'], 'A', false)).toEqual(['B']);
  });
});

describe('recusasComMensagemDosConceitos', () => {
  const recusa = (code: string, field = 'conceitosAdmitidos') => ({
    field,
    code,
    message: 'da API',
  });

  it('troca a mensagem pela do código e reúne as recusas do campo numa só', () => {
    const resultado = recusasComMensagemDosConceitos([
      recusa('uniplus.configuracao.tipo_etapa.conceito_inexistente'),
      recusa('uniplus.configuracao.tipo_etapa.conceito_inativo'),
    ]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].message).toContain('não existe mais no catálogo');
    expect(resultado[0].message).toContain('está desativado');
  });

  it('deixa como veio a recusa de código desconhecido e a de outro campo', () => {
    const outra = recusa('uniplus.configuracao.tipo_etapa.codigo_invalido', 'nome');
    const resultado = recusasComMensagemDosConceitos([outra, recusa('codigo.novo')]);

    expect(resultado).toContainEqual(outra);
    expect(resultado.find((item) => item.field === 'conceitosAdmitidos')?.message).toBe('da API');
  });

  it('não mexe em recusas sem o campo dos conceitos', () => {
    const lista = [recusa('x', 'nome')];

    expect(recusasComMensagemDosConceitos(lista)).toBe(lista);
  });
});

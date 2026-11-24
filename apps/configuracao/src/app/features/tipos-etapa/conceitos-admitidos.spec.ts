import { FormaDoConceitoCodigo, type TipoConceitoDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import type { RecusaDoServidor } from '../../shared/formulario';
import { alternarConceito, opcoesDeConceito } from './conceitos-admitidos';
import { recusasComMensagemDosConceitos } from './mensagens-dos-conceitos';

function conceito(codigo: string, nome: string, ativo = true): TipoConceitoDto {
  return {
    id: codigo,
    codigo,
    ativo,
    definicao: {
      nome,
      descricao: null,
      natureza: { codigo: FormaDoConceitoCodigo.POR_OPCOES, rotulo: 'Categórico' },
      numerico: null,
      valores: [],
    },
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
  const recusa = (codigo: string, campo = 'conceitosAdmitidos'): RecusaDoServidor => ({
    campo,
    codigo,
    mensagem: 'da API',
    pagina: null,
  });

  it('troca a mensagem pela do código e mantém uma recusa por código', () => {
    const resultado = recusasComMensagemDosConceitos([
      recusa('uniplus.configuracao.tipo_etapa.conceito_inexistente'),
      recusa('uniplus.configuracao.tipo_etapa.conceito_inativo'),
    ]);

    expect(resultado).toHaveLength(2);
    expect(resultado[0].mensagem).toContain('não existe mais no catálogo');
    expect(resultado[1].mensagem).toContain('está desativado');
  });

  it('deixa como veio a recusa de código desconhecido e a de outro campo', () => {
    const outra = recusa('uniplus.configuracao.tipo_etapa.codigo_invalido', 'nome');
    const resultado = recusasComMensagemDosConceitos([outra, recusa('codigo.novo')]);

    expect(resultado).toContainEqual(outra);
    expect(resultado.find((item) => item.campo === 'conceitosAdmitidos')?.mensagem).toBe('da API');
  });

  it('não mexe em recusas sem o campo dos conceitos', () => {
    const lista = [recusa('x', 'nome')];

    expect(recusasComMensagemDosConceitos(lista)).toEqual(lista);
  });
});

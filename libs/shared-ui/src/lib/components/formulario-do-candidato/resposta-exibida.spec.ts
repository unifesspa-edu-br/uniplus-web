import { describe, expect, it } from 'vitest';

import { respostaExibida } from './resposta-exibida';

describe('respostaExibida', () => {
  it('mostra a opção escolhida pelo nome que o formulário dá, e o código quando não o dá', () => {
    const campo = {
      tipoRenderizacao: 'SELECAO_MULTIPLA',
      valoresSelecionaveis: [
        { codigo: 'LB_PPI', descricao: 'Escola pública, preto, pardo ou indígena' },
      ],
    };

    expect(respostaExibida(campo, ['LB_PPI', 'AC'])).toBe(
      'Escola pública, preto, pardo ou indígena, AC',
    );
  });

  it('mostra sim ou não, a data no formato brasileiro e o endereço por extenso', () => {
    expect(respostaExibida({ tipoRenderizacao: 'BOOLEANO' }, false)).toBe('Não');
    expect(respostaExibida({ tipoRenderizacao: 'DATA' }, '2001-03-09')).toBe('09/03/2001');
    expect(
      respostaExibida(
        { tipoRenderizacao: 'ENDERECO' },
        {
          cep: '68500000',
          logradouro: 'Folha 31',
          numero: '12',
          bairro: 'Nova Marabá',
          cidade: { nome: 'Marabá', uf: 'PA' },
        },
      ),
    ).toBe('Folha 31, 12 — Nova Marabá — Marabá/PA — CEP 68500000');
  });
});

describe('respostaExibida de telefone', () => {
  it('mostra o telefone com a máscara, e o que não é telefone como foi gravado', () => {
    const campo = { tipoRenderizacao: 'TEXTO', formato: 'TELEFONE' };

    expect(respostaExibida(campo, '61981951555')).toBe('(61) 98195-1555');
    expect(respostaExibida(campo, '6133334444')).toBe('(61) 3333-4444');
    expect(respostaExibida(campo, '619819')).toBe('619819');
  });
});

describe('respostaExibida de número', () => {
  it('mostra o número com todas as casas que o candidato digitou', () => {
    expect(respostaExibida({ tipoRenderizacao: 'NUMERO' }, 2.5678)).toBe('2,5678');
  });
});

describe('respostaExibida de município', () => {
  const campo = { tipoRenderizacao: 'MUNICIPIO' };

  it('mostra só o nome que ficou gravado no envio', () => {
    expect(respostaExibida(campo, { codigo: '2927408', rotulo: 'Salvador' })).toBe('Salvador');
  });

  it('diz que o nome não foi carregado quando o município vem só com o código', () => {
    const aviso = 'Nome do município não carregado (código IBGE 2927408)';

    expect(respostaExibida(campo, '2927408')).toBe(aviso);
    expect(respostaExibida(campo, { codigo: '2927408', rotulo: '' })).toBe(aviso);
  });

  it('mostra a cidade do endereço como veio gravada', () => {
    expect(
      respostaExibida(
        { tipoRenderizacao: 'ENDERECO' },
        { cep: '40020000', cidade: { codigoIbge: '2927408', nome: 'Salvador', uf: 'BA' } },
      ),
    ).toBe('Salvador/BA — CEP 40020000');
  });
});

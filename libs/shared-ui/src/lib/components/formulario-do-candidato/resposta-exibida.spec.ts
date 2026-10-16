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
  it('mostra o nome que o Geo devolveu; sem ele, o código com o rótulo', () => {
    const campo = { tipoRenderizacao: 'MUNICIPIO' };

    expect(respostaExibida(campo, '5002704', new Map([['5002704', 'Campo Grande — MS']]))).toBe(
      'Campo Grande — MS',
    );
    expect(respostaExibida(campo, '5002704', new Map())).toBe('Código IBGE 5002704');
  });
});

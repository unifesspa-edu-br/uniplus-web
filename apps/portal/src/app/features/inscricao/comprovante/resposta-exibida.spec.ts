import { describe, expect, it } from 'vitest';

import { nomePreferido, respostaExibida } from './resposta-exibida';

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

describe('respostaExibida de município', () => {
  it('mostra o nome que o Geo devolveu; sem ele, o código com o rótulo', () => {
    const campo = { tipoRenderizacao: 'MUNICIPIO' };

    expect(respostaExibida(campo, '5002704', new Map([['5002704', 'Campo Grande — MS']]))).toBe(
      'Campo Grande — MS',
    );
    expect(respostaExibida(campo, '5002704', new Map())).toBe('Código IBGE 5002704');
  });
});

describe('nomePreferido', () => {
  it('é o nome social quando o candidato o pediu e o preencheu; senão, o civil (CA-01)', () => {
    const civil = 'Fernanda Laura Nicole Drumond';

    expect(
      nomePreferido({ NOME: civil, DESEJA_NOME_SOCIAL: true, NOME_SOCIAL: 'Ariel Drumond' }),
    ).toBe('Ariel Drumond');
    expect(
      nomePreferido({ NOME: civil, DESEJA_NOME_SOCIAL: false, NOME_SOCIAL: 'Ariel Drumond' }),
    ).toBe(civil);
    expect(nomePreferido({ NOME: civil, DESEJA_NOME_SOCIAL: true, NOME_SOCIAL: '' })).toBe(civil);
  });
});

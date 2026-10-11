import { describe, expect, it } from 'vitest';

import { fatoEscolhivel, type CondicaoEmClausula, type FatoEscolhivel } from './condicoes-de-fatos';
import { descreverAlternativas, descreverCondicao } from './leitura-de-condicoes';

const COR_RACA = fatoEscolhivel({
  codigo: 'COR_RACA',
  nome: 'Cor/raça',
  dominio: 'CATEGORICO',
  valoresDominio: ['PRETA', 'PARDA', 'INDIGENA', 'NAO_DECLARADA'],
  valoresDominioDeclarados: [
    { codigo: 'PRETA', descricao: 'Preta' },
    { codigo: 'PARDA', descricao: 'Parda' },
    { codigo: 'INDIGENA', descricao: 'Indígena' },
    { codigo: 'NAO_DECLARADA', descricao: null },
  ],
  binding: 'CAMPO_INSCRICAO:corRaca',
}) as FatoEscolhivel;
const ESCOLA_PUBLICA = fatoEscolhivel({
  codigo: 'ESCOLA_PUBLICA',
  nome: 'Cursou o ensino médio em escola pública',
  dominio: 'BOOLEANO',
  binding: 'CAMPO_INSCRICAO:escolaPublica',
}) as FatoEscolhivel;
const FATOS = new Map([COR_RACA, ESCOLA_PUBLICA].map((fato) => [fato.codigo, fato]));

describe('leitura das condições', () => {
  it('nomeia o fato que saiu do catálogo e a condição ainda sem valor', () => {
    expect(descreverCondicao({ fato: 'RENDA', operador: 'IGUAL', valor: '1' }, undefined)).toBe(
      'RENDA — fora do catálogo',
    );
    expect(descreverCondicao({ fato: 'COR_RACA', operador: 'IGUAL', valor: '' }, COR_RACA)).toBe(
      'Cor/raça é (valor não escolhido)',
    );
  });

  it('mostra o valor pela descrição do cadastro, e pelo código só quando ele não tem descrição', () => {
    expect(
      descreverCondicao(
        { fato: 'COR_RACA', operador: 'EM', valor: '["PRETA","INDIGENA","NAO_DECLARADA"]' },
        COR_RACA,
      ),
    ).toBe('Cor/raça é um de Preta, Indígena, NAO_DECLARADA');
  });

  it('lê cada alternativa com as condições ligadas por "e", na ordem das cláusulas', () => {
    const condicoes: CondicaoEmClausula[] = [
      { clausula: 2, fato: 'COR_RACA', operador: 'IGUAL', valor: '"INDIGENA"' },
      { clausula: 1, fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: 'true' },
      { clausula: 1, fato: 'COR_RACA', operador: 'DIFERENTE', valor: '"PARDA"' },
    ];

    expect(descreverAlternativas(condicoes, FATOS)).toEqual([
      'Cursou o ensino médio em escola pública é sim e Cor/raça não é Parda',
      'Cor/raça é Indígena',
    ]);
  });
});

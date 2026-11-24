import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CondicaoDeFatoComponent } from './condicao-de-fato';
import { condicaoNova } from './condicoes/condicoes-em-clausulas';
import { problemaDaCondicao } from './condicoes/conferencia-da-condicao';
import {
  fatoEscolhivel,
  fatosEscolhiveis,
  operadorPadrao,
  rotuloDoOperador,
  type FatoDoCatalogo,
  type FatoEscolhivel,
} from './condicoes/fatos-escolhiveis';
import { descreverCondicao } from './leitura-de-condicoes';

const OFERTA_DA_API = [
  { codigo: 'MAIOR_IGUAL', rotulo: 'a partir de' },
  { codigo: 'IGUAL', rotulo: 'exatamente' },
];

const IDADE: FatoDoCatalogo = {
  codigo: 'IDADE',
  nome: 'Idade',
  dominio: { codigo: 'NUMERICO', rotulo: 'NUMERICO' },
  binding: 'ATRIBUTO_CANDIDATO:IDADE',
  operadoresAdmitidos: OFERTA_DA_API,
};

const escolhivel = (fato: FatoDoCatalogo): FatoEscolhivel => fatoEscolhivel(fato) as FatoEscolhivel;

describe('as comparações que a API admite para o fato', () => {
  it('a condição nova começa pela primeira comparação da lista', () => {
    expect(operadorPadrao(escolhivel(IDADE))).toBe('MAIOR_IGUAL');
    expect(condicaoNova(escolhivel(IDADE), 1).operador).toBe('MAIOR_IGUAL');
  });

  it('a conferência recusa a comparação fora da lista do fato', () => {
    const fatos = new Map([['IDADE', escolhivel(IDADE)]]);

    const recusa = problemaDaCondicao(
      { fato: 'IDADE', operador: 'MENOR_IGUAL', valor: '18' },
      fatos,
    );

    expect(recusa).toBe('"Idade" não admite a comparação escolhida');
    expect(problemaDaCondicao({ fato: 'IDADE', operador: 'IGUAL', valor: '18' }, fatos)).toBeNull();
  });

  it('a leitura usa o rótulo da API e cai para o código quando ele não vem', () => {
    const fato = escolhivel(IDADE);

    expect(rotuloDoOperador(fato, 'IGUAL')).toBe('exatamente');
    expect(rotuloDoOperador(fato, 'MENOR_IGUAL')).toBe('MENOR_IGUAL');
    expect(descreverCondicao({ fato: 'IDADE', operador: 'IGUAL', valor: '18' }, fato)).toBe(
      'Idade exatamente 18',
    );
  });

  it('o fato sem comparação admitida não é oferecido em condição', () => {
    const semOperadores = { ...IDADE, codigo: 'NOME', operadoresAdmitidos: [] };

    expect(fatosEscolhiveis([IDADE, semOperadores]).map((fato) => fato.codigo)).toEqual(['IDADE']);
    expect(operadorPadrao(escolhivel(semOperadores))).toBe('');
  });

  it('o seletor oferece as comparações do fato na ordem e com o rótulo da API', () => {
    const fixture = TestBed.createComponent(CondicaoDeFatoComponent);
    fixture.componentRef.setInput('condicao', { fato: 'IDADE', operador: 'IGUAL', valor: '' });
    fixture.componentRef.setInput('fatos', [escolhivel(IDADE)]);
    fixture.componentRef.setInput('idBase', 'teste');
    fixture.detectChanges();

    const opcoes = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>(
        '#teste-operador option',
      ),
    );

    expect(opcoes.map((opcao) => [opcao.value, opcao.textContent?.trim()])).toEqual([
      ['MAIOR_IGUAL', 'a partir de'],
      ['IGUAL', 'exatamente'],
    ]);
  });
});

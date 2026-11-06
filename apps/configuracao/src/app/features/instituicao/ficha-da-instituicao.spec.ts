import { describe, expect, it } from 'vitest';
import {
  NAO_INFORMADO,
  cidadeDaSede,
  linhaDoEndereco,
  textoOuNaoInformado,
} from './ficha-da-instituicao';
import { unifesspa } from './instituicao.testing';

const marabá = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };
const endereco = {
  cep: '68507590',
  logradouro: 'Folha 31',
  numero: '7',
  complemento: 'Sala 2',
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: marabá,
  latitude: null,
  longitude: null,
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
  displayAtualizadoEm: null,
};

describe('ficha da Instituição', () => {
  it('o campo opcional sem valor mostra o travessão', () => {
    expect(textoOuNaoInformado(null)).toBe(NAO_INFORMADO);
    expect(textoOuNaoInformado('   ')).toBe(NAO_INFORMADO);
    expect(textoOuNaoInformado(' 12 ')).toBe('12');
  });

  it('a cidade da sede vem do endereço e, na falta dele, da instituição', () => {
    expect(cidadeDaSede({ ...unifesspa, cidade: marabá, endereco: null })).toBe('Marabá — PA');
    expect(
      cidadeDaSede({ ...unifesspa, cidade: null, endereco: { ...endereco, cidade: marabá } }),
    ).toBe('Marabá — PA');
    expect(cidadeDaSede(unifesspa)).toBe(NAO_INFORMADO);
  });

  it('a linha do endereço junta número e complemento, bairro e distrito, sem partes em branco', () => {
    expect(linhaDoEndereco({ ...unifesspa, endereco })).toBe('Folha 31, 7 — Sala 2, Nova Marabá');
    expect(
      linhaDoEndereco({
        ...unifesspa,
        endereco: { ...endereco, numero: ' ', complemento: null, distrito: 'Distrito' },
      }),
    ).toBe('Folha 31, Nova Marabá, Distrito');
  });

  it('sem endereço, ou com todas as partes em branco, mostra o travessão', () => {
    expect(linhaDoEndereco(unifesspa)).toBe(NAO_INFORMADO);
    expect(
      linhaDoEndereco({
        ...unifesspa,
        endereco: { ...endereco, logradouro: null, numero: null, complemento: null, bairro: null },
      }),
    ).toBe(NAO_INFORMADO);
  });
});

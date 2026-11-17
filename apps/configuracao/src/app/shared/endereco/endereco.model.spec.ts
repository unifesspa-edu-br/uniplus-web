import { describe, expect, it } from 'vitest';
import { ehErroDeEndereco, enderecoEstruturadoDe, enderecoParaCommand } from './endereco.model';

describe('enderecoParaCommand (mapeamento para o command)', () => {
  it('com CEP de 8 dígitos envia cidade top-level + endereco aninhado', () => {
    const part = enderecoParaCommand({
      cep: '68507590',
      logradouro: 'Folha 31',
      numero: 's/n',
      complemento: null,
      bairro: 'Nova Marabá',
      distrito: null,
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      latitude: null,
      longitude: null,
      nivelResolucao: 'logradouro',
      origem: 'geo-api',
    });
    expect(part.cidadeCodigoIbge).toBe('1504208');
    expect(part.endereco).not.toBeNull();
    expect(part.endereco?.cep).toBe('68507590');
    expect(part.endereco?.nivelResolucao).toBe('logradouro');
  });

  it('envia a latitude e a longitude do campo de texto como número', () => {
    const part = enderecoParaCommand({
      cep: '68507590',
      logradouro: 'Folha 31',
      numero: 's/n',
      complemento: null,
      bairro: 'Nova Marabá',
      distrito: null,
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      latitude: '-5.368',
      longitude: '-49.118',
      nivelResolucao: 'logradouro',
      origem: 'geo-api',
    });
    expect(part.endereco?.latitude).toBe(-5.368);
    expect(part.endereco?.longitude).toBe(-49.118);
  });

  it('sem CEP envia só a cidade top-level e endereco nulo (fluxo sem CEP)', () => {
    const part = enderecoParaCommand({
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      distrito: null,
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      latitude: null,
      longitude: null,
      nivelResolucao: null,
      origem: 'manual',
    });
    expect(part.cidadeCodigoIbge).toBe('1504208');
    expect(part.endereco).toBeNull();
  });

  it('valor nulo zera cidade e endereco', () => {
    expect(enderecoParaCommand(null)).toEqual({
      cidadeCodigoIbge: null,
      cidadeNome: null,
      cidadeUf: null,
      endereco: null,
    });
  });
});

describe('enderecoEstruturadoDe (DTO → componente)', () => {
  it('endereco aninhado vira valor do componente coagindo lat/long numéricos', () => {
    const valor = enderecoEstruturadoDe(
      { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      {
        cep: '68507590',
        logradouro: 'Folha 31',
        numero: 's/n',
        complemento: null,
        bairro: 'Nova Marabá',
        distrito: null,
        cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
        latitude: -5.368,
        longitude: -49.118,
        nivelResolucao: 'logradouro',
        origem: 'geo-api',
      },
    );
    expect(valor?.cidade?.codigoIbge).toBe('1504208');
    expect(valor?.latitude).toBe('-5.368');
  });

  it('cidade sem endereço estruturado vira modo manual', () => {
    const valor = enderecoEstruturadoDe({ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }, null);
    expect(valor?.origem).toBe('manual');
    expect(valor?.cep).toBeNull();
  });

  it('sem cidade nem endereço devolve null', () => {
    expect(enderecoEstruturadoDe(null, null)).toBeNull();
  });
});

describe('ehErroDeEndereco (casamento por segmento, não substring)', () => {
  it('reconhece campos/códigos do endereço e cidade', () => {
    expect(ehErroDeEndereco('Endereco.Cep')).toBe(true);
    expect(ehErroDeEndereco('CidadeCodigoIbge')).toBe(true);
    expect(ehErroDeEndereco('uniplus.configuracao.endereco_referencia.cep_formato_invalido')).toBe(
      true,
    );
  });

  it('não classifica errado chaves que apenas contêm o trecho', () => {
    expect(ehErroDeEndereco('Concepcao')).toBe(false);
    expect(ehErroDeEndereco('Mantenedora')).toBe(false);
    expect(ehErroDeEndereco('Sigla')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { camposAncorados, normalizarNivel } from './endereco-geo.model';

describe('camposAncorados (governança por nivelResolucao)', () => {
  it('logradouro ancora cep, logradouro, bairro, distrito e cidade', () => {
    expect([...camposAncorados('logradouro')].sort()).toEqual(
      ['bairro', 'cep', 'cidade', 'distrito', 'logradouro'].sort(),
    );
  });

  it('bairro libera logradouro mas ancora bairro, distrito, cidade e cep', () => {
    const set = camposAncorados('bairro');
    expect(set.has('logradouro')).toBe(false);
    expect(set.has('bairro')).toBe(true);
    expect(set.has('distrito')).toBe(true);
    expect(set.has('cidade')).toBe(true);
    expect(set.has('cep')).toBe(true);
  });

  it('distrito libera logradouro e bairro, ancora distrito/cidade/cep', () => {
    const set = camposAncorados('distrito');
    expect(set.has('logradouro')).toBe(false);
    expect(set.has('bairro')).toBe(false);
    expect(set.has('distrito')).toBe(true);
    expect(set.has('cidade')).toBe(true);
  });

  it('cidade (faixa) ancora apenas cep e cidade', () => {
    expect([...camposAncorados('cidade')].sort()).toEqual(['cep', 'cidade'].sort());
  });

  it('sem resolução (null) não ancora nada', () => {
    expect(camposAncorados(null).size).toBe(0);
  });
});

describe('normalizarNivel', () => {
  it('mantém níveis conhecidos', () => {
    expect(normalizarNivel('bairro')).toBe('bairro');
  });
  it('coage valor desconhecido para o nível mais raso (cidade)', () => {
    expect(normalizarNivel('quadra')).toBe('cidade');
  });
  it('null permanece null', () => {
    expect(normalizarNivel(null)).toBe(null);
  });
});

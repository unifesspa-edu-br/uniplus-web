import { describe, expect, it } from 'vitest';
import {
  rotularCidadeETipo,
  rotularCursoCompleto,
  rotularCursoNaListagem,
  rotularGrauENivel,
  rotularLocalOferta,
  rotularTipoLocal,
  rotularUnidade,
  rotuloDoFormato,
  rotuloDoPrograma,
  rotuloDoRegimeDeFuncionamento,
  rotuloDoRegimeDeTurno,
  rotuloDosTurnos,
} from './rotulos-da-oferta';
import { engCiv, ige, maraba } from './ofertas-curso.testing';

describe('rótulos da oferta', () => {
  it('o curso aparece só pelo nome na listagem e com o código fora dela', () => {
    expect(rotularCursoNaListagem(engCiv)).toBe('Engenharia Civil');
    expect(rotularCursoCompleto(engCiv)).toBe('ENG-CIV — Engenharia Civil');
    expect(rotularGrauENivel(engCiv)).toBe('Bacharelado · Graduação');
  });

  it('o local e a unidade usam o tipo, a cidade e a sigla', () => {
    expect(rotularTipoLocal(maraba)).toBe('Campus sede');
    expect(rotularLocalOferta(maraba)).toBe('Campus sede — Marabá');
    expect(rotularCidadeETipo(maraba)).toBe('Marabá · Campus sede');
    expect(rotularUnidade({ sigla: ige.sigla, nome: ige.nome, tipo: ige.tipo })).toBe(
      'IGE · Instituto de Geociências e Engenharias · Instituto',
    );
  });

  it('um tipo de local ou um token que a versão desconhece aparece como veio', () => {
    expect(rotularTipoLocal({ ...maraba, tipo: 'novo' as never })).toBe('novo');
    expect(rotuloDoPrograma('NOVO')).toBe('NOVO');
    expect(rotuloDoFormato('NOVO')).toBe('NOVO');
    expect(rotuloDoRegimeDeTurno('NOVO')).toBe('NOVO');
    expect(rotuloDoRegimeDeFuncionamento('NOVO')).toBe('NOVO');
  });

  it('os turnos saem em ordem canônica, ligados por "e", e a lista vazia vira traço', () => {
    expect(rotuloDosTurnos(['VESPERTINO', 'MATUTINO'])).toBe('Matutino e Vespertino');
    expect(rotuloDosTurnos([])).toBe('—');
  });
});

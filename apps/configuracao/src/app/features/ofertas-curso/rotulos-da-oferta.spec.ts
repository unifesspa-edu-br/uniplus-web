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
import { engCiv, maraba, oferta } from './ofertas-curso.testing';
import { valoresDaOferta } from './valores-da-oferta.testing';

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
    expect(rotularUnidade(oferta.unidadeOfertante)).toBe(
      'IGE · Instituto de Geociências e Engenharias · Instituto',
    );
  });

  it('mostra os rótulos recebidos da API', () => {
    expect(rotuloDoPrograma(valoresDaOferta.programa)).toBe(valoresDaOferta.programa.rotulo);
    expect(rotuloDoFormato(valoresDaOferta.formato)).toBe(valoresDaOferta.formato.rotulo);
    expect(rotuloDoRegimeDeTurno(valoresDaOferta.regime)).toBe(valoresDaOferta.regime.rotulo);
    expect(rotuloDoRegimeDeFuncionamento(valoresDaOferta.funcionamento)).toBe(
      valoresDaOferta.funcionamento.rotulo,
    );
  });

  it('os turnos recebidos são ligados por "e" e a lista vazia vira traço', () => {
    expect(rotuloDosTurnos(valoresDaOferta.turnos)).toBe(
      valoresDaOferta.turnos.map((turno) => turno.rotulo).join(' e '),
    );
    expect(rotuloDosTurnos([])).toBe('—');
  });
});

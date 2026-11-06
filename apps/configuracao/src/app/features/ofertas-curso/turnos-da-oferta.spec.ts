import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  alternarTurno,
  cardinalidadeDeTurnos,
  compatibilidadeComRegimeDeTurno,
  descricaoDoRegime,
  dicaDosTurnos,
  manterOsMaisRecentes,
  opcoesDeTurno,
  regimeNaoReconhecido,
} from './turnos-da-oferta';
import { oferta } from './ofertas-curso.testing';

function grupo(
  regimeDeTurno: string,
  turnos: readonly string[],
  regimeDeFuncionamento = 'EXTENSIVO',
) {
  const g = new FormGroup({
    regimeDeTurno: new FormControl(regimeDeTurno, { nonNullable: true }),
    turnos: new FormControl(turnos, { nonNullable: true, validators: [cardinalidadeDeTurnos] }),
    regimeDeFuncionamento: new FormControl(regimeDeFuncionamento, {
      nonNullable: true,
      validators: [compatibilidadeComRegimeDeTurno],
    }),
  });
  g.controls.turnos.updateValueAndValidity();
  g.controls.regimeDeFuncionamento.updateValueAndValidity();
  return g;
}

describe('turnos da oferta', () => {
  it('mantém os mais recentes até o limite', () => {
    expect(manterOsMaisRecentes(['A', 'B', 'C'], 2)).toEqual(['B', 'C']);
    expect(manterOsMaisRecentes(['A'], 2)).toEqual(['A']);
  });

  it('a cardinalidade depende do regime declarado', () => {
    expect(grupo('REGULAR', ['MATUTINO']).controls.turnos.errors).toBeNull();
    expect(grupo('REGULAR', []).controls.turnos.errors).toEqual({ turnosObrigatorios: true });
    expect(grupo('REGULAR', ['MATUTINO', 'MATUTINO']).controls.turnos.errors).toEqual({
      turnoRepetido: true,
    });
    expect(grupo('INTEGRAL', ['MATUTINO']).controls.turnos.errors).toEqual({
      cardinalidadeTurnos: { regime: 'INTEGRAL', exigidos: 2 },
    });
    expect(grupo('INTEGRAL', ['MATUTINO', 'NOTURNO']).controls.turnos.errors).toBeNull();
    expect(
      grupo('ROTATIVO', ['MATUTINO', 'NOTURNO', 'VESPERTINO']).controls.turnos.errors,
    ).toBeNull();
  });

  it('Intensivo exige regime de turno Integral', () => {
    expect(grupo('REGULAR', [], 'INTENSIVO').controls.regimeDeFuncionamento.errors).toEqual({
      regimeFuncionamentoIncompativelRegimeTurno: { regimeDeTurno: 'REGULAR' },
    });
    expect(grupo('INTEGRAL', [], 'INTENSIVO').controls.regimeDeFuncionamento.errors).toBeNull();
    expect(grupo('REGULAR', [], 'EXTENSIVO').controls.regimeDeFuncionamento.errors).toBeNull();
  });

  it('alterna o turno e descarta o mais antigo quando passa do que o regime exige', () => {
    const controle = new FormControl<readonly string[]>([], { nonNullable: true });
    alternarTurno(controle, 'MATUTINO', 2);
    alternarTurno(controle, 'VESPERTINO', 2);
    alternarTurno(controle, 'NOTURNO', 2);
    expect(controle.value).toEqual(['VESPERTINO', 'NOTURNO']);
    alternarTurno(controle, 'NOTURNO', 2);
    expect(controle.value).toEqual(['VESPERTINO']);
    expect(controle.touched && controle.dirty).toBe(true);
    alternarTurno(controle, 'MATUTINO', null);
    alternarTurno(controle, 'NOTURNO', null);
    expect(controle.value).toEqual(['VESPERTINO', 'MATUTINO', 'NOTURNO']);
  });

  it('só trata como não reconhecido o regime que a lista conhecida não traz', () => {
    expect(regimeNaoReconhecido(null)).toBeNull();
    expect(regimeNaoReconhecido(oferta)).toBeNull();
    expect(regimeNaoReconhecido({ ...oferta, regimeDeTurno: 'ROTATIVO' })).toBe('ROTATIVO');
  });

  it('acrescenta às opções de turno só os tokens que a oferta traz e a versão desconhece', () => {
    expect(opcoesDeTurno(null)).toHaveLength(3);
    expect(opcoesDeTurno(oferta)).toHaveLength(3);
    const opcoes = opcoesDeTurno({ ...oferta, turnos: ['MADRUGADA', 'MADRUGADA'] });
    expect(opcoes).toHaveLength(4);
    expect(opcoes[3]).toEqual({
      value: 'MADRUGADA',
      label: 'MADRUGADA — não reconhecido por esta versão',
    });
  });

  it('descreve o regime e a dica dos turnos', () => {
    expect(descricaoDoRegime('REGULAR')).toBeTruthy();
    expect(descricaoDoRegime('ROTATIVO')).toContain('versão mais nova');
    expect(dicaDosTurnos(1)).toBe('Marque o turno em que a oferta funciona.');
    expect(dicaDosTurnos(2)).toBe('Marque os dois turnos distintos em que a oferta funciona.');
    expect(dicaDosTurnos(null)).toBe('Marque os turnos em que a oferta funciona.');
  });
});

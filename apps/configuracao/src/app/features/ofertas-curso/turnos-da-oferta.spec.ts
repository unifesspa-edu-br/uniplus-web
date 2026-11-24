import { FormControl, FormGroup } from '@angular/forms';
import {
  RegimeDeFuncionamentoCodigo,
  RegimeDeTurnoCodigo,
  TurnoOfertaCodigo,
} from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import {
  alternarTurno,
  cardinalidadeDeTurnos,
  compatibilidadeComRegimeDeTurno,
  dicaDosTurnos,
  manterOsMaisRecentes,
  turnosExigidosPorRegime,
} from './turnos-da-oferta';

function grupo(
  regimeDeTurno: RegimeDeTurnoCodigo,
  turnos: readonly TurnoOfertaCodigo[],
  regimeDeFuncionamento = RegimeDeFuncionamentoCodigo.EXTENSIVO,
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
    expect(
      grupo(RegimeDeTurnoCodigo.REGULAR, [TurnoOfertaCodigo.MATUTINO]).controls.turnos.errors,
    ).toBeNull();
    expect(grupo(RegimeDeTurnoCodigo.REGULAR, []).controls.turnos.errors).toEqual({
      turnosObrigatorios: true,
    });
    expect(
      grupo(RegimeDeTurnoCodigo.REGULAR, [TurnoOfertaCodigo.MATUTINO, TurnoOfertaCodigo.MATUTINO])
        .controls.turnos.errors,
    ).toEqual({
      turnoRepetido: true,
    });
    expect(
      grupo(RegimeDeTurnoCodigo.INTEGRAL, [TurnoOfertaCodigo.MATUTINO]).controls.turnos.errors,
    ).toEqual({
      cardinalidadeTurnos: { regime: RegimeDeTurnoCodigo.INTEGRAL, exigidos: 2 },
    });
    expect(
      grupo(RegimeDeTurnoCodigo.INTEGRAL, [TurnoOfertaCodigo.MATUTINO, TurnoOfertaCodigo.NOTURNO])
        .controls.turnos.errors,
    ).toBeNull();
  });

  it('Intensivo exige regime de turno Integral', () => {
    expect(
      grupo(RegimeDeTurnoCodigo.REGULAR, [], RegimeDeFuncionamentoCodigo.INTENSIVO).controls
        .regimeDeFuncionamento.errors,
    ).toEqual({
      regimeFuncionamentoIncompativelRegimeTurno: { regimeDeTurno: RegimeDeTurnoCodigo.REGULAR },
    });
    expect(
      grupo(RegimeDeTurnoCodigo.INTEGRAL, [], RegimeDeFuncionamentoCodigo.INTENSIVO).controls
        .regimeDeFuncionamento.errors,
    ).toBeNull();
    expect(
      grupo(RegimeDeTurnoCodigo.REGULAR, [], RegimeDeFuncionamentoCodigo.EXTENSIVO).controls
        .regimeDeFuncionamento.errors,
    ).toBeNull();
  });

  it('alterna o turno e descarta o mais antigo quando passa do que o regime exige', () => {
    const controle = new FormControl<readonly TurnoOfertaCodigo[]>([], { nonNullable: true });
    alternarTurno(controle, TurnoOfertaCodigo.MATUTINO, 2);
    alternarTurno(controle, TurnoOfertaCodigo.VESPERTINO, 2);
    alternarTurno(controle, TurnoOfertaCodigo.NOTURNO, 2);
    expect(controle.value).toEqual([TurnoOfertaCodigo.VESPERTINO, TurnoOfertaCodigo.NOTURNO]);
    alternarTurno(controle, TurnoOfertaCodigo.NOTURNO, 2);
    expect(controle.value).toEqual([TurnoOfertaCodigo.VESPERTINO]);
    expect(controle.touched && controle.dirty).toBe(true);
    alternarTurno(controle, TurnoOfertaCodigo.MATUTINO, null);
    alternarTurno(controle, TurnoOfertaCodigo.NOTURNO, null);
    expect(controle.value).toEqual([
      TurnoOfertaCodigo.VESPERTINO,
      TurnoOfertaCodigo.MATUTINO,
      TurnoOfertaCodigo.NOTURNO,
    ]);
  });

  it('descreve a dica dos turnos', () => {
    expect(dicaDosTurnos(1)).toBe('Marque o turno em que a oferta funciona.');
    expect(dicaDosTurnos(2)).toBe('Marque os dois turnos distintos em que a oferta funciona.');
    expect(dicaDosTurnos(null)).toBe('Marque os turnos em que a oferta funciona.');
  });
});

describe('regime de turno desconhecido do web', () => {
  it('não exige quantidade de turnos e deixa a API decidir', () => {
    const desconhecido = 'SEMESTRAL' as RegimeDeTurnoCodigo;
    expect(turnosExigidosPorRegime(desconhecido)).toBeNull();
    expect(turnosExigidosPorRegime(null)).toBeNull();
    expect(
      cardinalidadeDeTurnos(grupo(desconhecido, [TurnoOfertaCodigo.MATUTINO]).controls.turnos),
    ).toBeNull();
  });
});

import { AbstractControl, FormControl, ValidationErrors } from '@angular/forms';
import {
  RegimeDeFuncionamentoCodigo,
  RegimeDeTurnoCodigo,
  TurnoOfertaCodigo,
} from '@uniplus/shared-data/configuracao';

const TURNOS_POR_REGIME: Readonly<Record<RegimeDeTurnoCodigo, number>> = {
  [RegimeDeTurnoCodigo.REGULAR]: 1,
  [RegimeDeTurnoCodigo.INTEGRAL]: 2,
};

const ORDEM_DOS_TURNOS: Readonly<Record<TurnoOfertaCodigo, number>> = {
  [TurnoOfertaCodigo.MATUTINO]: 0,
  [TurnoOfertaCodigo.VESPERTINO]: 1,
  [TurnoOfertaCodigo.NOTURNO]: 2,
};

export function ordenarTurnos(turnos: readonly TurnoOfertaCodigo[]): readonly TurnoOfertaCodigo[] {
  return [...turnos].sort((a, b) => ORDEM_DOS_TURNOS[a] - ORDEM_DOS_TURNOS[b]);
}

/** Quantos turnos o regime exige; nulo quando o regime é desconhecido do web e a API decide. */
export function turnosExigidosPorRegime(
  regime: RegimeDeTurnoCodigo | null | undefined,
): number | null {
  return (regime && TURNOS_POR_REGIME[regime]) ?? null;
}

/** Descarta os turnos marcados há mais tempo até caber no limite do regime. */
export function manterOsMaisRecentes<T>(turnos: readonly T[], limite: number): readonly T[] {
  return turnos.length <= limite ? turnos : turnos.slice(turnos.length - limite);
}

/**
 * Antecipa no formulário a invariante que o agregado aplica (UNI-REQ-0137): `REGULAR` exige
 * exatamente um turno e `INTEGRAL`, exatamente dois distintos. O regime é lido do controle irmão,
 * declarado e nunca inferido da quantidade marcada. A API continua sendo a árbitra final: um regime
 * que o frontend não conhece não bloqueia o envio.
 */
export function cardinalidadeDeTurnos(control: AbstractControl): ValidationErrors | null {
  const turnos = (control.value ?? []) as readonly string[];
  if (turnos.length === 0) {
    return { turnosObrigatorios: true };
  }
  if (new Set(turnos).size !== turnos.length) {
    return { turnoRepetido: true };
  }
  const regime = control.parent?.get('regimeDeTurno')?.value as RegimeDeTurnoCodigo | undefined;
  const exigidos = turnosExigidosPorRegime(regime);
  return exigidos !== null && turnos.length !== exigidos
    ? { cardinalidadeTurnos: { regime, exigidos } }
    : null;
}

/**
 * Antecipa a compatibilidade entre as duas dimensões do regime (UNI-REQ-0138): `INTENSIVO` exige
 * regime de turno `INTEGRAL`. Vive no controle, e não numa subscrição que escreve `setErrors`, para
 * conviver no mesmo `errors` com `required`, `maxLength` e a recusa vinda da API.
 */
export function compatibilidadeComRegimeDeTurno(control: AbstractControl): ValidationErrors | null {
  if (control.value !== RegimeDeFuncionamentoCodigo.INTENSIVO) {
    return null;
  }
  const regimeDeTurno = control.parent?.get('regimeDeTurno')?.value as
    | RegimeDeTurnoCodigo
    | undefined;
  if (!regimeDeTurno || regimeDeTurno === RegimeDeTurnoCodigo.INTEGRAL) {
    return null;
  }
  return { regimeFuncionamentoIncompativelRegimeTurno: { regimeDeTurno } };
}

/**
 * Marca ou desmarca um turno. O controle guarda a ordem de marcação, não a canônica: quando a
 * marcação nova excede o que o regime exige, o turno mais antigo sai. Sob REGULAR marcar outro
 * turno substitui o anterior, e sob INTEGRAL um terceiro clique descarta o primeiro em vez de zerar
 * a seleção. A ordem canônica é aplicada na exibição e no envio.
 */
export function alternarTurno(
  control: FormControl<readonly TurnoOfertaCodigo[]>,
  token: TurnoOfertaCodigo,
  exigidos: number | null,
): void {
  const atuais = control.value;
  const proximos = atuais.includes(token)
    ? atuais.filter((turno) => turno !== token)
    : [...atuais, token];
  control.setValue(exigidos === null ? proximos : manterOsMaisRecentes(proximos, exigidos));
  control.markAsTouched();
  control.markAsDirty();
}

export function dicaDosTurnos(exigidos: number | null): string {
  if (exigidos === null) {
    return 'Marque os turnos em que a oferta funciona.';
  }
  return exigidos === 1
    ? 'Marque o turno em que a oferta funciona.'
    : 'Marque os dois turnos distintos em que a oferta funciona.';
}

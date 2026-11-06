import { AbstractControl, FormControl, ValidationErrors } from '@angular/forms';
import {
  OfertaCursoDto,
  REGIMES_DE_TURNO,
  REGIME_DE_FUNCIONAMENTO_INTENSIVO,
  REGIME_DE_TURNO_INTEGRAL,
  TURNOS_OFERTA,
  turnosExigidosPorRegime,
  type TurnoOfertaOption,
} from '@uniplus/shared-data/configuracao';

/** Descarta os turnos marcados há mais tempo até caber no limite do regime. */
export function manterOsMaisRecentes(turnos: readonly string[], limite: number): readonly string[] {
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
  const regime = control.parent?.get('regimeDeTurno')?.value as string | undefined;
  const exigidos = regime === undefined ? null : turnosExigidosPorRegime(regime);
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
  if (control.value !== REGIME_DE_FUNCIONAMENTO_INTENSIVO) {
    return null;
  }
  const regimeDeTurno = control.parent?.get('regimeDeTurno')?.value as string | undefined;
  if (!regimeDeTurno || regimeDeTurno === REGIME_DE_TURNO_INTEGRAL) {
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
  control: FormControl<readonly string[]>,
  token: string,
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

/**
 * Token de regime da oferta em edição que este frontend não conhece, de um backend mais novo. Vira
 * uma opção própria no seletor: sem ela o `select` renderiza em branco enquanto o modelo guarda o
 * valor, e o operador salvaria sem enxergar qual regime está preservando.
 */
export function regimeNaoReconhecido(oferta: OfertaCursoDto | null): string | null {
  const original = oferta?.regimeDeTurno;
  if (original === undefined) {
    return null;
  }
  return REGIMES_DE_TURNO.some((regime) => regime.value === original) ? null : original;
}

/**
 * Os três períodos conhecidos mais os tokens que a oferta em edição traz e este frontend não
 * conhece. Sem essa segunda parte o token ficaria invisível: o controle o preservaria, ele
 * satisfaria o validador de cardinalidade e poderia ser descartado sem o operador enxergar.
 */
export function opcoesDeTurno(oferta: OfertaCursoDto | null): readonly TurnoOfertaOption[] {
  const originais = oferta?.turnos ?? [];
  const naoReconhecidos = new Set(
    originais.filter((token) => !TURNOS_OFERTA.some((turno) => turno.value === token)),
  );
  return [
    ...TURNOS_OFERTA,
    ...[...naoReconhecidos].map((token) => ({
      value: token,
      label: `${token} — não reconhecido por esta versão`,
    })),
  ];
}

export function descricaoDoRegime(regimeDeTurno: string): string {
  const regime = REGIMES_DE_TURNO.find((item) => item.value === regimeDeTurno);
  return (
    regime?.descricao ??
    'Regime declarado por uma versão mais nova da API — a validação dos turnos fica com ela.'
  );
}

export function dicaDosTurnos(exigidos: number | null): string {
  if (exigidos === null) {
    return 'Marque os turnos em que a oferta funciona.';
  }
  return exigidos === 1
    ? 'Marque o turno em que a oferta funciona.'
    : 'Marque os dois turnos distintos em que a oferta funciona.';
}

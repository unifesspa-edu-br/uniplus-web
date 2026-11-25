import { Signal, computed, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormGroup, Validators } from '@angular/forms';
import {
  OfertaCursoDto,
  ProgramaDeOfertaCodigo,
  RegimeDeTurnoCodigo,
  TurnoOfertaCodigo,
} from '@uniplus/shared-data/configuracao';
import type { OfertaCursoForm } from './oferta-curso-form';
import { dicaDosTurnos, manterOsMaisRecentes, turnosExigidosPorRegime } from './turnos-da-oferta';
import type { VinculosEscolhidos } from './vinculos-da-oferta';

/** O que o formulário mostra do regime de oferta, derivado do que o operador já preencheu. */
export interface RegrasDoFormulario {
  /** Fora do programa Regular a base legal é obrigatória (ADR-0066). */
  readonly exigeBaseLegal: boolean;
  /** `null` quando o regime é de uma versão mais nova da API: a UI não impõe cardinalidade. */
  readonly turnosExigidos: number | null;
  readonly turnosMarcados: readonly TurnoOfertaCodigo[];
  readonly turnosHint: string;
}

export interface AcompanhamentoDoFormulario {
  readonly regras: Signal<RegrasDoFormulario>;
  /** Os três vínculos escolhidos, para o formulário descrevê-los. */
  readonly escolhidos: Signal<VinculosEscolhidos>;
}

function exigirBaseLegal(form: FormGroup<OfertaCursoForm>, exige: boolean): void {
  const control = form.controls.baseLegal;
  if (exige) {
    control.addValidators(Validators.required);
  } else {
    // A base legal só faz sentido fora do programa Regular; limpá-la ao voltar evita que um valor
    // inválido (acima do tamanho, digitado com outro programa) trave o envio sem campo visível
    // para corrigir. O ato de autorização, ao contrário, vale para qualquer programa e fica.
    control.removeValidators(Validators.required);
    control.setValue('');
  }
  control.updateValueAndValidity({ emitEvent: false });
}

/** Trocar o regime muda quantos turnos são exigidos; a seleção excedente sai pela mesma regra de `alternarTurno`. */
function ajustarTurnosAoRegime(
  form: FormGroup<OfertaCursoForm>,
  exigidos: number | null,
  marcados: readonly TurnoOfertaCodigo[],
): void {
  const reduzidos = exigidos === null ? marcados : manterOsMaisRecentes(marcados, exigidos);
  if (reduzidos.length !== marcados.length) {
    form.controls.turnos.setValue(reduzidos);
    return;
  }
  form.controls.turnos.updateValueAndValidity({ emitEvent: false });
}

function vinculosEscolhidos(form: FormGroup<OfertaCursoForm>): Signal<VinculosEscolhidos> {
  const { controls } = form;
  const cursoId = toSignal(controls.cursoId.valueChanges, { initialValue: controls.cursoId.value });
  const localOfertaId = toSignal(controls.localOfertaId.valueChanges, {
    initialValue: controls.localOfertaId.value,
  });
  const unidadeOfertanteOrigemId = toSignal(controls.unidadeOfertanteOrigemId.valueChanges, {
    initialValue: controls.unidadeOfertanteOrigemId.value,
  });
  return computed(() => ({
    cursoId: cursoId(),
    localOfertaId: localOfertaId(),
    unidadeOfertanteOrigemId: unidadeOfertanteOrigemId(),
  }));
}

interface SinaisDasRegras {
  readonly exigeBaseLegal: Signal<boolean>;
  readonly regime: Signal<RegimeDeTurnoCodigo>;
  readonly turnos: Signal<readonly TurnoOfertaCodigo[]>;
  readonly turnosExigidos: Signal<number | null>;
}

function sinaisDasRegras(form: FormGroup<OfertaCursoForm>): SinaisDasRegras {
  const { controls } = form;
  const exigeBaseLegal = acompanharBaseLegal(form);
  const regime = toSignal(controls.regimeDeTurno.valueChanges, {
    initialValue: controls.regimeDeTurno.value,
  });
  const turnos = toSignal(controls.turnos.valueChanges, { initialValue: controls.turnos.value });
  return {
    exigeBaseLegal,
    regime,
    turnos,
    turnosExigidos: computed(() => turnosExigidosPorRegime(regime())),
  };
}

function acompanharBaseLegal(form: FormGroup<OfertaCursoForm>): Signal<boolean> {
  const controle = form.controls.programaDeOferta;
  const programa = toSignal(controle.valueChanges, { initialValue: controle.value });
  return computed(() => programa() !== ProgramaDeOfertaCodigo.REGULAR);
}

function aplicarRegras(form: FormGroup<OfertaCursoForm>, sinais: SinaisDasRegras): void {
  effect(() => {
    const exige = sinais.exigeBaseLegal();
    untracked(() => exigirBaseLegal(form, exige));
  });
  effect(() => {
    const [exigidos, marcados] = [sinais.turnosExigidos(), sinais.turnos()];
    untracked(() => ajustarTurnosAoRegime(form, exigidos, marcados));
  });
  acompanharCompatibilidade(form, sinais.regime);
}

function acompanharCompatibilidade(
  form: FormGroup<OfertaCursoForm>,
  regime: Signal<RegimeDeTurnoCodigo>,
): void {
  effect(() => {
    regime();
    untracked(() =>
      form.controls.regimeDeFuncionamento.updateValueAndValidity({ emitEvent: false }),
    );
  });
}

function regrasDoFormulario(sinais: SinaisDasRegras): Signal<RegrasDoFormulario> {
  return computed(() => ({
    exigeBaseLegal: sinais.exigeBaseLegal(),
    turnosExigidos: sinais.turnosExigidos(),
    turnosMarcados: sinais.turnos(),
    turnosHint: dicaDosTurnos(sinais.turnosExigidos()),
  }));
}

/**
 * Liga as regras do formulário de oferta: código em caixa alta, base legal conforme o programa,
 * turnos conforme o regime de turno e a compatibilidade entre regime de funcionamento e de turno.
 * Chamar em contexto de injeção.
 */
export function acompanharRegrasDaOferta(
  form: FormGroup<OfertaCursoForm>,
  _ofertaEmEdicao: Signal<OfertaCursoDto | null>,
): AcompanhamentoDoFormulario {
  const sinais = sinaisDasRegras(form);
  aplicarRegras(form, sinais);
  return {
    escolhidos: vinculosEscolhidos(form),
    regras: regrasDoFormulario(sinais),
  };
}

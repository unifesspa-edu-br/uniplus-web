import { Signal, computed, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormGroup, Validators } from '@angular/forms';
import {
  OfertaCursoDto,
  PROGRAMA_DE_OFERTA_REGULAR,
  turnosExigidosPorRegime,
  type TurnoOfertaOption,
} from '@uniplus/shared-data/configuracao';
import type { OfertaCursoForm } from './oferta-curso-form';
import {
  descricaoDoRegime,
  dicaDosTurnos,
  manterOsMaisRecentes,
  opcoesDeTurno,
  regimeNaoReconhecido,
} from './turnos-da-oferta';
import type { VinculosEscolhidos } from './vinculos-da-oferta';

/** O que o formulário mostra do regime de oferta, derivado do que o operador já preencheu. */
export interface RegrasDoFormulario {
  /** Fora do programa Regular a base legal é obrigatória (ADR-0066). */
  readonly exigeBaseLegal: boolean;
  /** `null` quando o regime é de uma versão mais nova da API: a UI não impõe cardinalidade. */
  readonly turnosExigidos: number | null;
  readonly turnosMarcados: readonly string[];
  readonly opcoesDeTurno: readonly TurnoOfertaOption[];
  readonly regimeNaoReconhecido: string | null;
  readonly regimeDescricao: string;
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
  marcados: readonly string[],
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
  readonly regime: Signal<string>;
  readonly turnos: Signal<readonly string[]>;
  readonly turnosExigidos: Signal<number | null>;
}

function sinaisDasRegras(form: FormGroup<OfertaCursoForm>): SinaisDasRegras {
  const { controls } = form;
  const programa = toSignal(controls.programaDeOferta.valueChanges, {
    initialValue: controls.programaDeOferta.value,
  });
  const regime = toSignal(controls.regimeDeTurno.valueChanges, {
    initialValue: controls.regimeDeTurno.value,
  });
  const turnos = toSignal(controls.turnos.valueChanges, { initialValue: controls.turnos.value });
  return {
    exigeBaseLegal: computed(() => programa() !== PROGRAMA_DE_OFERTA_REGULAR),
    regime,
    turnos,
    turnosExigidos: computed(() => turnosExigidosPorRegime(regime())),
  };
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
  effect(() => {
    sinais.regime();
    untracked(() =>
      form.controls.regimeDeFuncionamento.updateValueAndValidity({ emitEvent: false }),
    );
  });
}

/**
 * Liga as regras que cruzam campos do formulário de oferta: base legal conforme o programa, turnos
 * conforme o regime de turno e a compatibilidade entre regime de funcionamento e de turno. Chamar
 * em contexto de injeção.
 */
export function acompanharRegrasDaOferta(
  form: FormGroup<OfertaCursoForm>,
  ofertaEmEdicao: Signal<OfertaCursoDto | null>,
): AcompanhamentoDoFormulario {
  const sinais = sinaisDasRegras(form);
  aplicarRegras(form, sinais);
  return {
    escolhidos: vinculosEscolhidos(form),
    regras: computed(() => ({
      exigeBaseLegal: sinais.exigeBaseLegal(),
      turnosExigidos: sinais.turnosExigidos(),
      turnosMarcados: sinais.turnos(),
      opcoesDeTurno: opcoesDeTurno(ofertaEmEdicao()),
      regimeNaoReconhecido: regimeNaoReconhecido(ofertaEmEdicao()),
      regimeDescricao: descricaoDoRegime(sinais.regime()),
      turnosHint: dicaDosTurnos(sinais.turnosExigidos()),
    })),
  };
}

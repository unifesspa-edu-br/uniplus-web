import { FormControl, FormGroup, Validators, type ValidatorFn } from '@angular/forms';

import { hojeNoFusoInstitucional } from '../wizard/shared/fuso-institucional';

const NUMERO_TAMANHO_MAXIMO = 60;
const ASSINANTE_TAMANHO_MAXIMO = 200;
const MOTIVO_TAMANHO_MAXIMO = 1000;

/** O que o modo e o tipo escolhido tornam obrigatório no formulário. */
export interface ExigenciasDoFormulario {
  readonly motivoDaCorrecao: boolean;
  readonly atoCorrigido: boolean;
  readonly tipoDoAto: boolean;
  readonly confirmacaoDaPolitica: boolean;
}

export function criarFormularioDaPublicacao() {
  return new FormGroup({
    tipoAtoCodigo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    numero: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(NUMERO_TAMANHO_MAXIMO)],
    }),
    dataPublicacao: new FormControl(hojeNoFusoInstitucional(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    assinante: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(ASSINANTE_TAMANHO_MAXIMO)],
    }),
    atoCorrigidoId: new FormControl('', { nonNullable: true }),
    motivoDaCorrecao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MOTIVO_TAMANHO_MAXIMO)],
    }),
    politicaDeDivulgacaoConfirmada: new FormControl(false, { nonNullable: true }),
  });
}

export type FormularioDaPublicacao = ReturnType<typeof criarFormularioDaPublicacao>;

/** Cada abertura começa de um formulário em branco, com a data de hoje. */
export function esvaziar(formulario: FormularioDaPublicacao): void {
  formulario.reset({
    tipoAtoCodigo: '',
    numero: '',
    dataPublicacao: hojeNoFusoInstitucional(),
    assinante: '',
    atoCorrigidoId: '',
    motivoDaCorrecao: '',
    politicaDeDivulgacaoConfirmada: false,
  });
}

/** Liga ou desliga a obrigatoriedade dos campos que dependem do modo e do tipo escolhido. */
export function ajustarObrigatoriedade(
  formulario: FormularioDaPublicacao,
  exigencias: ExigenciasDoFormulario,
): void {
  const { controls } = formulario;
  trocarObrigatoriedade(controls.motivoDaCorrecao, exigencias.motivoDaCorrecao);
  trocarObrigatoriedade(controls.atoCorrigidoId, exigencias.atoCorrigido);
  trocarObrigatoriedade(controls.tipoAtoCodigo, exigencias.tipoDoAto);
  trocarObrigatoriedade(
    controls.politicaDeDivulgacaoConfirmada,
    exigencias.confirmacaoDaPolitica,
    Validators.requiredTrue,
  );
}

function trocarObrigatoriedade<T extends string | boolean>(
  controle: FormControl<T>,
  obrigatorio: boolean,
  validador: ValidatorFn = Validators.required,
): void {
  if (obrigatorio) {
    controle.addValidators(validador);
  } else {
    controle.removeValidators(validador);
  }
  controle.updateValueAndValidity({ emitEvent: false });
}

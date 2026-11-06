import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarReferenciaReservaDemograficaCommand,
  CriarReferenciaReservaDemograficaCommand,
  ReferenciaReservaDemograficaDto,
} from '@uniplus/shared-data/configuracao';
import {
  controlNameFromBackendField,
  mensagemDeErroDoControle,
  nullIfBlank,
} from '../../shared/formulario';

export const BASE_LEGAL_PADRAO = 'Lei 12.711/2012, art. 10, III';

export interface ReservaForm {
  censoReferencia: FormControl<string>;
  ppiPercentual: FormControl<number | null>;
  quilombolaPercentual: FormControl<number | null>;
  pcdPercentual: FormControl<number | null>;
  baseLegal: FormControl<string>;
}

export type ValoresDaReserva = ReturnType<FormGroup<ReservaForm>['getRawValue']>;

export const RESERVA_EM_BRANCO: ValoresDaReserva = {
  censoReferencia: '',
  ppiPercentual: null,
  quilombolaPercentual: null,
  pcdPercentual: null,
  baseLegal: BASE_LEGAL_PADRAO,
};

const CONTROLES_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof ReservaForm>([
  'censoReferencia',
  'ppiPercentual',
  'quilombolaPercentual',
  'pcdPercentual',
  'baseLegal',
]);

const MENSAGEM_DE_DUPLICIDADE = 'Já existe uma referência ativa para este Censo.';
const MENSAGEM_DE_FAIXA = 'Informe um valor entre 0 e 100.';

const percentual = (): FormControl<number | null> =>
  new FormControl<number | null>(null, {
    validators: [Validators.required, Validators.min(0), Validators.max(100)],
  });

export function criarFormularioDeReserva(): FormGroup<ReservaForm> {
  return new FormGroup<ReservaForm>({
    censoReferencia: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(20)],
    }),
    ppiPercentual: percentual(),
    quilombolaPercentual: percentual(),
    pcdPercentual: percentual(),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
  });
}

export function valoresDaReserva(referencia: ReferenciaReservaDemograficaDto): ValoresDaReserva {
  return {
    censoReferencia: referencia.censoReferencia,
    ppiPercentual: referencia.ppiPercentual,
    quilombolaPercentual: referencia.quilombolaPercentual,
    pcdPercentual: referencia.pcdPercentual,
    baseLegal: referencia.baseLegal,
  };
}

export function controleDoCampoDoServidor(field: string): keyof ReservaForm | null {
  return controlNameFromBackendField<keyof ReservaForm>(field, CONTROLES_DO_SERVIDOR);
}

export function comandoDeCriacao(
  valores: ValoresDaReserva,
): CriarReferenciaReservaDemograficaCommand {
  return {
    censoReferencia: nullIfBlank(valores.censoReferencia),
    ppiPercentual: valores.ppiPercentual ?? 0,
    quilombolaPercentual: valores.quilombolaPercentual ?? 0,
    pcdPercentual: valores.pcdPercentual ?? 0,
    baseLegal: nullIfBlank(valores.baseLegal),
  };
}

export function comandoDeAtualizacao(
  id: string,
  valores: ValoresDaReserva,
): AtualizarReferenciaReservaDemograficaCommand {
  return { id, ...comandoDeCriacao(valores) };
}

/** A mensagem do campo: a do servidor ou a obrigatoriedade; no mais, a duplicidade, a faixa ou o tamanho. */
export function mensagemDoCampo(control: AbstractControl): string | null {
  const mensagem = mensagemDeErroDoControle(control);
  const erros = control.errors;
  if (mensagem === null || erros === null || erros['backend'] || erros['required']) {
    return mensagem;
  }
  if (erros['duplicado']) return MENSAGEM_DE_DUPLICIDADE;
  return erros['min'] || erros['max'] ? MENSAGEM_DE_FAIXA : mensagem;
}

import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { ProblemValidationError } from '@uniplus/shared-core/http';

/**
 * Prende ao controle a recusa que a API devolveu para o campo. O erro `backend` é o que
 * `mensagemDeErroDoControle` apresenta, e o controle é tocado para a mensagem aparecer.
 */
export function marcarRecusaDoServidor(
  controle: AbstractControl,
  code: string,
  message: string,
): void {
  controle.setErrors({ backend: { code, message } });
  controle.markAsTouched();
}

/**
 * A recusa do servidor vale para o envio que a causou: a causa pode ter sido corrigida em outro
 * campo, então ao reenviar só a validação local barra e quem confere de novo é a API. Sem
 * `emitEvent`, o descarte não passa por `valueChanges` como se fosse uma edição.
 */
export function descartarRecusasDoServidor(controle: AbstractControl): void {
  if (controle instanceof FormGroup || controle instanceof FormArray) {
    Object.values(controle.controls).forEach(descartarRecusasDoServidor);
  } else if (controle.hasError('backend')) {
    controle.updateValueAndValidity({ emitEvent: false });
  }
}

export const MENSAGEM_SEM_MAPEAMENTO =
  'Não foi possível mapear os erros de validação. Revise os campos.';

/**
 * Marca no formulário cada recusa de campo (`errors[]`) que a tela sabe mapear a um controle.
 * Devolve se alguma foi aplicada; sem nenhuma, quem chama mostra `MENSAGEM_SEM_MAPEAMENTO` em
 * vez de deixar o envio recusado sem explicação.
 */
export function marcarRecusasDosCampos<TNome extends string>(
  errors: ReadonlyArray<ProblemValidationError>,
  formulario: { readonly controls: Record<TNome, AbstractControl> },
  controleDoCampo: (campoDoServidor: string) => TNome | null,
): boolean {
  let aplicouAlgum = false;
  for (const recusa of errors) {
    const nome = controleDoCampo(recusa.field);
    if (nome === null) continue;
    marcarRecusaDoServidor(formulario.controls[nome], recusa.code, recusa.message);
    aplicouAlgum = true;
  }
  return aplicouAlgum;
}

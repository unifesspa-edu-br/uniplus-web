import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { paginaDoErro, ProblemDetails } from '@uniplus/shared-core/http';
import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

/** A recusa que a API fez a um campo, com o nome do campo no servidor para achar o controle. */
export interface RecusaDoServidor extends RecusaDoCampo {
  readonly campo: string;
}

/**
 * As recusas de campo (`errors[]`) do problema, cada uma já com a página que explica o código.
 * O problema sem `errors[]` não tem recusa de campo e devolve lista vazia.
 */
export function recusasDoProblema(problema: ProblemDetails): readonly RecusaDoServidor[] {
  return (problema.errors ?? []).map((erro) => ({
    campo: erro.field,
    codigo: erro.code,
    mensagem: erro.message,
    pagina: paginaDoErro(problema, erro.code),
  }));
}

/** As recusas da API presas ao controle; vazia quando o controle não tem recusa do servidor. */
export function recusasDoControle(controle: AbstractControl): readonly RecusaDoCampo[] {
  const backend = controle.errors?.['backend'] as { recusas: readonly RecusaDoCampo[] } | undefined;
  return backend?.recusas ?? [];
}

/**
 * Acrescenta ao controle a recusa que a API devolveu para o campo, junto das que já estavam ali.
 * O erro `backend` guarda a lista; `mensagemDeErroDoControle` apresenta o texto e o controle é
 * tocado para a mensagem aparecer. A recusa igual a uma já presa (mesmo código e mensagem) não
 * se repete.
 */
export function marcarRecusaDoServidor(
  controle: AbstractControl,
  codigo: string,
  mensagem: string,
  pagina: string | null = null,
): void {
  const presentes = recusasDoControle(controle);
  const repetida = presentes.some((r) => r.codigo === codigo && r.mensagem === mensagem);
  const recusas = repetida ? presentes : [...presentes, { codigo, mensagem, pagina }];
  controle.setErrors({ backend: { recusas } });
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

/**
 * Tira do controle só as recusas do servidor de um dos códigos dados e mantém as demais, que
 * seguem valendo para o campo. Sem `emitEvent`, como o descarte do envio.
 */
export function descartarRecusasDoServidorPorCodigo(
  controle: AbstractControl,
  codigos: ReadonlySet<string>,
): void {
  const restantes = recusasDoControle(controle).filter((recusa) => !codigos.has(recusa.codigo));
  if (restantes.length === recusasDoControle(controle).length) return;
  controle.updateValueAndValidity({ emitEvent: false });
  if (restantes.length > 0) {
    controle.setErrors(
      { ...controle.errors, backend: { recusas: restantes } },
      { emitEvent: false },
    );
  }
}

export const MENSAGEM_SEM_MAPEAMENTO =
  'Não foi possível mapear os erros de validação. Revise os campos.';

/**
 * Marca no formulário cada recusa de campo que a tela sabe mapear a um controle.
 * Devolve se alguma foi aplicada; sem nenhuma, quem chama mostra `MENSAGEM_SEM_MAPEAMENTO` em
 * vez de deixar o envio recusado sem explicação.
 */
export function marcarRecusasDosCampos<TNome extends string>(
  recusas: readonly RecusaDoServidor[],
  formulario: { readonly controls: Record<TNome, AbstractControl> },
  controleDoCampo: (campoDoServidor: string) => TNome | null,
): boolean {
  let aplicouAlgum = false;
  for (const recusa of recusas) {
    const nome = controleDoCampo(recusa.campo);
    if (nome === null) continue;
    const { codigo, mensagem, pagina } = recusa;
    marcarRecusaDoServidor(formulario.controls[nome], codigo, mensagem, pagina);
    aplicouAlgum = true;
  }
  return aplicouAlgum;
}

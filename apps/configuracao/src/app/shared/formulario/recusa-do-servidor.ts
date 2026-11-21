import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import {
  type CausaDeCampo,
  type CausaGeral,
  type ProblemDetails,
  separarCausas,
} from '@uniplus/shared-core/http';
import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

/** A recusa que a API fez a um campo, com o nome do campo no servidor para achar o controle. */
export interface RecusaDoServidor extends RecusaDoCampo {
  readonly campo: string;
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

/** A recusa de campo do problema que aponta o campo dado, sem diferenciar maiúsculas de minúsculas. */
export function causaDoCampo(problema: ProblemDetails, campo: string): CausaDeCampo | undefined {
  return separarCausas(problema.errors).deCampo.find(
    (causa) => causa.field.toLowerCase() === campo.toLowerCase(),
  );
}

/** O problema traz causa geral, que a tela mostra na área geral mesmo quando marcou campos. */
export function temCausaGeral(problema: ProblemDetails): boolean {
  return separarCausas(problema.errors).gerais.length > 0;
}

/** As mensagens das causas gerais em um só texto; `null` quando não há causa geral. */
export function textoDasCausasGerais(gerais: readonly CausaGeral[]): string | null {
  return gerais.length === 0 ? null : gerais.map((causa) => causa.message).join(' ');
}

/** As mensagens das causas gerais do problema em um só texto; `null` quando não há causa geral. */
export function textoDaCausaGeral(problema: ProblemDetails): string | null {
  return textoDasCausasGerais(separarCausas(problema.errors).gerais);
}

/**
 * O texto da área geral da tela depois de marcar os campos: as mensagens das causas gerais e, quando
 * há recusa de campo e nenhuma foi aplicada, `MENSAGEM_SEM_MAPEAMENTO`. A causa geral não é recusa
 * de campo sem mapa, então sozinha não aciona essa mensagem. Sem nada a dizer, devolve `null`.
 */
export function textoDaAreaGeral(
  aplicouAlgum: boolean,
  causas: { readonly deCampo: readonly unknown[]; readonly gerais: readonly CausaGeral[] },
): string | null {
  const semMapa = causas.deCampo.length > 0 && !aplicouAlgum ? MENSAGEM_SEM_MAPEAMENTO : null;
  const textos = [semMapa, textoDasCausasGerais(causas.gerais)].filter((texto) => texto !== null);
  return textos.length === 0 ? null : textos.join(' ');
}

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

/**
 * Marca os campos que a tela mapeia e devolve o que dizer na área geral: as causas gerais e, se
 * nenhuma recusa de campo achou controle, `MENSAGEM_SEM_MAPEAMENTO`; `null` quando não há o que dizer.
 */
export function aplicarRecusasDoProblema<TNome extends string>(
  recusas: {
    readonly deCampo: readonly RecusaDoServidor[];
    readonly gerais: readonly CausaGeral[];
  },
  formulario: { readonly controls: Record<TNome, AbstractControl> },
  controleDoCampo: (campoDoServidor: string) => TNome | null,
): string | null {
  const aplicou = marcarRecusasDosCampos(recusas.deCampo, formulario, controleDoCampo);
  return textoDaAreaGeral(aplicou, recusas);
}

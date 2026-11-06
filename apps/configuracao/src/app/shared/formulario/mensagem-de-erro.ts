import { AbstractControl } from '@angular/forms';

/**
 * A mensagem do primeiro erro do controle, só depois de tocado ou editado. O erro devolvido pelo
 * servidor (`backend`) vale mais que as regras locais, porque nomeia o motivo exato.
 */
export function mensagemDeErroDoControle(control: AbstractControl): string | null {
  const deveExibir = control.touched || control.dirty;
  if (!deveExibir || control.errors === null) {
    return null;
  }
  if (control.errors['backend']) {
    const backend = control.errors['backend'] as { code: string; message: string };
    return backend.message;
  }
  if (control.errors['required']) return 'Campo obrigatório.';
  if (control.errors['maxlength']) {
    return `Informe no máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
  }
  return 'Valor inválido.';
}

/**
 * A mensagem do campo de cadastro: a do servidor ou a obrigatoriedade; no mais, a regra de tamanho
 * mínimo ou de formato violada, que usa a mensagem de formato recebida.
 */
export function mensagemDeErroDoCampoComFormato(
  control: AbstractControl,
  mensagemDeFormato: string,
): string | null {
  const mensagem = mensagemDeErroDoControle(control);
  const erros = control.errors;
  if (mensagem === null || erros === null || erros['backend'] || erros['required']) {
    return mensagem;
  }
  if (erros['minlength']) {
    return `Informe ao menos ${erros['minlength'].requiredLength} caracteres.`;
  }
  return erros['pattern'] && !erros['maxlength'] ? mensagemDeFormato : mensagem;
}

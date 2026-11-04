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
  if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
  return 'Valor inválido.';
}

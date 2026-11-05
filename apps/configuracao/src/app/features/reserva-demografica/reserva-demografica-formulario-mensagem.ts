import { FormGroup } from '@angular/forms';
import { ReservaForm } from './edicao-das-reservas-demograficas';

export function mensagemDoCampo(
  form: FormGroup<ReservaForm>,
  nome: keyof ReservaForm,
): string | null {
  const control = form.controls[nome];
  const shouldShowError = control.touched || control.dirty;
  if (!shouldShowError || control.errors === null) {
    return null;
  }
  if (control.errors['backend']) {
    const backend = control.errors['backend'] as { code: string; message: string };
    return backend.message;
  }
  if (control.errors['duplicado']) return 'Já existe uma referência ativa para este Censo.';
  if (control.errors['required']) return 'Campo obrigatório.';
  if (control.errors['min'] || control.errors['max']) return 'Informe um valor entre 0 e 100.';
  if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
  return 'Valor inválido.';
}

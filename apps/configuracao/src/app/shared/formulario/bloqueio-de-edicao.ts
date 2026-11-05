import { AbstractControl, FormGroup } from '@angular/forms';

/**
 * Torna o formulário somente leitura e devolve a função que o libera. Bloqueia só os controles que
 * estavam habilitados e a liberação reabilita só esses: um controle desabilitado por regra de
 * negócio continua desabilitado, o que `form.disable()` seguido de `form.enable()` não garante.
 * A liberação revalida os controles, então deve vir antes de aplicar as recusas do servidor.
 */
export function bloquearEdicao(form: FormGroup): () => void {
  const bloqueados = Object.values(form.controls as Record<string, AbstractControl>).filter(
    (controle) => controle.enabled,
  );
  bloqueados.forEach((controle) => controle.disable({ emitEvent: false }));
  return () => bloqueados.forEach((controle) => controle.enable({ emitEvent: false }));
}

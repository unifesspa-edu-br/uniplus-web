import { signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../../shared/formulario';
import { LIMITE_DO_MOTIVO } from '../motivo-dialog.component';

/**
 * O motivo de um ato que fica na trilha, pedido num diálogo: valida antes de enviar, marca no campo
 * a recusa da API e pede o foco ao campo inválido, que o diálogo atende.
 */
export class CampoDoMotivo {
  readonly tentou = signal(false);
  /** Cresce a cada pedido de foco; o diálogo do motivo o atende no próprio campo. */
  readonly pedidoDeFoco = signal(0);
  readonly controle = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
  });

  reiniciar(): void {
    this.controle.reset('');
    this.tentou.set(false);
  }

  /** O motivo sem espaços nas pontas, ou `null` com o campo marcado e focado quando não serve. */
  exigir(): string | null {
    this.tentou.set(true);
    descartarRecusasDoServidor(this.controle);
    const motivo = this.controle.value.trim();
    if (!motivo) this.controle.setErrors({ required: true });
    if (this.controle.invalid) {
      this.focar();
      return null;
    }
    return motivo;
  }

  /** Marca no campo a recusa da API que fala do motivo; devolve `false` quando a recusa é de outro assunto. */
  recusar(problema: ProblemDetails): boolean {
    const doMotivo = problema.errors?.find((erro) => erro.field.toLowerCase() === 'motivo');
    if (!doMotivo) return false;
    marcarRecusaDoServidor(this.controle, doMotivo.code, doMotivo.message);
    this.focar();
    return true;
  }

  private focar(): void {
    this.pedidoDeFoco.update((n) => n + 1);
  }
}

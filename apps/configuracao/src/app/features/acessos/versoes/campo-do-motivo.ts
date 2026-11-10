import { ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../../shared/formulario';
import { LIMITE_DO_MOTIVO } from '../motivo-dialog.component';

/**
 * O motivo de um ato que fica na trilha, pedido num diálogo: valida antes de enviar, marca no campo
 * a recusa da API e leva o foco ao campo inválido. Criar em contexto de injeção, no serviço que
 * hospeda o diálogo.
 */
export class CampoDoMotivo {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly tentou = signal(false);
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
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('cfg-motivo-dialog [aria-invalid="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }
}

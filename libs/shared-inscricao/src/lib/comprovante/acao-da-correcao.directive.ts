import { Directive, TemplateRef, inject } from '@angular/core';
import type { ComprovanteDaInscricaoDto } from '@uniplus/shared-data/selecao';

/**
 * A ação de corrigir a inscrição, que o app projeta como `ng-template` para receber o comprovante
 * (`let-comprovante`) e montar o destino a partir dele. O comprovante a exibe em "Prazo para
 * correção", quando o prazo está aberto.
 */
@Directive({
  selector: 'ng-template[inscAcaoDaCorrecao]',
  standalone: true,
})
export class AcaoDaCorrecaoDirective {
  readonly modelo = inject<TemplateRef<{ $implicit: ComprovanteDaInscricaoDto }>>(TemplateRef);
}

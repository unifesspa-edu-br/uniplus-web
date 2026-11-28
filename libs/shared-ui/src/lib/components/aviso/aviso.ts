import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ReferenciaAoSuporte } from '@uniplus/shared-core/http';
import type { Notification, NotificationType } from '@uniplus/shared-core/notifications';
import { ReferenciaAoSuporteComponent } from '../referencia-ao-suporte/referencia-ao-suporte';

const ICONES: Record<NotificationType, string> = {
  success: '✓',
  warning: '!',
  error: '!',
  info: 'i',
};

type ReferenciaDoServidor = Extract<ReferenciaAoSuporte, { origem: 'servidor' }>;

function codigoDoErroDe(referencia: ReferenciaAoSuporte | undefined): string | null {
  return referencia?.origem === 'servidor' ? referencia.codigoDoErro : null;
}

/** Cada identificador anterior leva o mesmo código do erro da referência atual. */
function referenciasAnteriores(aviso: Notification): readonly ReferenciaDoServidor[] {
  const codigoDoErro = codigoDoErroDe(aviso.referencia);
  return aviso.identificadoresAnteriores.map((identificadorDoPedido) => ({
    origem: 'servidor',
    codigoDoErro,
    identificadorDoPedido,
  }));
}

/**
 * Cartão de um aviso: ícone, título, detalhe, contagem de ocorrências, referência ao suporte (a mais
 * recente) e, em seção recolhível, os identificadores anteriores. Não tem papel de anúncio: quem
 * anuncia ao leitor de tela é o `ui-notification-host`, uma vez por aviso.
 */
@Component({
  selector: 'ui-aviso',
  standalone: true,
  imports: [ReferenciaAoSuporteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aviso.html',
})
export class AvisoComponent {
  readonly aviso = input.required<Notification>();
  readonly fechar = output<void>();

  protected readonly rotuloDeFechar = 'Fechar notificação';
  protected readonly icone = computed(() => ICONES[this.aviso().type]);
  protected readonly anteriores = computed(() => referenciasAnteriores(this.aviso()));
}

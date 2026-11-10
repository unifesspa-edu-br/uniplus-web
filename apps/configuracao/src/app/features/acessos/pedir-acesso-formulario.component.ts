import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import type { FormDoPedido } from './pedir-acesso-campo';

/**
 * O quadro do formulário de pedido de acesso: o `<form>`, o fieldset que o torna somente leitura
 * durante o envio, o andamento, a recusa e o rodapé. Os campos entram por projeção.
 */
@Component({
  selector: 'cfg-pedir-acesso-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AlertComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedir-acesso-formulario.component.html',
})
export class PedirAcessoFormularioComponent {
  readonly form = input.required<FormDoPedido>();
  readonly enviando = input.required<boolean>();
  readonly aguardandoConfirmacao = input.required<boolean>();
  readonly faseDoEnvio = input.required<string | null>();
  /** A recusa do envio, mostrada junto ao botão que o fez. */
  readonly erro = input<string | null>(null);
  readonly enviar = output<void>();

  constructor() {
    // O formulário ocupa a página inteira: não há sobreposição a fechar.
    acompanharFocoDoEnvio({ salvando: this.enviando, aberto: computed(() => true) });
  }

  protected aoEnviar(): void {
    if (!this.enviando()) this.enviar.emit();
  }

  protected aoClicar(evento: Event): void {
    if (this.enviando()) evento.preventDefault();
  }
}

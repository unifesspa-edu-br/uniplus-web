import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { DialogComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-tipo-banca-remocao',
  standalone: true,
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-banca-remocao.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class TipoBancaRemocaoComponent {
  readonly aberto = model.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly mensagem = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly confirmar = output<void>();

  /**
   * Ao confirmar, o foco fica no botão: nem todo navegador o dá ao clique, e o foco não pode se
   * perder quando o resto do diálogo se desabilita.
   */
  protected aoConfirmar(evento: Event): void {
    if (this.removendo()) {
      evento.preventDefault();
      return;
    }
    (evento.currentTarget as HTMLElement).focus();
    this.confirmar.emit();
  }
}

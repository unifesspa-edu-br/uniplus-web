import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { DialogComponent } from '@uniplus/shared-ui/components';

/**
 * A confirmação de remoção de campus. Fica aberta durante a remoção, com o botão indisponível e
 * ainda focado, e com a recusa do servidor, para o foco nunca ficar sem destino.
 */
@Component({
  selector: 'cfg-campus-remocao',
  standalone: true,
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campus-remocao.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class CampusRemocaoComponent {
  readonly aberto = model.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly mensagem = input.required<string>();
  readonly erro = input.required<string | null>();
  /** Texto da região de status: o andamento e a recusa, que só fazem sentido com o diálogo aberto. */
  readonly anuncio = input.required<string>();
  readonly confirmar = output<void>();

  /** Enquanto remove, o botão está indisponível: o clique (e Enter ou Espaço) não remove de novo. */
  protected aoConfirmar(evento: Event): void {
    if (this.removendo()) {
      evento.preventDefault();
      return;
    }
    this.confirmar.emit();
  }
}

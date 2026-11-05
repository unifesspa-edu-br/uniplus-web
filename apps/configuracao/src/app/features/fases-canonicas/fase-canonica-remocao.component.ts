import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { DialogComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-fase-canonica-remocao',
  standalone: true,
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fase-canonica-remocao.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class FaseCanonicaRemocaoComponent {
  readonly aberto = model.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly mensagem = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly confirmar = output<void>();

  protected aoConfirmar(evento: Event): void {
    if (this.removendo()) evento.preventDefault();
    else this.confirmar.emit();
  }
}

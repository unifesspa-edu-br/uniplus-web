import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { DialogComponent } from '@uniplus/shared-ui/components';

/** O cadastro que a confirmação nomeia: a frase de abertura, o nome em negrito e, se houver, o código. */
export interface ItemDaConfirmacao {
  readonly abertura: string;
  readonly nome: string;
  readonly codigo?: string;
}

let sementeDoId = 0;

/**
 * A confirmação de remoção de um cadastro. Fica aberta durante a remoção, com o botão
 * indisponível e ainda focado, e com a recusa do servidor, para o foco nunca ficar sem destino.
 */
@Component({
  selector: 'cfg-confirmacao-de-remocao',
  standalone: true,
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirmacao-de-remocao.component.html',
  styleUrl: '../sobreposicao/sobreposicao.css',
})
export class ConfirmacaoDeRemocaoComponent {
  readonly aberto = model.required<boolean>();
  readonly titulo = input.required<string>();
  /** O verbo do botão de confirmação. */
  readonly rotulo = input('Remover');
  /** A cor do botão de confirmação: `danger` para o que apaga, `primary` para o que restaura. */
  readonly variante = input<'danger' | 'primary'>('danger');
  readonly removendo = input.required<boolean>();
  /** O cadastro nomeado antes da mensagem; ausente, só a mensagem aparece. */
  readonly item = input<ItemDaConfirmacao | null>(null);
  readonly mensagem = input.required<string>();
  readonly erro = input.required<string | null>();
  /** Texto da região de status: o andamento e a recusa, que só fazem sentido com o diálogo aberto. */
  readonly anuncio = input.required<string>();
  readonly confirmar = output<void>();
  /** O diálogo terminou de fechar e já devolveu o foco a quem o abriu. */
  readonly fechado = output<void>();
  /** O texto da mensagem, que o leitor de tela lê depois do título ao abrir o diálogo. */
  protected readonly idDaMensagem = `cfg-confirmacao-de-remocao-mensagem-${(sementeDoId += 1)}`;

  /**
   * Enquanto remove, o botão está indisponível: o clique (e Enter ou Espaço) não remove de novo.
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

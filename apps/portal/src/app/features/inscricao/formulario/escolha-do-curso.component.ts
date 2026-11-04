import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';

import type { OfertaDaInscricao } from '../oferta-da-inscricao';

/**
 * Os campos em que o candidato escolhe o curso: a 1ª opção e, quando o processo admite, a 2ª. Só mostra
 * o que recebe e diz o que o candidato escolheu; quem guarda a escolha é `EscolhaDoCurso`. O host não
 * tem caixa: os campos continuam itens do passo em que são projetados.
 */
@Component({
  selector: 'ptl-escolha-do-curso',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './escolha-do-curso.component.html',
  styleUrl: './escolha-do-curso.component.css',
})
export class EscolhaDoCursoComponent {
  readonly ofertas = input.required<readonly OfertaDaInscricao[]>();
  /** As ofertas da 2ª opção: todas, menos a escolhida na 1ª. */
  readonly ofertasDaSegunda = input.required<readonly OfertaDaInscricao[]>();
  readonly ofertaEscolhida = input<string | null>(null);
  /** A 1ª opção está escolhida e ainda é uma das ofertas do processo. */
  readonly primeiraEscolhida = input(false);
  readonly segundaEscolhida = input<string | null>(null);
  readonly comSegundaOpcao = input(false);
  readonly erroDaOferta = input<string | null>(null);
  readonly erroDaSegundaOferta = input<string | null>(null);
  /** Por que a 2ª opção foi limpa, até o candidato escolher de novo. */
  readonly avisoDaSegundaLimpa = input<string | null>(null);

  readonly escolherOferta = output<string | null>();
  readonly escolherSegundaOferta = output<string | null>();

  private readonly seletorDaOferta = viewChild<ElementRef<HTMLSelectElement>>('seletorDaOferta');
  private readonly seletorDaSegundaOferta =
    viewChild<ElementRef<HTMLSelectElement>>('seletorDaSegundaOferta');

  /** Os ids que descrevem o campo da 2ª opção: a ajuda, o aviso de que foi limpa e o erro. */
  protected readonly descricaoDaSegunda = computed(() =>
    [
      'inscricao-segunda-oferta-ajuda',
      this.avisoDaSegundaLimpa() ? 'inscricao-segunda-oferta-aviso' : null,
      this.erroDaSegundaOferta() ? 'inscricao-segunda-oferta-erro' : null,
    ]
      .filter((id) => id !== null)
      .join(' '),
  );

  /** O campo da 1ª opção, onde o foco vai para o candidato escolher o curso. */
  campoDaPrimeira(): HTMLElement | null {
    return this.seletorDaOferta()?.nativeElement ?? null;
  }

  /** O primeiro campo recusado: a 2ª opção só quando a 1ª não foi recusada e a 2ª aceita escolha. */
  campoRecusado(primeiraRecusada: boolean): HTMLElement | null {
    const segunda = this.seletorDaSegundaOferta()?.nativeElement;
    return !primeiraRecusada && segunda && !segunda.disabled ? segunda : this.campoDaPrimeira();
  }

  protected valorDe(evento: Event): string | null {
    const valor = (evento.target as HTMLSelectElement).value;
    return valor === '' ? null : valor;
  }
}

import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AlertComponent,
  EmptyStateComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
  TagComponent,
  acompanharLeitura,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import type { PublicacoesDoCertame } from './publicacoes.model';

/**
 * Accordion "Ver publicações" de um item de Editais — a linha do tempo dos atos publicados do
 * processo seletivo, cada um com o documento principal e os anexos quando houver. Puramente apresentacional: quem consulta o
 * repositório é a lista de editais; aqui só se decide o que mostrar enquanto o painel está aberto.
 */
@Component({
  selector: 'ptl-certame-publicacoes',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    DateBrPipe,
    AlertComponent,
    EmptyStateComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './certame-publicacoes.css',
  templateUrl: './certame-publicacoes.html',
})
export class CertamePublicacoesComponent {
  /** Identifica o certame — vira o sufixo dos ids do botão e do painel, únicos por item da lista. */
  readonly certameId = input.required<string>();
  /** Nome do certame — some no nome acessível do botão e da região, pra distinguir um item do outro (WCAG 2.4.9). */
  readonly certameNome = input('');
  readonly publicacoes = input<PublicacoesDoCertame | undefined>(undefined);
  readonly carregando = input(false);
  readonly erro = input(false);
  /** Pede de novo as publicações; quem as lê ligou `carregando` e `erro` antes de a espera começar. */
  readonly recarregar = output<void>();

  protected readonly aberto = signal(false);
  private readonly botao = viewChild<ElementRef<HTMLButtonElement>>('botao');

  /**
   * A falha e a espera são deste certame (`erro` e `carregando` vêm do mesmo item da vitrine), e o foco
   * da nova tentativa que dá certo volta ao botão do próprio accordion.
   */
  protected readonly leitura = acompanharLeitura({
    falha: computed(() => (this.erro() ? 'As publicações deste edital não foram carregadas.' : null)),
    pendente: this.carregando,
    recarregar: () => this.recarregar.emit(),
    destino: () => this.botao()?.nativeElement,
  });

  protected readonly botaoId = computed(() => `publicacoes-botao-${this.certameId()}`);
  protected readonly painelId = computed(() => `publicacoes-painel-${this.certameId()}`);

  protected alternar(): void {
    this.aberto.update((aberto) => !aberto);
  }
}

import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import {
  AlertComponent,
  EmptyStateComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import type { PublicacoesDoCertame } from './publicacoes.model';

/**
 * Accordion "Ver publicações" de um item de Editais — a linha do tempo dos atos publicados do
 * processo seletivo, cada um com o PDF quando houver. Puramente apresentacional: quem consulta o
 * repositório é a lista de editais; aqui só se decide o que mostrar enquanto o painel está aberto.
 */
@Component({
  selector: 'ptl-certame-publicacoes',
  standalone: true,
  imports: [DateBrPipe, AlertComponent, EmptyStateComponent, SpinnerComponent, TagComponent],
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

  protected readonly aberto = signal(false);

  protected readonly botaoId = computed(() => `publicacoes-botao-${this.certameId()}`);
  protected readonly painelId = computed(() => `publicacoes-painel-${this.certameId()}`);

  protected alternar(): void {
    this.aberto.update((aberto) => !aberto);
  }
}

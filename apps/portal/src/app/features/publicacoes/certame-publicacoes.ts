import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertComponent,
  EmptyStateComponent,
  SpinnerComponent,
  TagComponent,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import {
  CATEGORIA_EVENTO_LABEL,
  CATEGORIA_EVENTO_VARIANT,
  type CategoriaEvento,
  type EventoHistoricoPublicacao,
  type Publicacao,
} from './publicacoes.model';

/**
 * Accordion "Ver publicações" de um item de Editais — abre a linha do tempo
 * do processo seletivo (o que antes era a tela de detalhe do menu
 * Publicações). Puramente apresentacional: quem consulta o repositório é a
 * lista de editais, que traz as publicações de toda a página numa só
 * consulta; aqui só se decide o que mostrar enquanto o painel está aberto.
 */
@Component({
  selector: 'ptl-certame-publicacoes',
  standalone: true,
  imports: [RouterLink, DateBrPipe, AlertComponent, EmptyStateComponent, SpinnerComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './certame-publicacoes.css',
  templateUrl: './certame-publicacoes.html',
})
export class CertamePublicacoesComponent {
  /** Identifica o certame — vira o sufixo dos ids do botão e do painel, únicos por item da lista. */
  readonly certameId = input.required<string>();
  readonly publicacao = input<Publicacao | undefined>(undefined);
  readonly carregando = input(false);
  readonly erro = input(false);

  protected readonly aberto = signal(false);

  protected readonly botaoId = computed(() => `publicacoes-botao-${this.certameId()}`);
  protected readonly painelId = computed(() => `publicacoes-painel-${this.certameId()}`);

  /** Mais recente no topo, mais antigo embaixo. */
  protected readonly historico = computed<readonly EventoHistoricoPublicacao[]>(() => {
    const publicacao = this.publicacao();
    return publicacao ? [...publicacao.historico].sort((a, b) => b.data.localeCompare(a.data)) : [];
  });

  protected alternar(): void {
    this.aberto.update((aberto) => !aberto);
  }

  protected categoriaLabel(categoria: CategoriaEvento): string {
    return CATEGORIA_EVENTO_LABEL[categoria];
  }

  protected categoriaVariant(categoria: CategoriaEvento): UiTagVariant {
    return CATEGORIA_EVENTO_VARIANT[categoria];
  }
}

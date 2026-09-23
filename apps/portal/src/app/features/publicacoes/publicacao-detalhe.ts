import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  AlertComponent,
  EmptyStateComponent,
  PageHeaderComponent,
  SpinnerComponent,
  TagComponent,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import {
  CATEGORIA_EVENTO_LABEL,
  CATEGORIA_EVENTO_VARIANT,
  SITUACAO_PUBLICACAO_LABEL,
  SITUACAO_PUBLICACAO_VARIANT,
  type CategoriaEvento,
  type EventoHistoricoPublicacao,
  type Publicacao,
} from './publicacoes.model';
import { PublicacoesRepository } from './publicacoes.repository';

/**
 * Tela 2 do menu Publicações — detalhe de um edital e sua linha do tempo.
 * `id` vem da rota `:id` (binding automático — `withComponentInputBinding`
 * em `app.config.ts`), então a rota carrega direto, sem depender de estado
 * da listagem (CA-08). Dado servido por `PublicacoesRepository`, o mesmo
 * contrato usado pela listagem (CA-11).
 */
@Component({
  selector: 'ptl-publicacao-detalhe',
  standalone: true,
  imports: [
    RouterLink,
    DateBrPipe,
    AlertComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './publicacao-detalhe.css',
  templateUrl: './publicacao-detalhe.html',
})
export class PublicacaoDetalheComponent {
  readonly id = input.required<string>();

  private readonly repository = inject(PublicacoesRepository);
  private readonly destroyRef = inject(DestroyRef);

  private readonly resultado = signal<Publicacao | undefined>(undefined);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  private carregamentoEmAndamento: Subscription | undefined;

  protected readonly publicacao = computed(() => this.resultado());

  /** Mais recente no topo, mais antigo embaixo (CA-05). */
  protected readonly historico = computed<readonly EventoHistoricoPublicacao[]>(() => {
    const publicacao = this.publicacao();
    return publicacao ? [...publicacao.historico].sort((a, b) => b.data.localeCompare(a.data)) : [];
  });

  constructor() {
    // Reage a mudanças de `id()` — a rota carrega direto (CA-08) e, se um dia
    // um link levar de um detalhe a outro sem destruir o componente, a busca
    // acompanha o identificador atual em vez de ficar presa ao primeiro.
    effect(() => {
      this.id();
      untracked(() => this.carregar());
    });
    this.destroyRef.onDestroy(() => this.carregamentoEmAndamento?.unsubscribe());
  }

  protected statusLabel(): string {
    const publicacao = this.publicacao();
    return publicacao ? SITUACAO_PUBLICACAO_LABEL[publicacao.situacao] : '';
  }

  protected statusVariant(): UiTagVariant {
    const publicacao = this.publicacao();
    return publicacao ? SITUACAO_PUBLICACAO_VARIANT[publicacao.situacao] : 'neutral';
  }

  protected categoriaLabel(categoria: CategoriaEvento): string {
    return CATEGORIA_EVENTO_LABEL[categoria];
  }

  protected categoriaVariant(categoria: CategoriaEvento): UiTagVariant {
    return CATEGORIA_EVENTO_VARIANT[categoria];
  }

  protected tentarNovamente(): void {
    if (!this.carregando()) {
      this.carregar();
    }
  }

  /** Cada tentativa cancela a anterior — trocar de id rápido ou clicar "Tentar novamente" várias vezes não deixa uma resposta atrasada sobrepor a mais nova. */
  private carregar(): void {
    this.carregamentoEmAndamento?.unsubscribe();
    this.erro.set(null);
    this.carregando.set(true);
    this.carregamentoEmAndamento = this.repository.buscarPorId(this.id()).subscribe({
      next: (publicacao) => this.resultado.set(publicacao),
      error: () => {
        this.erro.set('Não foi possível carregar esta publicação.');
        this.carregando.set(false);
      },
      complete: () => this.carregando.set(false),
    });
  }
}

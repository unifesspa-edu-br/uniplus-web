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
import { Subscription } from 'rxjs';
import { EmptyStateComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { type EventoHistoricoPublicacao, type Publicacao } from './publicacoes.model';
import { PublicacoesRepository } from './publicacoes.repository';

/**
 * Documento de um evento da linha do tempo — aberto em nova aba a partir da
 * Tela 2 (é onde, futuramente, o candidato visualiza/baixa o PDF). Rota
 * fora do `PortalShellComponent` de propósito: sem o topo/nav do portal, uma
 * aba dedicada ao conteúdo do documento. Conteúdo ainda indefinido — por
 * ora, só o texto padrão abaixo. Dado servido por `PublicacoesRepository`,
 * o mesmo contrato usado pelas outras telas de Publicações (CA-11).
 */
@Component({
  selector: 'ptl-evento-documento',
  standalone: true,
  imports: [DateBrPipe, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './evento-documento.css',
  templateUrl: './evento-documento.html',
})
export class EventoDocumentoComponent {
  readonly id = input.required<string>();
  readonly eventoId = input.required<string>();

  private readonly repository = inject(PublicacoesRepository);
  private readonly destroyRef = inject(DestroyRef);

  private readonly publicacao = signal<Publicacao | undefined>(undefined);
  protected readonly carregando = signal(true);
  protected readonly erro = signal(false);
  private carregamentoEmAndamento: Subscription | undefined;

  protected readonly publicacaoTitulo = computed(() => this.publicacao()?.titulo ?? '');

  protected readonly evento = computed<EventoHistoricoPublicacao | undefined>(() =>
    this.publicacao()?.historico.find((evento) => evento.id === this.eventoId()),
  );

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.carregamentoEmAndamento?.unsubscribe();
        this.erro.set(false);
        this.carregando.set(true);
        this.carregamentoEmAndamento = this.repository.buscarPorId(id).subscribe({
          next: (publicacao) => this.publicacao.set(publicacao),
          error: () => {
            this.erro.set(true);
            this.carregando.set(false);
          },
          complete: () => this.carregando.set(false),
        });
      });
    });
    this.destroyRef.onDestroy(() => this.carregamentoEmAndamento?.unsubscribe());
  }
}

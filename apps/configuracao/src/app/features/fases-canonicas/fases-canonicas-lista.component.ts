import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import type { AndamentoDaEscrita } from './edicao-das-fases-canonicas';

type Acao = 'editar' | 'remover';

interface Acionador {
  readonly acao: Acao;
  readonly codigo: string;
}

@Component({
  selector: 'cfg-fases-canonicas-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fases-canonicas-lista.component.html',
})
export class FasesCanonicasListaComponent {
  readonly fases = input.required<readonly FaseCanonicaDto[]>();
  readonly carregando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly andamento = input.required<AndamentoDaEscrita | null>();
  readonly erro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly termoBusca = model.required<string>();
  readonly editar = output<FaseCanonicaDto>();
  readonly remover = output<FaseCanonicaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private acionador: Acionador | null = null;
  private acionadorDaGravacao: Acionador | null = null;

  constructor() {
    effect(() => {
      if (this.gravando()) {
        this.acionadorDaGravacao = this.acionador;
      } else if (this.acionadorDaGravacao) {
        const acionador = this.acionadorDaGravacao;
        this.acionadorDaGravacao = null;
        afterNextRender(() => this.devolverFoco(acionador), { injector: this.injector });
      }
    });
  }

  protected acionar(acao: Acao, fase: FaseCanonicaDto): void {
    this.acionador = { acao, codigo: fase.codigo };
    (acao === 'editar' ? this.editar : this.remover).emit(fase);
  }

  protected nomeDaAcao(acao: Acao, codigo: string): string {
    return `${acao === 'editar' ? 'Editar' : 'Remover'} fase canônica ${codigo}`;
  }

  /**
   * As ações da linha ficam indisponíveis enquanto a lista é gravada e recarregada, e um botão
   * desabilitado não recebe o foco que a sobreposição fechada tenta devolver. Terminada a recarga,
   * o foco volta ao acionador, se ainda existir e se ninguém o tomou nesse intervalo; sem ele
   * (fase removida ou fora do filtro), vai ao título da lista.
   */
  private devolverFoco({ acao, codigo }: Acionador): void {
    const ativo = document.activeElement;
    const livre = ativo === null || ativo === document.body;
    if (!livre) return;
    const raiz = this.raiz.nativeElement;
    const nome = this.nomeDaAcao(acao, codigo);
    const botao = [...raiz.querySelectorAll('button')].find(
      (item) => item.getAttribute('aria-label') === nome,
    );
    (botao ?? raiz.querySelector<HTMLElement>('#cfg-fases-canonicas-list-title'))?.focus();
  }
}

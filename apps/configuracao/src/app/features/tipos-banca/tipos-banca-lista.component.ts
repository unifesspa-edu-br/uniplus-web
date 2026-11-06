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
import { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
type Acao = 'editar' | 'remover';

interface Acionador {
  readonly acao: Acao;
  readonly codigo: string;
}

@Component({
  selector: 'cfg-tipos-banca-lista',
  standalone: true,
  imports: [EmptyStateComponent, FilterBarComponent, PagerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-banca-lista.component.html',
})
export class TiposBancaListaComponent {
  readonly bancas = input.required<readonly TipoBancaDto[]>();
  readonly carregando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly termoBusca = model.required<string>();
  readonly editar = output<TipoBancaDto>();
  readonly remover = output<TipoBancaDto>();
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

  protected acionar(acao: Acao, banca: TipoBancaDto): void {
    if (this.indisponivel()) return;
    this.acionador = { acao, codigo: banca.codigo };
    (acao === 'editar' ? this.editar : this.remover).emit(banca);
  }

  protected nomeDaAcao(acao: Acao, codigo: string): string {
    return `${acao === 'editar' ? 'Editar' : 'Remover'} tipo de banca ${codigo}`;
  }

  /**
   * Terminada a gravação e a recarga, o foco volta ao acionador, se ainda existir e se ninguém o
   * tomou nesse intervalo; sem ele (tipo removido, ou lista que não recarregou), vai ao título.
   */
  private devolverFoco({ acao, codigo }: Acionador): void {
    const ativo = document.activeElement;
    if (ativo !== null && ativo !== document.body) return;
    const raiz = this.raiz.nativeElement;
    const nome = this.nomeDaAcao(acao, codigo);
    const botao = [...raiz.querySelectorAll('button')].find(
      (item) => item.getAttribute('aria-label') === nome,
    );
    (botao ?? raiz.querySelector<HTMLElement>('#cfg-tipos-banca-list-title'))?.focus();
  }
}

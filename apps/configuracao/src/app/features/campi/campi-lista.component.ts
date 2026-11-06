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
  output,
} from '@angular/core';
import { CampusDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

type Acao = 'editar' | 'remover';

const VERBO_DA_ACAO: Readonly<Record<Acao, string>> = { editar: 'Editar', remover: 'Remover' };

/** De onde a pessoa acionou a escrita: o botão da linha, ou `null` para o cadastro. */
interface Acionador {
  readonly seletor: string | null;
}

/** O painel com a tabela de campi, o estado vazio e a paginação. */
@Component({
  selector: 'cfg-campi-lista',
  standalone: true,
  imports: [EmptyStateComponent, IconButtonComponent, PagerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campi-lista.component.html',
})
export class CampiListaComponent {
  readonly campi = input.required<readonly CampusDto[]>();
  readonly carregando = input.required<boolean>();
  /** Há escrita em curso, de qualquer tipo. */
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  /** Texto da região de status: o resultado da remoção, que o diálogo já não está aberto para dizer. */
  readonly anuncioDoResultado = input.required<string>();
  readonly mensagemDeErro = input.required<string | null>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();

  readonly cadastrar = output<void>();
  readonly editar = output<CampusDto>();
  readonly remover = output<CampusDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.removendo());

  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private acionador: Acionador | null = null;
  private acionadorDaGravacao: Acionador | null = null;

  constructor() {
    effect(() => {
      if (this.gravando()) {
        this.acionadorDaGravacao ??= this.acionador;
      } else if (!this.carregando() && this.acionadorDaGravacao !== null) {
        afterNextRender(() => this.devolverFoco(), { injector: this.injector });
      }
    });
  }

  protected pedirCadastro(): void {
    this.acionador = { seletor: null };
    this.cadastrar.emit();
  }

  protected acionar(acao: Acao, campus: CampusDto): void {
    this.acionador = {
      seletor: `tr[data-campus-id="${campus.id}"] button[aria-label^="${VERBO_DA_ACAO[acao]} campus"]`,
    };
    (acao === 'editar' ? this.editar : this.remover).emit(campus);
  }

  protected nomeDaAcao(acao: Acao, sigla: string): string {
    return `${VERBO_DA_ACAO[acao]} campus ${sigla}`;
  }

  protected cidadeLabel(campus: CampusDto): string {
    const cidade = campus.endereco?.cidade ?? campus.cidade;
    return cidade ? `${cidade.nome} — ${cidade.uf}` : '—';
  }

  /**
   * As ações da linha ficam indisponíveis durante a remoção e a recarga, e um botão indisponível
   * não recebe o foco que o diálogo ou o drawer fechado tenta devolver. Terminadas a escrita e a
   * recarga, o foco volta ao acionador, se a linha ainda existir e ninguém o tomou nesse
   * intervalo; sem ele (campus removido ou botão de cadastro que saiu da tela), vai ao título da lista.
   */
  private devolverFoco(): void {
    const acionador = this.acionadorDaGravacao;
    if (acionador === null || this.indisponivel() || this.gravando()) {
      return;
    }
    this.acionadorDaGravacao = null;
    if (!this.focoLivre()) {
      return;
    }
    const raiz = this.raiz.nativeElement;
    const botao =
      acionador.seletor === null ? null : raiz.querySelector<HTMLElement>(acionador.seletor);
    (botao ?? raiz.querySelector<HTMLElement>('#cfg-campi-list-title'))?.focus();
  }

  /** O botão de uma sobreposição fechada ainda consta como ativo até o navegador retirá-lo. */
  private focoLivre(): boolean {
    const ativo = document.activeElement;
    return (
      ativo === null || ativo === document.body || ativo.closest('dialog:not([open])') !== null
    );
  }
}

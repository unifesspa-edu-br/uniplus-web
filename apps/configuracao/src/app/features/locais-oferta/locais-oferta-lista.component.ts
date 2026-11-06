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
import { ResolucaoDeVinculo } from '@uniplus/shared-core/http';
import {
  LocalOfertaDto,
  TIPOS_LOCAL_OFERTA,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  EmptyStateComponent,
  IconButtonComponent,
  LookupLabelComponent,
  PagerComponent,
  SpinnerComponent,
  UiLookupFalho,
} from '@uniplus/shared-ui/components';

type Acao = 'editar' | 'remover';

const VERBO_DA_ACAO: Readonly<Record<Acao, string>> = { editar: 'Editar', remover: 'Remover' };

/** De onde a pessoa acionou a escrita: a ação sobre o local `id`, ou `null` para o cadastro. */
type Acionador = { readonly acao: Acao; readonly id: string } | null;

@Component({
  selector: 'cfg-locais-oferta-lista',
  standalone: true,
  imports: [
    AlertComponent,
    EmptyStateComponent,
    IconButtonComponent,
    LookupLabelComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './locais-oferta-lista.component.html',
})
export class LocaisOfertaListaComponent {
  readonly locais = input.required<readonly LocalOfertaDto[]>();
  readonly carregando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  readonly mensagemDeErro = input.required<string | null>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly falhas = input.required<readonly UiLookupFalho[]>();
  readonly resolucoes = input.required<ReadonlyMap<string, ResolucaoDeVinculo>>();
  readonly localAfetadoId = input.required<string | null>();
  readonly andamento = input.required<string>();
  readonly cadastrar = output<void>();
  readonly editar = output<LocalOfertaDto>();
  readonly remover = output<LocalOfertaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private acionador: Acionador = null;
  private acionadorDaGravacao: Acionador | undefined;

  constructor() {
    effect(() => {
      if (this.gravando()) {
        this.acionadorDaGravacao = this.acionador;
      } else if (this.acionadorDaGravacao !== undefined) {
        const acionador = this.acionadorDaGravacao;
        this.acionadorDaGravacao = undefined;
        afterNextRender(() => this.devolverFoco(acionador), { injector: this.injector });
      }
    });
  }

  protected tipoLabel(tipo: TipoLocalOferta): string {
    return TIPOS_LOCAL_OFERTA.find((item) => item.value === tipo)?.label ?? tipo;
  }

  protected cidadeLabel(local: LocalOfertaDto): string {
    const cidade = local.endereco?.cidade ?? local.cidade;
    return cidade ? `${cidade.nome} — ${cidade.uf}` : '—';
  }

  protected nomeDaAcao(acao: Acao, local: LocalOfertaDto): string {
    return `${VERBO_DA_ACAO[acao]} local de oferta ${this.tipoLabel(local.tipo)} — ${this.cidadeLabel(local)}`;
  }

  protected recarregar(falha: UiLookupFalho): void {
    falha.recarregar();
  }

  protected acionarCadastro(): void {
    this.acionador = null;
    this.cadastrar.emit();
  }

  protected acionarEdicao(local: LocalOfertaDto): void {
    this.acionador = { acao: 'editar', id: local.id };
    this.editar.emit(local);
  }

  protected acionarRemocao(local: LocalOfertaDto): void {
    this.acionador = { acao: 'remover', id: local.id };
    this.remover.emit(local);
  }

  /**
   * As ações ficam indisponíveis enquanto a lista é gravada e recarregada, e um botão
   * desabilitado não recebe o foco que a sobreposição fechada tenta devolver. Terminada a
   * recarga, o foco volta ao acionador, localizado pelo id do local e não pelo nome acessível
   * (que muda com o tipo e a cidade e se repete entre locais iguais), se a linha ainda existir e
   * se ninguém tomou o foco nesse intervalo; sem ele (local removido ou lista que falhou ao
   * recarregar), vai ao título da lista.
   */
  private devolverFoco(acionador: Acionador): void {
    if (!this.focoLivre()) return;
    const raiz = this.raiz.nativeElement;
    const botao =
      acionador === null
        ? raiz.querySelector<HTMLElement>('#cfg-locais-novo')
        : raiz.querySelector<HTMLElement>(
            `tr[data-local-id="${acionador.id}"] button[aria-label^="${VERBO_DA_ACAO[acionador.acao]} local"]`,
          );
    (botao ?? raiz.querySelector<HTMLElement>('#cfg-locais-list-title'))?.focus();
  }

  /** O botão de uma sobreposição fechada ainda consta como ativo até o navegador retirá-lo. */
  private focoLivre(): boolean {
    const ativo = document.activeElement;
    return (
      ativo === null || ativo === document.body || ativo.closest('dialog:not([open])') !== null
    );
  }
}

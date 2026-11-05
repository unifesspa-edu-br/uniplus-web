import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  COMPOSICOES_VAGAS,
  ModalidadeDto,
  NATUREZAS_LEGAIS,
  REGRAS_REMANEJAMENTO,
} from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  FilterChipsComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiFiltroAtivo,
  type UiFilterChipOption,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';

function rotulo(roster: readonly { value: string; label: string }[], token: string): string {
  return roster.find((opcao) => opcao.value === token)?.label ?? token;
}

const NATUREZA_VARIANTE: Readonly<Record<string, UiTagVariant>> = {
  AMPLA: 'info',
  COTA_RESERVADA: 'success',
  ACAO_AFIRMATIVA: 'warning',
};

@Component({
  selector: 'cfg-modalidades-lista',
  standalone: true,
  imports: [
    RouterLink,
    EmptyStateComponent,
    FilterBarComponent,
    FilterChipsComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidades-lista.component.html',
})
export class ModalidadesListaComponent {
  readonly busca = model('');
  readonly naturezaSelecionada = model<string | null>(null);
  readonly filtrosAtivos = input.required<readonly UiFiltroAtivo[]>();
  readonly chipsNatureza = input.required<readonly UiFilterChipOption[]>();
  readonly modalidadesFiltradas = input.required<readonly ModalidadeDto[]>();
  readonly quemConcorre = input.required<ReadonlyMap<string, string>>();
  readonly referencias = input.required<ReadonlyMap<string, ModalidadeDto[]>>();
  readonly loading = input.required<boolean>();
  readonly errorMessage = input.required<string | null>();
  readonly temFiltroAtivo = input.required<boolean>();
  readonly prevCursor = input.required<string | null>();
  readonly nextCursor = input.required<string | null>();
  readonly removendo = input.required<boolean>();
  readonly modalidadeEmRemocao = input<ModalidadeDto | null>(null);
  readonly limpar = output<void>();
  readonly remover = output<ModalidadeDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  private readonly injector = inject(Injector);
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');
  private removeuNoDialogo = false;

  constructor() {
    effect(() => {
      if (this.modalidadeEmRemocao() !== null) {
        this.removeuNoDialogo = true;
      } else if (!this.removendo() && this.removeuNoDialogo) {
        this.removeuNoDialogo = false;
        afterNextRender(() => this.focarTituloSeLivre(), { injector: this.injector });
      }
    });
  }

  /**
   * Durante a remoção e a recarga as ações da linha ficam indisponíveis, e um botão indisponível
   * não recebe o foco que o diálogo fechado deixou livre. Fechado o diálogo e terminada a recarga,
   * o foco vai ao título da lista, se ninguém o tomou nesse intervalo. Quando a lixeira de origem
   * ainda existe, o próprio navegador a refocaliza ao fechar o diálogo e o foco já não está livre.
   */
  private focarTituloSeLivre(): void {
    if (this.focoLivre()) this.titulo()?.nativeElement.focus();
  }

  /** O botão do diálogo fechado ainda consta como ativo até o navegador retirá-lo do foco. */
  private focoLivre(): boolean {
    const ativo = document.activeElement;
    return (
      ativo === null || ativo === document.body || ativo.closest('dialog:not([open])') !== null
    );
  }

  protected naturezaLabel(token: string): string {
    return rotulo(NATUREZAS_LEGAIS, token);
  }
  protected naturezaVariante(token: string): UiTagVariant {
    return NATUREZA_VARIANTE[token] ?? 'neutral';
  }
  protected composicaoLabel(token: string): string {
    return rotulo(COMPOSICOES_VAGAS, token);
  }
  protected referenciadaPor(codigo: string): readonly ModalidadeDto[] {
    return this.referencias().get(codigo) ?? [];
  }
  protected remanejamentoResumo(m: ModalidadeDto): string {
    if (m.regraRemanejamento === null) return '—';
    const regra = rotulo(REGRAS_REMANEJAMENTO, m.regraRemanejamento);
    if (m.remanejamentoDestino) return `${regra} → ${m.remanejamentoDestino}`;
    if (m.remanejamentoPar || m.remanejamentoFallback) {
      return `${regra} (${m.remanejamentoPar ?? '—'} / ${m.remanejamentoFallback ?? '—'})`;
    }
    return regra;
  }
}

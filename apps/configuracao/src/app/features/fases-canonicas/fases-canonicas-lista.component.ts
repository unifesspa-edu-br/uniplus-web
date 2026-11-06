import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';
import type { AndamentoDaEscrita } from '../../shared/escrita';

type Acao = 'editar' | 'remover';

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

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-fase-id',
    idDoTitulo: 'cfg-fases-canonicas-list-title',
  });

  protected acionar(acao: Acao, fase: FaseCanonicaDto): void {
    this.foco.registrar({ acao, id: fase.id });
    (acao === 'editar' ? this.editar : this.remover).emit(fase);
  }

  protected nomeDaAcao(acao: Acao, codigo: string): string {
    return `${acao === 'editar' ? 'Editar' : 'Remover'} fase canônica ${codigo}`;
  }
}

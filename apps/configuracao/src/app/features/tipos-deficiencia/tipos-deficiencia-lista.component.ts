import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { TipoDeficienciaDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';
import type { AndamentoDaEscrita } from './edicao-dos-tipos-deficiencia';

type Acao = 'editar' | 'remover';

const VERBO_DA_ACAO: Readonly<Record<Acao, string>> = { editar: 'Editar', remover: 'Remover' };

@Component({
  selector: 'cfg-tipos-deficiencia-lista',
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-deficiencia-lista.component.html',
})
export class TiposDeficienciaListaComponent {
  readonly tipos = input.required<readonly TipoDeficienciaDto[]>();
  readonly carregando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly andamento = input.required<AndamentoDaEscrita | null>();
  readonly erro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly termoBusca = model.required<string>();
  readonly cadastrar = output<void>();
  readonly editar = output<TipoDeficienciaDto>();
  readonly remover = output<TipoDeficienciaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-tipo-id',
    idDoTitulo: 'cfg-tipos-deficiencia-list-title',
    idDoCadastro: 'cfg-tipos-deficiencia-novo',
  });

  protected acionarCadastro(): void {
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionar(acao: Acao, tipo: TipoDeficienciaDto): void {
    this.foco.registrar({ acao, id: tipo.id });
    (acao === 'editar' ? this.editar : this.remover).emit(tipo);
  }

  protected nomeDaAcao(acao: Acao, codigo: string): string {
    return `${VERBO_DA_ACAO[acao]} tipo de deficiência ${codigo}`;
  }
}

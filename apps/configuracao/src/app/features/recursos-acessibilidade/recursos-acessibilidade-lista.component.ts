import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { RecursoAcessibilidadeDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';
import type { AndamentoDaEscrita } from './edicao-dos-recursos-acessibilidade';

type Acao = 'editar' | 'remover';

const VERBO_DA_ACAO: Readonly<Record<Acao, string>> = { editar: 'Editar', remover: 'Remover' };

@Component({
  selector: 'cfg-recursos-acessibilidade-lista',
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recursos-acessibilidade-lista.component.html',
})
export class RecursosAcessibilidadeListaComponent {
  readonly recursos = input.required<readonly RecursoAcessibilidadeDto[]>();
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
  readonly editar = output<RecursoAcessibilidadeDto>();
  readonly remover = output<RecursoAcessibilidadeDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-recurso-id',
    idDoTitulo: 'cfg-recursos-acessibilidade-list-title',
    idDoCadastro: 'cfg-recursos-acessibilidade-novo',
  });

  protected acionarCadastro(): void {
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionar(acao: Acao, recurso: RecursoAcessibilidadeDto): void {
    this.foco.registrar({ acao, id: recurso.id });
    (acao === 'editar' ? this.editar : this.remover).emit(recurso);
  }

  protected nomeDaAcao(acao: Acao, codigo: string): string {
    return `${VERBO_DA_ACAO[acao]} recurso de acessibilidade ${codigo}`;
  }
}

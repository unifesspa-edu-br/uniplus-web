import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { CursoDto } from '@uniplus/shared-data/configuracao';
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  ListFooterComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { textoExibivel } from '../../shared/codigo-e-rotulo';
import { devolverFocoDaLista } from '../../shared/foco';

/** O painel com a busca, a tabela de cursos, o estado vazio e a paginação. */
@Component({
  selector: 'cfg-cursos-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    ListFooterComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cursos-lista.component.html',
})
export class CursosListaComponent {
  readonly cursos = input.required<readonly CursoDto[]>();
  readonly carregando = input.required<boolean>();
  /** Há escrita em curso, ou a recarga que a segue ainda não terminou. */
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly mensagemDeErro = input.required<string | null>();
  readonly temBusca = input.required<boolean>();
  readonly limite = input.required<number>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly termoBusca = model.required<string>();

  readonly cadastrar = output<void>();
  readonly editar = output<CursoDto>();
  readonly remover = output<CursoDto>();
  readonly verOfertas = output<CursoDto>();
  readonly trocarLimite = output<number | null>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly opcoesLimite = DEFAULT_PAGE_SIZE_OPTIONS;
  protected readonly textoExibivel = textoExibivel;
  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-curso-id',
    idDoTitulo: 'cfg-cursos-list-title',
    idDoCadastro: 'cfg-cursos-novo',
  });

  protected acionarCadastro(): void {
    if (this.indisponivel()) return;
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionarEditar(curso: CursoDto): void {
    this.foco.registrar({ acao: 'editar', id: curso.id });
    this.editar.emit(curso);
  }

  protected acionarRemover(curso: CursoDto): void {
    this.foco.registrar({ acao: 'remover', id: curso.id });
    this.remover.emit(curso);
  }
}

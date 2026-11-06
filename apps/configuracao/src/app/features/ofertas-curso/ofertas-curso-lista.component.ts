import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { OfertaCursoDto } from '@uniplus/shared-data/configuracao';
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  EmptyStateComponent,
  IconButtonComponent,
  ListFooterComponent,
  LookupAlertComponent,
  LookupLabelComponent,
  SpinnerComponent,
  type CatalogoAcompanhado,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';
import type { LinhaDaOferta } from './linhas-da-oferta';
import {
  rotuloDoFormato,
  rotuloDoPrograma,
  rotuloDoRegimeDeFuncionamento,
  rotuloDoRegimeDeTurno,
  rotuloDosTurnos,
} from './rotulos-da-oferta';
import { ID_DO_TITULO_DA_LISTA } from './vinculos-da-oferta';

/** O painel com a tabela de ofertas, o estado vazio, o aviso dos catálogos e a paginação. */
@Component({
  selector: 'cfg-ofertas-curso-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    IconButtonComponent,
    ListFooterComponent,
    LookupAlertComponent,
    LookupLabelComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ofertas-curso-lista.component.html',
})
export class OfertasCursoListaComponent {
  readonly linhas = input.required<readonly LinhaDaOferta[]>();
  readonly total = input.required<number | null>();
  readonly carregando = input.required<boolean>();
  /** Há escrita em curso, ou a recarga que a segue ainda não terminou. */
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly mensagemDeErro = input.required<string | null>();
  readonly leituras = input.required<readonly CatalogoAcompanhado[]>();
  readonly limite = input.required<number>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();

  readonly cadastrar = output<void>();
  readonly editar = output<OfertaCursoDto>();
  readonly remover = output<OfertaCursoDto>();
  readonly trocarLimite = output<number | null>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly idDoTitulo = ID_DO_TITULO_DA_LISTA;
  protected readonly opcoesLimite = DEFAULT_PAGE_SIZE_OPTIONS;
  protected readonly programa = rotuloDoPrograma;
  protected readonly formato = rotuloDoFormato;
  protected readonly regimeDeTurno = rotuloDoRegimeDeTurno;
  protected readonly regimeDeFuncionamento = rotuloDoRegimeDeFuncionamento;
  protected readonly turnos = rotuloDosTurnos;
  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-oferta-id',
    idDoTitulo: ID_DO_TITULO_DA_LISTA,
    idDoCadastro: 'cfg-ofertas-novo',
  });

  protected acionarCadastro(): void {
    if (this.indisponivel()) return;
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionarEditar(oferta: OfertaCursoDto): void {
    this.foco.registrar({ acao: 'editar', id: oferta.id });
    this.editar.emit(oferta);
  }

  protected acionarRemover(oferta: OfertaCursoDto): void {
    this.foco.registrar({ acao: 'remover', id: oferta.id });
    this.remover.emit(oferta);
  }
}

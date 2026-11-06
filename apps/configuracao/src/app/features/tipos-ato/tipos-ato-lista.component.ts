import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import { formatIsoDateBr } from '@uniplus/shared-data/utils';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';

/** O painel com a busca, o recorte de vigência, a tabela de tipos de ato, o estado vazio e a paginação. */
@Component({
  selector: 'cfg-tipos-ato-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-ato-lista.component.html',
})
export class TiposAtoListaComponent {
  readonly atos = input.required<readonly TipoAtoPublicadoDto[]>();
  readonly carregando = input.required<boolean>();
  /** Há escrita em curso, ou a recarga que a segue ainda não terminou. */
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly termoBusca = model.required<string>();
  readonly somenteEmVigor = model.required<boolean>();
  readonly cadastrar = output<void>();
  readonly editar = output<TipoAtoPublicadoDto>();
  readonly remover = output<TipoAtoPublicadoDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());
  protected readonly temBusca = computed(() => this.termoBusca().trim().length > 0);
  protected readonly temFiltro = computed(() => this.temBusca() || this.somenteEmVigor());
  /** A listagem não tem busca no servidor: havendo outra página, o recorte local não a alcança. */
  protected readonly buscaLimitadaAPagina = computed(
    () => this.temBusca() && (this.temAnterior() || this.temProximo()),
  );

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-tipo-ato-id',
    idDoTitulo: 'cfg-tipos-ato-list-title',
    idDoCadastro: 'cfg-tipos-ato-novo',
  });

  protected acionarCadastro(): void {
    if (this.indisponivel()) return;
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionarEditar(ato: TipoAtoPublicadoDto): void {
    this.foco.registrar({ acao: 'editar', id: ato.id });
    this.editar.emit(ato);
  }

  protected acionarRemover(ato: TipoAtoPublicadoDto): void {
    this.foco.registrar({ acao: 'remover', id: ato.id });
    this.remover.emit(ato);
  }

  protected limparFiltros(): void {
    this.termoBusca.set('');
    this.somenteEmVigor.set(false);
  }

  /**
   * Nome de cada ação de linha. Mostrando as vigências encerradas, o mesmo código aparece em
   * várias linhas, e o código sozinho daria nome idêntico a ações que removem períodos diferentes.
   */
  protected identificacaoDaVigencia(ato: TipoAtoPublicadoDto): string {
    return `${ato.codigo}, vigência iniciada em ${formatIsoDateBr(ato.vigenciaInicio)}`;
  }

  protected periodo(ato: TipoAtoPublicadoDto): string {
    return ato.vigenciaFim === null
      ? `Desde ${formatIsoDateBr(ato.vigenciaInicio)}`
      : `De ${formatIsoDateBr(ato.vigenciaInicio)} até antes de ${formatIsoDateBr(ato.vigenciaFim)}`;
  }
}

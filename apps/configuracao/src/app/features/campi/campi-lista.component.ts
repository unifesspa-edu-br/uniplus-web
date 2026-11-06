import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CampusDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';

type Acao = 'editar' | 'remover';

const VERBO_DA_ACAO: Readonly<Record<Acao, string>> = { editar: 'Editar', remover: 'Remover' };

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

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-campus-id',
    idDoTitulo: 'cfg-campi-list-title',
  });

  protected pedirCadastro(): void {
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionar(acao: Acao, campus: CampusDto): void {
    this.foco.registrar({ acao, id: campus.id });
    (acao === 'editar' ? this.editar : this.remover).emit(campus);
  }

  protected nomeDaAcao(acao: Acao, sigla: string): string {
    return `${VERBO_DA_ACAO[acao]} campus ${sigla}`;
  }

  protected cidadeLabel(campus: CampusDto): string {
    const cidade = campus.endereco?.cidade ?? campus.cidade;
    return cidade ? `${cidade.nome} — ${cidade.uf}` : '—';
  }
}

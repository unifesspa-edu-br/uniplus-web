import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { CondicaoAtendimentoDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';
import { CODIGO_RESERVADO } from './condicao-atendimento-form';
import type { AndamentoDaEscrita } from './edicao-das-condicoes-atendimento';

type Acao = 'editar' | 'remover';

const VERBO_DA_ACAO: Readonly<Record<Acao, string>> = { editar: 'Editar', remover: 'Remover' };

@Component({
  selector: 'cfg-condicoes-atendimento-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './condicoes-atendimento-lista.component.html',
})
export class CondicoesAtendimentoListaComponent {
  readonly condicoes = input.required<readonly CondicaoAtendimentoDto[]>();
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
  readonly editar = output<CondicaoAtendimentoDto>();
  readonly remover = output<CondicaoAtendimentoDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());
  protected readonly codigoReservado = CODIGO_RESERVADO;

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-condicao-id',
    idDoTitulo: 'cfg-condicoes-atendimento-list-title',
    idDoCadastro: 'cfg-condicoes-atendimento-novo',
  });

  protected acionarCadastro(): void {
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionar(acao: Acao, condicao: CondicaoAtendimentoDto): void {
    this.foco.registrar({ acao, id: condicao.id });
    (acao === 'editar' ? this.editar : this.remover).emit(condicao);
  }

  protected nomeDaAcao(acao: Acao, codigo: string): string {
    return `${VERBO_DA_ACAO[acao]} condição de atendimento ${codigo}`;
  }
}

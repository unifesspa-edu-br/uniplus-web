import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';
import type { AndamentoDaEscrita } from './edicao-dos-tipos-processo';

@Component({
  selector: 'cfg-tipos-processo-lista',
  imports: [
    TemPermissaoDirective,
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-processo-lista.component.html',
})
export class TiposProcessoListaComponent {
  readonly tipos = input.required<readonly TipoProcessoDto[]>();
  readonly carregando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly andamento = input.required<AndamentoDaEscrita | null>();
  readonly erro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly descricaoVazia = input.required<string>();
  readonly termoBusca = model.required<string>();
  readonly cadastrar = output<void>();
  readonly editar = output<TipoProcessoDto>();
  readonly remover = output<TipoProcessoDto>();
  readonly reativar = output<TipoProcessoDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly permissaoDeManter = PERMISSAO.configuracao.tiposProcessoManter;
  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-tipo-processo-id',
    idDoTitulo: 'cfg-tipos-processo-list-title',
    idDoCadastro: 'cfg-tipos-processo-novo',
  });

  protected acionarCadastro(): void {
    if (this.indisponivel()) return;
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionarEditar(tipo: TipoProcessoDto): void {
    this.foco.registrar({ acao: 'editar', id: tipo.id });
    this.editar.emit(tipo);
  }

  /** Os nomes de desativar e de reativar começam por "Desativar " e "Reativar ": é o que a devolução de foco procura na linha. */
  protected acionarDesativar(tipo: TipoProcessoDto): void {
    this.foco.registrar({ acao: 'situacao', id: tipo.id });
    this.remover.emit(tipo);
  }

  protected acionarReativar(tipo: TipoProcessoDto): void {
    this.foco.registrar({ acao: 'situacao', id: tipo.id });
    this.reativar.emit(tipo);
  }
}

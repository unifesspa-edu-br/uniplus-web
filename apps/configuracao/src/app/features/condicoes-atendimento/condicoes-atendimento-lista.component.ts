import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CondicaoAtendimentoDto } from '@uniplus/shared-data/configuracao';
import { EmptyStateComponent, PagerComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-condicoes-atendimento-lista',
  imports: [EmptyStateComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './condicoes-atendimento-lista.component.html',
})
export class CondicoesAtendimentoListaComponent {
  readonly condicoesFiltradas = input.required<readonly CondicaoAtendimentoDto[]>();
  readonly carregando = input.required<boolean>();
  readonly indisponivel = input.required<boolean>();
  readonly mensagemDeErro = input.required<string | null>();
  readonly termoBusca = input.required<string>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly linhaEmAndamento = input.required<string | null>();
  readonly rotuloAndamento = input.required<string>();
  readonly buscaAlterada = output<string>();
  readonly cadastrar = output<void>();
  readonly editar = output<CondicaoAtendimentoDto>();
  readonly remover = output<CondicaoAtendimentoDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected aoDigitar(evento: Event): void {
    this.alterarBusca((evento.target as HTMLInputElement).value);
  }
  protected alterarBusca(valor: string): void {
    if (!this.indisponivel()) this.buscaAlterada.emit(valor);
  }
  protected limparBusca(): void {
    this.alterarBusca('');
  }
  protected cadastrarCondicao(): void {
    if (!this.indisponivel()) this.cadastrar.emit();
  }
  protected editarCondicao(condicao: CondicaoAtendimentoDto): void {
    if (!this.indisponivel()) this.editar.emit(condicao);
  }
  protected removerCondicao(condicao: CondicaoAtendimentoDto): void {
    if (!this.indisponivel() && condicao.codigo !== 'PCD') this.remover.emit(condicao);
  }
}

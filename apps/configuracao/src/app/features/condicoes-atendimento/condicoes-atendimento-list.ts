import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import {
  AlertComponent,
  SkeletonComponent,
  SpinnerComponent,
  DialogComponent,
} from '@uniplus/shared-ui/components';
import { CondicoesAtendimentoListaComponent } from './condicoes-atendimento-lista.component';
import { CondicaoAtendimentoFormularioComponent } from './condicao-atendimento-formulario.component';
import { CondicoesAtendimentoStore } from './condicoes-atendimento.store';
import { EdicaoDasCondicoesAtendimento } from './edicao-das-condicoes-atendimento';

@Component({
  selector: 'cfg-condicoes-atendimento-list',
  imports: [
    AlertComponent,
    SkeletonComponent,
    SpinnerComponent,
    DialogComponent,
    CondicoesAtendimentoListaComponent,
    CondicaoAtendimentoFormularioComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './condicoes-atendimento-list.html',
  providers: [CondicoesAtendimentoStore, EdicaoDasCondicoesAtendimento],
  host: { class: 'cfg-page' },
})
export class CondicoesAtendimentoListPage {
  protected readonly store = inject(CondicoesAtendimentoStore);
  protected readonly edicao = inject(EdicaoDasCondicoesAtendimento);
  protected readonly loading = this.store.carregando;
  protected readonly prevCursor = this.store.anterior;
  protected readonly nextCursor = this.store.proximo;
  protected readonly condicoes = this.store.condicoes;
  protected readonly condicoesFiltradas = this.store.condicoesFiltradas;
  protected readonly errorMessage = this.store.mensagemDeErro;
  protected readonly termoBusca = this.store.termoBusca;
  protected readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);
  readonly formOpen = this.edicao.formOpen;
  readonly saving = this.edicao.saving;
  readonly salvando = this.edicao.salvando;
  readonly removendo = this.edicao.removendo;
  readonly modo = this.edicao.modo;
  readonly idempotencyKeyAtual = this.edicao.idempotencyKeyAtual;
  readonly formHeading = this.edicao.formHeading;
  readonly condicaoEmEdicaoId = this.edicao.condicaoEmEdicaoId;
  readonly form = this.edicao.form;
  readonly formError = this.edicao.formError;
  readonly condicaoParaRemover = this.edicao.condicaoParaRemover;
  readonly confirmOpen = this.edicao.confirmOpen;
  readonly abrirDrawerCriacao = () => this.edicao.abrirDrawerCriacao();
  readonly abrirEdicao = (condicao: Parameters<EdicaoDasCondicoesAtendimento['abrirEdicao']>[0]) =>
    this.edicao.abrirEdicao(condicao);
  readonly abrirRemoverCondicao = (
    condicao: Parameters<EdicaoDasCondicoesAtendimento['abrirRemoverCondicao']>[0],
  ) => this.edicao.abrirRemoverCondicao(condicao);
  readonly salvar = () => this.edicao.salvar();
  readonly removerConfirmado = () => this.edicao.removerConfirmado();

  tentarNovamente(): void {
    if (!this.saving() && !this.loading()) this.store.tentarNovamente();
  }
  limparFiltroBusca(): void {
    this.termoBusca.set('');
  }
  limparFiltros(): void {
    this.limparFiltroBusca();
  }
  protected proximaPagina(): void {
    this.store.proximaPagina();
  }
  protected paginaAnterior(): void {
    this.store.paginaAnterior();
  }
}

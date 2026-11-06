import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
} from '@uniplus/shared-ui/components';
import type { ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { devolverFocoDaLista } from '../../shared/foco';
import { ConcessaoTrilhaComponent } from './concessao-trilha.component';
import { ConcessoesListaComponent } from './concessoes-lista.component';
import { ConcessoesStore } from './concessoes.store';
import { nomesDeEscopo } from './nomes-de-escopo';
import { RevogacaoDeConcessoes } from './revogacao-de-concessoes';
import { RevogarConcessaoDialogComponent } from './revogar-concessao-dialog.component';

const ID_DO_TITULO = 'cfg-concessoes-titulo';

@Component({
  selector: 'cfg-concessoes-page',
  standalone: true,
  imports: [
    AlertaNovaTentativaComponent,
    ConcessoesListaComponent,
    ConcessaoTrilhaComponent,
    RevogarConcessaoDialogComponent,
  ],
  providers: [ConcessoesStore, RevogacaoDeConcessoes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './concessoes.page.html',
})
export class ConcessoesPage {
  protected readonly store = inject(ConcessoesStore);
  protected readonly revogacao = inject(RevogacaoDeConcessoes);
  protected readonly escopo = nomesDeEscopo();
  protected readonly trilhaAberta = signal(false);
  protected readonly escopoDaRevogacao = computed(() => {
    const concessao = this.revogacao.concessaoARevogar();
    return concessao === null ? '' : this.escopo.nome(concessao.escopo);
  });

  protected readonly pendente = computed(
    () => this.store.carregando() || this.revogacao.gravando(),
  );
  protected readonly novaTentativa = acompanharNovaTentativa({
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  private readonly foco = devolverFocoDaLista({
    gravando: computed(() => this.revogacao.gravando() || this.revogacao.revogando()),
    carregando: this.store.carregando,
    atributoDaLinha: 'data-concessao-id',
    idDoTitulo: ID_DO_TITULO,
  });

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.recarregar());
  }

  protected revogar(concessao: ConcessaoDto): void {
    this.foco.registrar({ acao: 'revogar', id: concessao.id });
    this.revogacao.pedirRevogacao(concessao);
  }

  protected abrirTrilha(concessao: ConcessaoDto): void {
    this.trilhaAberta.set(true);
    this.store.carregarTrilha(concessao.id);
  }
}

import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { acompanharLeitura, FalhaDeLeituraComponent } from '@uniplus/shared-ui/components';
import type { ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { devolverFocoDaLista } from '../../shared/foco';
import { ConcessaoTrilhaComponent, ID_DA_TRILHA } from './concessao-trilha.component';
import { ConcessoesListaComponent } from './concessoes-lista.component';
import { ConcessoesStore } from './concessoes.store';
import { nomesDeEscopo } from './nomes-de-escopo';
import { RecusaDaLeituraComponent } from '../../shared/recusa-da-leitura';
import { RevogacaoDeConcessoes } from './revogacao-de-concessoes';
import { RevogarConcessaoDialogComponent } from './revogar-concessao-dialog.component';

const ID_DO_TITULO = 'cfg-concessoes-titulo';

@Component({
  selector: 'cfg-concessoes-page',
  standalone: true,
  imports: [
    RouterLink,
    FalhaDeLeituraComponent,
    ConcessoesListaComponent,
    ConcessaoTrilhaComponent,
    RecusaDaLeituraComponent,
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
  private readonly permissoes = inject(PermissoesService);
  protected readonly podeRevogar = computed(() =>
    this.permissoes.tem(PERMISSAO.autorizacao.concessoesAdministrar),
  );
  protected readonly escopoDaRevogacao = computed(() => {
    const concessao = this.revogacao.concessaoARevogar();
    return concessao === null ? '' : this.escopo.nome(concessao.escopo);
  });

  protected readonly leitura = acompanharLeitura({
    assunto: 'concessões',
    falha: this.store.falha,
    pendente: this.store.carregando,
    indisponivel: this.revogacao.gravando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });
  protected readonly leituraDaTrilha = acompanharLeitura({
    assunto: 'trilha',
    falha: this.store.falhaDaTrilha,
    pendente: this.store.carregandoTrilha,
    recusada: computed(() => this.store.recusaDaTrilha() !== null),
    recarregar: () => this.store.tentarTrilhaNovamente(),
    destino: () => document.getElementById(ID_DA_TRILHA),
  });

  private readonly foco = devolverFocoDaLista({
    gravando: computed(() => this.revogacao.gravando() || this.revogacao.revogando()),
    carregando: this.store.carregando,
    atributoDaLinha: 'data-concessao-id',
    idDoTitulo: ID_DO_TITULO,
  });

  protected revogar(concessao: ConcessaoDto): void {
    this.foco.registrar({ acao: 'revogar', id: concessao.id });
    this.revogacao.pedirRevogacao(concessao);
  }

  protected abrirTrilha(concessao: ConcessaoDto): void {
    this.trilhaAberta.set(true);
    this.store.carregarTrilha(concessao.id);
  }
}

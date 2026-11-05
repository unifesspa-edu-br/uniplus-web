import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConcessaoTrilhaComponent } from './concessao-trilha.component';
import { ConcessoesListaComponent } from './concessoes-lista.component';
import { ConcessoesStore } from './concessoes.store';
import { nomesDeEscopo } from './nomes-de-escopo';
import { RevogacaoDeConcessoes } from './revogacao-de-concessoes';
import { RevogarConcessaoDialogComponent } from './revogar-concessao-dialog.component';

@Component({
  selector: 'cfg-concessoes-page',
  standalone: true,
  imports: [
    AlertComponent,
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

  protected abrirTrilha(concessao: ConcessaoDto): void {
    this.trilhaAberta.set(true);
    this.store.carregarTrilha(concessao.id);
  }
}

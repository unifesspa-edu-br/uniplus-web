import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LocalOfertaDto } from '@uniplus/shared-data/configuracao';
import {
  acompanharCatalogo,
  acompanharLeitura,
  destinoAcessivel,
  FalhaDeLeituraComponent,
} from '@uniplus/shared-ui/components';
import { LocaisOfertaListaComponent } from './locais-oferta-lista.component';
import { LocalOfertaFormularioComponent } from './local-oferta-formulario.component';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { ENDERECO_NO_GEO } from '../../shared/endereco';
import { EdicaoDosLocaisOferta } from './edicao-dos-locais-oferta';
import { LocaisOfertaStore } from './locais-oferta.store';

const ID_DO_TITULO = 'cfg-locais-list-title';

@Component({
  selector: 'cfg-locais-oferta-page',
  providers: [ENDERECO_NO_GEO, LocaisOfertaStore, EdicaoDosLocaisOferta],
  standalone: true,
  imports: [
    LocaisOfertaListaComponent,
    LocalOfertaFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
    FalhaDeLeituraComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './locais-oferta.page.html',
  host: { class: 'cfg-page' },
})
export class LocaisOfertaPage {
  protected readonly store = inject(LocaisOfertaStore);
  protected readonly edicao = inject(EdicaoDosLocaisOferta);

  protected readonly leitura = acompanharLeitura({
    assunto: 'locais de oferta',
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  /** Os campi rotulam a lista e alimentam o campo do formulário (um drawer): uma só leitura. */
  protected readonly leituraDosCampi = acompanharCatalogo({
    assunto: 'campi',
    falha: computed(() =>
      this.store.campi.comErro() ? 'Não foi possível carregar os campi.' : null,
    ),
    pendente: this.store.campi.pendente,
    indisponivel: computed(() => this.store.carregando() || this.edicao.gravando()),
    recarregar: () => this.store.campi.recarregar(),
    destino: () =>
      destinoAcessivel(
        document.querySelector<HTMLElement>('select[formcontrolname="campusResponsavelId"]'),
        document.getElementById(ID_DO_TITULO),
      ),
  });
  protected readonly leiturasDaLista = [this.leituraDosCampi];

  protected abrirCadastro(): void {
    if (this.edicao.gravando()) return;
    this.store.iniciarCampi();
    this.edicao.abrirCadastro();
  }

  protected abrirEdicao(local: LocalOfertaDto): void {
    if (this.edicao.gravando()) return;
    this.store.iniciarCampi();
    this.edicao.abrirEdicao(local);
  }
}

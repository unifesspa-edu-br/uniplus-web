import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { LocalOfertaDto } from '@uniplus/shared-data/configuracao';
import { AlertComponent, ConfirmDialogComponent } from '@uniplus/shared-ui/components';
import { LocaisOfertaListaComponent } from './locais-oferta-lista.component';
import { LocalOfertaFormularioComponent } from './local-oferta-formulario.component';
import { ENDERECO_NO_GEO } from '../../shared/endereco';
import { EdicaoDosLocaisOferta } from './edicao-dos-locais-oferta';
import { LocaisOfertaStore } from './locais-oferta.store';

@Component({
  selector: 'cfg-locais-oferta-page',
  providers: [ENDERECO_NO_GEO, LocaisOfertaStore, EdicaoDosLocaisOferta],
  standalone: true,
  imports: [
    AlertComponent,
    ConfirmDialogComponent,
    LocaisOfertaListaComponent,
    LocalOfertaFormularioComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './locais-oferta.page.html',
  host: { class: 'cfg-page' },
})
export class LocaisOfertaPage {
  protected readonly leitura = inject(LocaisOfertaStore);
  protected readonly edicao = inject(EdicaoDosLocaisOferta);

  private readonly formulario = viewChild(LocalOfertaFormularioComponent);

  constructor() {
    this.edicao.focarEndereco = () => this.formulario()?.focarEndereco();
  }

  protected abrirCadastro(): void {
    if (this.edicao.gravando()) return;
    this.leitura.iniciarCampi();
    this.edicao.abrirCadastro();
  }

  protected abrirEdicao(local: LocalOfertaDto): void {
    if (this.edicao.gravando()) return;
    this.leitura.iniciarCampi();
    this.edicao.abrirEdicao(local);
  }
}

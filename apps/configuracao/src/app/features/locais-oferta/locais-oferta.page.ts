import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { LocalOfertaDto } from '@uniplus/shared-data/configuracao';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { LocaisOfertaListaComponent } from './locais-oferta-lista.component';
import { LocalOfertaFormularioComponent } from './local-oferta-formulario.component';
import { LocalOfertaRemocaoComponent } from './local-oferta-remocao.component';
import { ENDERECO_NO_GEO } from '../../shared/endereco';
import { focarAposNovaTentativa } from '../../shared/foco';
import { EdicaoDosLocaisOferta } from './edicao-dos-locais-oferta';
import { LocaisOfertaStore } from './locais-oferta.store';

@Component({
  selector: 'cfg-locais-oferta-page',
  providers: [ENDERECO_NO_GEO, LocaisOfertaStore, EdicaoDosLocaisOferta],
  standalone: true,
  imports: [
    AlertComponent,
    LocaisOfertaListaComponent,
    LocalOfertaFormularioComponent,
    LocalOfertaRemocaoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './locais-oferta.page.html',
  host: { class: 'cfg-page' },
})
export class LocaisOfertaPage {
  protected readonly leitura = inject(LocaisOfertaStore);
  protected readonly edicao = inject(EdicaoDosLocaisOferta);

  /** A lista carrega ou uma escrita corre: o "Tentar novamente" fica indisponível, sem perder o foco. */
  protected readonly indisponivel = computed(
    () => this.leitura.carregando() || this.edicao.gravando(),
  );
  private readonly novaTentativa = focarAposNovaTentativa(
    this.indisponivel,
    computed(() => this.leitura.mensagemDeErro() !== null),
    () => document.getElementById('cfg-locais-list-title'),
  );
  private readonly formulario = viewChild(LocalOfertaFormularioComponent);

  constructor() {
    this.edicao.focarEndereco = () => this.formulario()?.focarEndereco();
  }

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.leitura.tentarNovamente());
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

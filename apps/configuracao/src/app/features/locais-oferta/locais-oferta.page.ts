import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LocalOfertaDto } from '@uniplus/shared-data/configuracao';
import type { UiLookupFalho } from '@uniplus/shared-ui/components';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { LocaisOfertaListaComponent } from './locais-oferta-lista.component';
import { LocalOfertaFormularioComponent } from './local-oferta-formulario.component';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { ENDERECO_NO_GEO } from '../../shared/endereco';
import {
  avisoDeFalhaDoLookup,
  focarAposNovaTentativa,
  novaTentativaAnunciada,
} from '../../shared/foco';
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
    ConfirmacaoDeRemocaoComponent,
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

  protected readonly avisoDosCampi = avisoDeFalhaDoLookup(this.leitura.campi);
  /** O aviso mantido na tela durante a tentativa não muda de texto; esta região anuncia cada tentativa. */
  protected readonly anuncioDosCampi = signal('');
  /** O formulário é um drawer modal: o anúncio da tentativa acionada dentro dele tem região própria, dentro dele. */
  protected readonly anuncioDosCampiNoFormulario = signal('');
  private readonly novaTentativaDosCampi = novaTentativaAnunciada({
    nome: 'campi',
    pendente: this.leitura.campi.pendente,
    falhou: this.avisoDosCampi,
    destino: () =>
      document.querySelector<HTMLElement>('select[formcontrolname="campusResponsavelId"]'),
    anuncio: this.anuncioDosCampiNoFormulario,
  });

  private readonly novaTentativaDosCampiNaLista = novaTentativaAnunciada({
    nome: 'campi',
    pendente: this.leitura.campi.pendente,
    falhou: this.avisoDosCampi,
    destino: () => document.getElementById('cfg-locais-list-title'),
    anuncio: this.anuncioDosCampi,
  });

  /** O aviso dos rótulos fica na lista durante a tentativa; a lista ocupada também o deixa indisponível. */
  protected readonly falhasDosCampi = computed<readonly UiLookupFalho[]>(() =>
    this.avisoDosCampi()
      ? [
          {
            nome: 'campi',
            pendente: this.leitura.campi.pendente() || this.indisponivel(),
            recarregar: () =>
              this.novaTentativaDosCampiNaLista.executar(() => this.leitura.campi.recarregar()),
          },
        ]
      : [],
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.leitura.tentarNovamente());
  }

  protected tentarNovamenteOsCampi(): void {
    this.novaTentativaDosCampi.executar(() => this.leitura.campi.recarregar());
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

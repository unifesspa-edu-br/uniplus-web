import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LocalOfertaDto } from '@uniplus/shared-data/configuracao';
import type { UiLookupFalho } from '@uniplus/shared-ui/components';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  destinoAcessivel,
} from '@uniplus/shared-ui/components';
import { LocaisOfertaListaComponent } from './locais-oferta-lista.component';
import { LocalOfertaFormularioComponent } from './local-oferta-formulario.component';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { ENDERECO_NO_GEO } from '../../shared/endereco';
import { avisoDeFalhaDoLookup } from '../../shared/foco';
import { EdicaoDosLocaisOferta } from './edicao-dos-locais-oferta';
import { LocaisOfertaStore } from './locais-oferta.store';

@Component({
  selector: 'cfg-locais-oferta-page',
  providers: [ENDERECO_NO_GEO, LocaisOfertaStore, EdicaoDosLocaisOferta],
  standalone: true,
  imports: [
    LocaisOfertaListaComponent,
    LocalOfertaFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
    AlertaNovaTentativaComponent,
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
  protected readonly novaTentativa = acompanharNovaTentativa({
    assunto: 'locais de oferta',
    pendente: this.indisponivel,
    falhou: computed(() => this.leitura.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-locais-list-title'),
  });

  protected readonly avisoDosCampi = avisoDeFalhaDoLookup(this.leitura.campi);
  /** O aviso dos campi está na lista e no formulário (um drawer): uma só tentativa, uma só fase. */
  protected readonly novaTentativaDosCampi = acompanharNovaTentativa({
    assunto: 'campi',
    pendente: this.leitura.campi.pendente,
    falhou: this.avisoDosCampi,
    destino: () =>
      destinoAcessivel(
        document.querySelector<HTMLElement>('select[formcontrolname="campusResponsavelId"]'),
        document.getElementById('cfg-locais-list-title'),
      ),
  });

  /** O aviso dos rótulos fica na lista durante a tentativa; a lista ocupada também o deixa indisponível. */
  protected readonly falhasDosCampi = computed<readonly UiLookupFalho[]>(() =>
    this.avisoDosCampi()
      ? [
          {
            nome: 'campi',
            pendente: this.leitura.campi.pendente(),
            indisponivel: this.indisponivel(),
            fase: this.novaTentativaDosCampi.fase(),
            recarregar: () => this.tentarNovamenteOsCampi(),
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

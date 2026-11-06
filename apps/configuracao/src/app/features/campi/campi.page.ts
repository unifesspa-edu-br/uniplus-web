import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
} from '@uniplus/shared-ui/components';
import { ENDERECO_NO_GEO } from '../../shared/endereco';
import { CampiListaComponent } from './campi-lista.component';
import { CampiStore } from './campi.store';
import { CampusFormularioComponent } from './campus-formulario.component';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { EdicaoDosCampi } from './edicao-dos-campi';

/** Cadastro de campi: compõe a lista, o formulário e a confirmação de remoção. */
@Component({
  selector: 'cfg-campi-page',
  providers: [ENDERECO_NO_GEO, CampiStore, EdicaoDosCampi],
  standalone: true,
  imports: [
    AlertaNovaTentativaComponent,
    CampiListaComponent,
    CampusFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campi.page.html',
  host: { class: 'cfg-page' },
})
export class CampiPage {
  protected readonly store = inject(CampiStore);
  protected readonly edicao = inject(EdicaoDosCampi);

  /** A lista carrega ou uma remoção corre: o "Tentar novamente" fica indisponível, sem perder o foco. */
  protected readonly indisponivel = computed(
    () => this.store.carregando() || this.edicao.removendo(),
  );
  protected readonly novaTentativa = acompanharNovaTentativa({
    pendente: this.indisponivel,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-campi-list-title'),
  });

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}

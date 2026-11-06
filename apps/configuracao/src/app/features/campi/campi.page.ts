import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { acompanharLeitura, FalhaDeLeituraComponent } from '@uniplus/shared-ui/components';
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
    FalhaDeLeituraComponent,
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

  protected readonly leitura = acompanharLeitura({
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.removendo,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-campi-list-title'),
  });
}

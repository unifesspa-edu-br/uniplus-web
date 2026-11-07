import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  acompanharCatalogo,
  acompanharLeitura,
  AlertComponent,
  destinoAcessivel,
  FalhaDeLeituraComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { FaseCanonicaFormularioComponent } from './fase-canonica-formulario.component';
import { FasesCanonicasListaComponent } from './fases-canonicas-lista.component';
import { FasesCanonicasStore } from './fases-canonicas.store';
import { EdicaoDasFasesCanonicas } from './edicao-das-fases-canonicas';

const ID_DO_TITULO = 'cfg-fases-canonicas-list-title';

@Component({
  selector: 'cfg-fases-canonicas-page',
  standalone: true,
  imports: [
    AlertComponent,
    FalhaDeLeituraComponent,
    FasesCanonicasListaComponent,
    FaseCanonicaFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  providers: [FasesCanonicasStore, EdicaoDasFasesCanonicas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fases-canonicas.page.html',
  host: { class: 'cfg-page' },
})
export class FasesCanonicasPage {
  protected readonly store = inject(FasesCanonicasStore);
  protected readonly edicao = inject(EdicaoDasFasesCanonicas);
  protected readonly leitura = acompanharLeitura({
    assunto: 'fases canônicas',
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  protected readonly leituraDasUnidades = acompanharCatalogo({
    assunto: 'unidades',
    falha: computed(() =>
      this.store.unidades.comErro() ? 'Não foi possível carregar as unidades.' : null,
    ),
    pendente: this.store.unidades.pendente,
    recarregar: () => this.store.unidades.recarregar(),
    destino: () =>
      destinoAcessivel(
        document.querySelector<HTMLElement>('select[formcontrolname="unidadeSugeridaId"]'),
        document.getElementById(ID_DO_TITULO),
      ),
  });
}

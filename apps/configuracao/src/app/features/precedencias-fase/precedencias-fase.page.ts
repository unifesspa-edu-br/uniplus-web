import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import {
  acompanharCatalogo,
  acompanharLeitura,
  AlertComponent,
  destinoAcessivel,
  FalhaDeLeituraComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focoEstaLivre } from '../../shared/foco';
import { EdicaoDasPrecedencias } from './edicao-das-precedencias';
import { FasesDoGrafoStore } from './fases-do-grafo.store';
import { PrecedenciaFormularioComponent } from './precedencia-formulario.component';
import { PrecedenciasFaseListaComponent } from './precedencias-fase-lista.component';
import { PrecedenciasFaseStore } from './precedencias-fase.store';

const ID_DO_TITULO = 'cfg-precedencias-fase-list-title';
const MENSAGEM_DAS_FASES =
  'Não foi possível consultar o cadastro de Fase Canônica. A lista, as opções do formulário e a busca mostram só os códigos das fases, e a busca por nome não encontra as arestas existentes.';

@Component({
  selector: 'cfg-precedencias-fase-page',
  standalone: true,
  imports: [
    AlertComponent,
    PrecedenciasFaseListaComponent,
    PrecedenciaFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
    FalhaDeLeituraComponent,
  ],
  providers: [FasesDoGrafoStore, PrecedenciasFaseStore, EdicaoDasPrecedencias],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './precedencias-fase.page.html',
  host: { class: 'cfg-page' },
})
export class PrecedenciasFasePage {
  protected readonly fases = inject(FasesDoGrafoStore);
  protected readonly store = inject(PrecedenciasFaseStore);
  protected readonly edicao = inject(EdicaoDasPrecedencias);
  protected readonly leitura = acompanharLeitura({
    assunto: 'precedências',
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  /**
   * Uma só leitura, com um aviso por superfície ativa: o da página e, com o drawer modal aberto
   * (a página fica inerte atrás dele), o do campo do formulário.
   */
  protected readonly leituraDasFases = acompanharCatalogo({
    assunto: 'fases',
    falha: computed(() => (this.fases.falhou() ? MENSAGEM_DAS_FASES : null)),
    pendente: this.fases.pendente,
    recarregar: () => this.fases.recarregar(),
    destino: () =>
      destinoAcessivel(
        document.querySelector<HTMLElement>('#cfg-precedencia-fase-form select'),
        document.getElementById(ID_DO_TITULO),
      ),
  });
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => {
      if (!this.edicao.devolverFocoAoTitulo()) return;
      untracked(() => {
        this.edicao.focoDevolvidoAoTitulo();
        afterNextRender(
          () => {
            if (focoEstaLivre()) document.getElementById(ID_DO_TITULO)?.focus();
          },
          { injector: this.injector },
        );
      });
    });
  }
}

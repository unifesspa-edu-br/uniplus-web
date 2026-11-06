import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { EdicaoDasOfertasCurso } from './edicao-das-ofertas-curso';
import { OfertaCursoFormularioComponent } from './oferta-curso-formulario.component';
import { OfertasCursoListaComponent } from './ofertas-curso-lista.component';
import { OfertasCursoStore } from './ofertas-curso.store';
import { ID_DO_TITULO_DA_LISTA, VinculosDaOferta } from './vinculos-da-oferta';

/** Cadastro de ofertas de curso: compõe a lista, o formulário e a confirmação de remoção. */
@Component({
  selector: 'cfg-ofertas-curso-page',
  standalone: true,
  providers: [VinculosDaOferta, OfertasCursoStore, EdicaoDasOfertasCurso],
  imports: [
    AlertaNovaTentativaComponent,
    ConfirmacaoDeRemocaoComponent,
    OfertaCursoFormularioComponent,
    OfertasCursoListaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ofertas-curso.page.html',
  host: { class: 'cfg-page' },
})
export class OfertasCursoPage {
  protected readonly store = inject(OfertasCursoStore);
  protected readonly edicao = inject(EdicaoDasOfertasCurso);
  protected readonly vinculos = inject(VinculosDaOferta);
  /** A lista carrega ou uma escrita corre: o "Tentar novamente" fica indisponível, sem perder o foco. */
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  protected readonly novaTentativa = acompanharNovaTentativa({
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById(ID_DO_TITULO_DA_LISTA),
  });

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}

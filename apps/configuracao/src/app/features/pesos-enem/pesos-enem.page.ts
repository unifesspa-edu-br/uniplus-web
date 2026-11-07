import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import {
  acompanharCatalogo,
  AlertComponent,
  EmptyStateComponent,
  FalhaDeLeituraComponent,
  SkeletonComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { devolverFocoDaLista, focoEstaLivre } from '../../shared/foco';
import { CriacaoDeResolucao } from './criacao-de-resolucao';
import { EdicaoDosParametros } from './edicao-dos-parametros';
import { GravacaoDosPesosEnem } from './gravacao-dos-pesos-enem';
import { RemocaoDeResolucao } from './remocao-de-resolucao';
import { PesosEnemCabecalhoComponent } from './pesos-enem-cabecalho.component';
import { PesosEnemEdicaoComponent } from './pesos-enem-edicao.component';
import { PesosEnemFormularioComponent } from './pesos-enem-formulario.component';
import { PesosEnemLeituraComponent } from './pesos-enem-leitura.component';
import { slug } from './pesos-enem-agrupamento';
import { idDoBotaoDeRemocao } from './pesos-enem-rotulos';
import { PesosEnemStore } from './pesos-enem.store';

const ID_DO_TITULO = 'cfg-pesos-enem-titulo';

@Component({
  selector: 'cfg-pesos-enem-page',
  standalone: true,
  imports: [
    AlertComponent,
    ConfirmacaoDeRemocaoComponent,
    EmptyStateComponent,
    FalhaDeLeituraComponent,
    PesosEnemCabecalhoComponent,
    PesosEnemEdicaoComponent,
    PesosEnemFormularioComponent,
    PesosEnemLeituraComponent,
    SkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pesos-enem.page.html',
  providers: [
    PesosEnemStore,
    GravacaoDosPesosEnem,
    EdicaoDosParametros,
    CriacaoDeResolucao,
    RemocaoDeResolucao,
  ],
  host: { class: 'cfg-page' },
})
export class PesosEnemPage {
  protected readonly store = inject(PesosEnemStore);
  protected readonly gravacao = inject(GravacaoDosPesosEnem);
  protected readonly edicao = inject(EdicaoDosParametros);
  protected readonly criacao = inject(CriacaoDeResolucao);
  protected readonly remocao = inject(RemocaoDeResolucao);
  protected readonly slug = slug;
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  protected readonly cadastroIndisponivel = computed(
    () => this.gravacao.gravando() || !this.store.podeCadastrar(),
  );

  /**
   * Remoção parcial: terminada a recarga, o foco volta ao botão da resolução, que segue na lista;
   * se ela sumiu, vai ao título. Declarado antes da devolução geral para agir primeiro.
   */
  private readonly focoDaRemocaoParcial = effect(() => {
    const resolucao = this.remocao.resolucaoParcial();
    if (resolucao === null || this.gravacao.gravando() || this.store.carregando()) {
      return;
    }
    untracked(() => {
      this.remocao.consumirParcial();
      afterNextRender(
        () => {
          if (focoEstaLivre()) {
            const botao = this.raiz.querySelector<HTMLElement>(`#${idDoBotaoDeRemocao(resolucao)}`);
            (botao ?? this.titulo())?.focus();
          }
        },
        { injector: this.injector },
      );
    });
  });

  /** Terminada a remoção e a recarga, o foco vai ao título da lista: o painel removido já não está na tela. */
  private readonly devolucaoDeFoco = devolverFocoDaLista({
    gravando: this.gravacao.gravando,
    carregando: this.store.carregando,
    atributoDaLinha: 'data-resolucao',
    idDoTitulo: ID_DO_TITULO,
  });

  /** Uma leitura por lista, cada uma com o próprio aviso e "Tentar novamente". Quando a lista
   *  chega, o foco passa ao título da página. */
  protected readonly leituraDasAreas = acompanharCatalogo({
    assunto: 'áreas',
    falha: computed(() =>
      this.store.listaAreas.falhou() ? this.store.mensagemFalhaAreas() : null,
    ),
    pendente: this.store.listaAreas.pendente,
    recarregar: () => this.store.tentarCarregarAreas(),
    destino: () => this.titulo(),
  });
  protected readonly leituraDosGrupos = acompanharCatalogo({
    assunto: 'grupos',
    falha: computed(() =>
      this.store.catalogoGrupos.falhou() ? this.store.mensagemFalhaGrupos() : null,
    ),
    pendente: this.store.catalogoGrupos.pendente,
    recarregar: () => this.store.tentarCarregarGrupos(),
    destino: () => this.titulo(),
  });
  protected readonly leituraDaListagem = acompanharCatalogo({
    assunto: 'pesos',
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.gravacao.gravando,
    recarregar: () => this.store.recarregar(),
    destino: () => this.titulo(),
  });

  protected abrirCadastro(): void {
    if (this.cadastroIndisponivel()) {
      return;
    }
    this.devolucaoDeFoco.registrar(null);
    this.criacao.abrir();
  }

  protected pedirRemocao(resolucao: string): void {
    this.devolucaoDeFoco.registrar(null);
    this.remocao.pedir(resolucao);
  }

  /** Sem grupos a remover (a resolução já saiu da lista), a confirmação se encerra como o Cancelar. */
  protected confirmarRemocao(): void {
    this.remocao.confirmar();
    if (!this.remocao.confirmando()) {
      this.aoMudarConfirmacao(false);
    }
  }

  /**
   * O diálogo fechou sem remover: o foco volta ao botão da resolução, ou ao título se o painel
   * não existe mais (a recusa pode ter vindo de uma resolução que já saiu da lista).
   */
  protected aoMudarConfirmacao(aberta: boolean): void {
    if (aberta) {
      return;
    }
    const resolucao = this.remocao.resolucaoAlvo();
    this.remocao.descartar();
    afterNextRender(
      () => {
        if (resolucao !== null && focoEstaLivre()) {
          const botao = this.raiz.querySelector<HTMLElement>(`#${idDoBotaoDeRemocao(resolucao)}`);
          (botao ?? this.titulo())?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  private titulo(): HTMLElement | null {
    return document.getElementById(ID_DO_TITULO);
  }
}

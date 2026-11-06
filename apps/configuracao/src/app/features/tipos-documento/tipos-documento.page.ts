import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { TipoDocumentoDto } from '@uniplus/shared-data/configuracao';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  type UiLookupFalho,
  destinoAcessivel,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import {
  devolverFocoDaLista,
  avisoDeFalhaDoLookup,
  focoEstaLivre,
  type AcionadorDaLista,
} from '../../shared/foco';
import { motivoDaFalha } from '../../shared/lista-de-referencia';
import {
  AprovacaoDoCatalogo,
  SolicitacaoDaProtecaoDialogComponent,
} from '../../shared/protecao-do-catalogo';
import { EdicaoDosTiposDocumento } from './edicao-dos-tipos-documento';
import { TipoDocumentoDetalheComponent } from './tipo-documento-detalhe.component';
import { TipoDocumentoFormularioComponent } from './tipo-documento-formulario.component';
import { TiposDocumentoFiltrosComponent } from './tipos-documento-filtros.component';
import { TiposDocumentoListaComponent } from './tipos-documento-lista.component';
import { TiposDocumentoStore } from './tipos-documento.store';

const ID_DO_TITULO = 'cfg-tipos-documento-list-title';

/** Cadastro de tipos de documento: compõe a lista, o detalhe, o formulário e as confirmações. */
@Component({
  selector: 'cfg-tipos-documento-page',
  standalone: true,
  imports: [
    ConfirmacaoDeRemocaoComponent,
    SolicitacaoDaProtecaoDialogComponent,
    TipoDocumentoDetalheComponent,
    TipoDocumentoFormularioComponent,
    TiposDocumentoFiltrosComponent,
    TiposDocumentoListaComponent,
    AlertaNovaTentativaComponent,
  ],
  providers: [AprovacaoDoCatalogo, TiposDocumentoStore, EdicaoDosTiposDocumento],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-documento.page.html',
  host: { class: 'cfg-page' },
})
export class TiposDocumentoPage {
  protected readonly store = inject(TiposDocumentoStore);
  protected readonly edicao = inject(EdicaoDosTiposDocumento);
  protected readonly aprovacao = inject(AprovacaoDoCatalogo);
  private readonly injector = inject(Injector);
  protected readonly solicitacaoAberta = signal(false);
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  protected readonly novaTentativa = acompanharNovaTentativa({
    assunto: 'tipos de documento',
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById(ID_DO_TITULO),
  });
  private readonly devolucao = devolverFocoDaLista({
    gravando: this.edicao.gravando,
    carregando: this.store.carregando,
    atributoDaLinha: 'data-tipo-documento-id',
    idDoTitulo: ID_DO_TITULO,
    idDoCadastro: 'cfg-tipos-documento-novo',
  });

  /** O aviso das categorias está na lista e no formulário (um drawer): uma só tentativa, uma só fase. */
  protected readonly novaTentativaDasCategorias = acompanharNovaTentativa({
    assunto: 'categorias',
    pendente: this.store.categorias.pendente,
    falhou: this.edicao.avisoDasCategorias,
    destino: () =>
      destinoAcessivel(
        document.querySelector<HTMLElement>('select[formcontrolname="categoria"]'),
        document.getElementById(ID_DO_TITULO),
      ),
  });
  private readonly avisoDaSituacao = avisoDeFalhaDoLookup(this.aprovacao);
  protected readonly novaTentativaDaSituacao = acompanharNovaTentativa({
    assunto: 'situação de aprovação',
    pendente: this.aprovacao.pendente,
    falhou: this.avisoDaSituacao,
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  /**
   * Os catálogos que rotulam a lista e falharam. Ficam na lista durante a nova tentativa, para o
   * botão que a pediu manter o foco; dando certo, o foco vai ao título.
   */
  protected readonly lookupsComFalha = computed<readonly UiLookupFalho[]>(() => [
    ...(this.edicao.avisoDasCategorias()
      ? [
          {
            nome: 'categorias',
            pendente: this.store.categorias.pendente(),
            fase: this.novaTentativaDasCategorias.fase(),
            recarregar: () => this.recarregarCategorias(),
          },
        ]
      : []),
    ...(this.avisoDaSituacao()
      ? [
          {
            nome: 'situação da proteção de dados',
            pendente: this.aprovacao.pendente(),
            fase: this.novaTentativaDaSituacao.fase(),
            recarregar: () => this.recarregarSituacao(),
          },
        ]
      : []),
  ]);

  constructor() {
    // A falha de servidor dos dois catálogos que rotulam a lista avisa por toast, uma vez por falha.
    motivoDaFalha(this.store.categorias);
    motivoDaFalha(this.aprovacao);
    this.focarTituloAoFecharAceite();
  }

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }

  /** Pedido na lista ou no formulário: o aviso fica até a leitura terminar, e dando certo o foco vai ao campo Categoria. */
  protected recarregarCategorias(): void {
    if (this.edicao.salvando()) return;
    this.novaTentativaDasCategorias.executar(() => this.store.categorias.recarregar());
  }

  protected cadastrar(): void {
    this.registrar(null);
    this.edicao.abrirCadastro();
  }

  protected editar(tipo: TipoDocumentoDto): void {
    this.registrar({ acao: 'editar', id: tipo.id });
    this.edicao.abrirEdicao(tipo);
  }

  protected remover(tipo: TipoDocumentoDto): void {
    this.registrar({ acao: 'remover', id: tipo.id });
    this.edicao.pedirRemocao(tipo);
  }

  protected editarDoDetalhe(tipo: TipoDocumentoDto): void {
    this.store.detalheAberto.set(false);
    this.editar(tipo);
  }

  protected aceitarDoDetalhe(tipo: TipoDocumentoDto): void {
    this.store.detalheAberto.set(false);
    this.registrar({ acao: 'editar', id: tipo.id });
    this.edicao.pedirAceite(tipo);
  }

  protected aposEnviarSolicitacao(): void {
    this.aprovacao.carregar();
    this.focarNoProximoRender(`#${ID_DO_TITULO}`);
  }

  private registrar(acionador: AcionadorDaLista): void {
    this.devolucao.registrar(acionador);
  }

  private recarregarSituacao(): void {
    this.novaTentativaDaSituacao.executar(() => this.aprovacao.carregar());
  }

  /**
   * Depois de fechar uma sobreposição (solicitação enviada, aceite fechado), o foco livre vai ao
   * elemento: o botão que a abriu pode ter saído da lista com a releitura, e o foco cairia no corpo.
   */
  private focarNoProximoRender(seletor: string): void {
    afterNextRender(
      () => {
        if (focoEstaLivre()) document.querySelector<HTMLElement>(seletor)?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * A confirmação do aceite abre do detalhe, que se fecha antes: ao fechar sem desfecho a linha
   * pode ter saído da lista, então o foco livre vai ao título.
   */
  private focarTituloAoFecharAceite(): void {
    let estavaAberta = false;
    effect(() => {
      const aberta = this.edicao.confirmandoAceite();
      if (estavaAberta && !aberta) {
        untracked(() => this.focarNoProximoRender(`#${ID_DO_TITULO}`));
      }
      estavaAberta = aberta;
    });
  }
}

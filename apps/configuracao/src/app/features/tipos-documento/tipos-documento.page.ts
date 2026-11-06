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
import { AlertComponent, type UiLookupFalho } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import {
  devolverFocoDaLista,
  focarAposNovaTentativa,
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
    AlertComponent,
    ConfirmacaoDeRemocaoComponent,
    SolicitacaoDaProtecaoDialogComponent,
    TipoDocumentoDetalheComponent,
    TipoDocumentoFormularioComponent,
    TiposDocumentoFiltrosComponent,
    TiposDocumentoListaComponent,
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
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById(ID_DO_TITULO),
  );
  private readonly devolucao = devolverFocoDaLista({
    gravando: this.edicao.gravando,
    carregando: this.store.carregando,
    atributoDaLinha: 'data-tipo-documento-id',
    idDoTitulo: ID_DO_TITULO,
    idDoCadastro: 'cfg-tipos-documento-novo',
  });

  /** Os catálogos que rotulam a lista e falharam. O alerta some ao pedir de novo, e o foco vai ao título. */
  protected readonly lookupsComFalha = computed<readonly UiLookupFalho[]>(() => [
    ...(this.store.categorias.comErro()
      ? [{ nome: 'categorias', recarregar: () => this.recarregarCategorias() }]
      : []),
    ...(this.aprovacao.comErro()
      ? [{ nome: 'situação da proteção de dados', recarregar: () => this.recarregarSituacao() }]
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

  /** Pedido no formulário, em que o alerta some junto com o botão: o foco vai ao campo Categoria. */
  protected recarregarCategoriasDoFormulario(): void {
    this.recarregarCategorias('select[formcontrolname="categoria"]');
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

  private recarregarCategorias(destino = `#${ID_DO_TITULO}`): void {
    this.store.categorias.recarregar();
    this.focarNoProximoRender(destino);
  }

  private recarregarSituacao(): void {
    this.aprovacao.carregar();
    this.focarNoProximoRender(`#${ID_DO_TITULO}`);
  }

  /** O alerta que tinha o foco sai da tela ao pedir de novo: sem destino, o foco cairia no corpo. */
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

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
  acompanharCatalogo,
  acompanharLeitura,
  destinoAcessivel,
  FalhaDeLeituraComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { devolverFocoDaLista, focoEstaLivre, type AcionadorDaLista } from '../../shared/foco';
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
    FalhaDeLeituraComponent,
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
  protected readonly leitura = acompanharLeitura({
    assunto: 'tipos de documento',
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });
  private readonly devolucao = devolverFocoDaLista({
    gravando: this.edicao.gravando,
    carregando: this.store.carregando,
    atributoDaLinha: 'data-tipo-documento-id',
    idDoTitulo: ID_DO_TITULO,
    idDoCadastro: 'cfg-tipos-documento-novo',
  });

  /** A leitura das categorias alimenta o aviso da lista e o do campo do formulário (um drawer). */
  protected readonly leituraDasCategorias = acompanharCatalogo({
    assunto: 'categorias',
    falha: computed(() =>
      this.store.categorias.comErro() ? 'Não foi possível carregar as categorias.' : null,
    ),
    pendente: this.store.categorias.pendente,
    indisponivel: this.edicao.salvando,
    recarregar: () => this.store.categorias.recarregar(),
    destino: () =>
      destinoAcessivel(
        document.querySelector<HTMLElement>('select[formcontrolname="categoria"]'),
        document.getElementById(ID_DO_TITULO),
      ),
  });
  /** A situação decide só a coluna de proteção de dados, que passa a dizer que não pôde ser lida. */
  protected readonly leituraDaSituacao = acompanharLeitura({
    assunto: 'situação da proteção de dados',
    falha: computed(() =>
      this.aprovacao.comErro()
        ? 'A coluna de proteção de dados mostra “Não foi possível ler a situação” até a leitura ser refeita.'
        : null,
    ),
    pendente: this.aprovacao.pendente,
    recarregar: () => this.aprovacao.carregar(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  /** O catálogo que rotula a coluna de categoria; o aviso da lista o nomeia quando falha. */
  protected readonly leiturasDaLista = [this.leituraDasCategorias];

  constructor() {
    // A falha de servidor dos dois catálogos que rotulam a lista avisa por toast, uma vez por falha.
    motivoDaFalha(this.store.categorias);
    motivoDaFalha(this.aprovacao);
    this.focarTituloAoFecharAceite();
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

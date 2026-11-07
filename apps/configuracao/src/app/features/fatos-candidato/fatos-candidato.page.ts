import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { acompanharLeitura, FalhaDeLeituraComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import {
  AprovacaoDoCatalogo,
  SolicitacaoDaProtecaoDialogComponent,
} from '../../shared/protecao-do-catalogo';
import { EdicaoDoFato } from './edicao-do-fato';
import { EdicaoDosFatos } from './edicao-dos-fatos';
import { FatoDetalheComponent } from './fato-detalhe.component';
import { FatoDetalheStore } from './fato-detalhe.store';
import { FatoDrawerComponent } from './fato-drawer.component';
import { FatoEmEdicaoStore } from './fato-em-edicao.store';
import { FatosCandidatoListaComponent } from './fatos-candidato-lista.component';
import { FatosCandidatoStore } from './fatos-candidato.store';
import { ID_DO_TITULO_DA_LISTA } from './ids-do-fato';

/**
 * O catálogo de fatos do candidato (ADR-0136): a lista com filtro por origem e situação, o detalhe,
 * a criação de fato declarado, derivado e agregado e a edição, que abre logo depois de criar.
 */
@Component({
  selector: 'cfg-fatos-candidato-page',
  imports: [
    ConfirmacaoDeRemocaoComponent,
    FalhaDeLeituraComponent,
    FatoDetalheComponent,
    FatoDrawerComponent,
    FatosCandidatoListaComponent,
    SolicitacaoDaProtecaoDialogComponent,
  ],
  providers: [
    AprovacaoDoCatalogo,
    FatosCandidatoStore,
    FatoDetalheStore,
    FatoEmEdicaoStore,
    EdicaoDoFato,
    EdicaoDosFatos,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fatos-candidato.page.html',
  host: { class: 'cfg-page' },
})
export class FatosCandidatoPage {
  private readonly injector = inject(Injector);
  protected readonly store = inject(FatosCandidatoStore);
  protected readonly detalhe = inject(FatoDetalheStore);
  protected readonly edicao = inject(EdicaoDosFatos);
  protected readonly aprovacao = inject(AprovacaoDoCatalogo);
  protected readonly solicitacaoAberta = signal(false);
  private readonly lista = viewChild(FatosCandidatoListaComponent);

  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  protected readonly leitura = acompanharLeitura({
    assunto: 'fatos',
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO_DA_LISTA),
  });
  /** A situação de aprovação só decide o botão "Enviar solicitação"; a falha avisa que ele não pode aparecer. */
  protected readonly leituraDaAprovacao = acompanharLeitura({
    assunto: 'itens que aguardam a proteção de dados',
    falha: computed(() =>
      this.aprovacao.comErro()
        ? 'O botão “Enviar solicitação” fica fora da tela até esta leitura ser refeita.'
        : null,
    ),
    pendente: this.aprovacao.pendente,
    recarregar: () => this.aprovacao.carregar(),
    destino: () => document.getElementById(ID_DO_TITULO_DA_LISTA),
  });

  protected editarDoDetalhe(fato: FatoCandidatoDto): void {
    this.detalhe.fechar();
    this.edicao.abrirEdicao(fato.id);
  }

  protected aceitarDoDetalhe(fato: FatoCandidatoDto): void {
    this.lista()?.registrarAceiteDoDetalhe(fato);
    this.detalhe.fechar();
    this.edicao.pedirAceite(fato);
  }

  /** O foco vai ao título só depois do fechamento do diálogo, que devolveria o foco ao botão que some com a releitura. */
  protected aposEnviarSolicitacao(): void {
    this.edicao.recarregar();
    afterNextRender(() => document.getElementById(ID_DO_TITULO_DA_LISTA)?.focus(), {
      injector: this.injector,
    });
  }
}

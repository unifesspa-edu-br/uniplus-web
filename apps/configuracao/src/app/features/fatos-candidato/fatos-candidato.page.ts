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
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  type UiLookupFalho,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { avisoDeFalhaDoLookup } from '../../shared/foco';
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
import { ID_DAS_REGRAS_DO_DETALHE, ID_DO_TITULO_DA_LISTA } from './ids-do-fato';

/**
 * O catálogo de fatos do candidato (ADR-0136): a lista com filtro por origem e situação, o detalhe,
 * a criação de fato declarado, derivado e agregado e a edição, que abre logo depois de criar.
 */
@Component({
  selector: 'cfg-fatos-candidato-page',
  imports: [
    AlertaNovaTentativaComponent,
    ConfirmacaoDeRemocaoComponent,
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
  private readonly avisoDaAprovacao = avisoDeFalhaDoLookup(this.aprovacao);
  protected readonly novaTentativaDaAprovacao = acompanharNovaTentativa({
    assunto: 'situação de aprovação',
    pendente: this.aprovacao.pendente,
    falhou: this.avisoDaAprovacao,
    destino: () => document.getElementById(ID_DO_TITULO_DA_LISTA),
  });
  protected readonly falhasDeApoio = computed<readonly UiLookupFalho[]>(() =>
    this.avisoDaAprovacao()
      ? [
          {
            nome: 'itens que aguardam a proteção de dados',
            pendente: this.aprovacao.pendente(),
            fase: this.novaTentativaDaAprovacao.fase(),
            recarregar: () =>
              this.novaTentativaDaAprovacao.executar(() => this.aprovacao.carregar()),
          },
        ]
      : [],
  );
  protected readonly novaTentativa = acompanharNovaTentativa({
    assunto: 'fatos',
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById(ID_DO_TITULO_DA_LISTA),
  });

  protected readonly novaTentativaDoCatalogo = acompanharNovaTentativa({
    assunto: 'catálogo de fatos',
    pendente: this.detalhe.catalogoPendente,
    falhou: this.detalhe.catalogoFalhou,
    destino: () => document.getElementById(ID_DAS_REGRAS_DO_DETALHE),
  });

  protected tentarCatalogoDoDetalhe(): void {
    this.novaTentativaDoCatalogo.executar(() => this.detalhe.recarregarCatalogo());
  }

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }

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

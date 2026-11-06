import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
} from '@angular/core';
import { InstituicaoDto } from '@uniplus/shared-data/organizacao';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { AlertaNovaTentativaComponent } from '../../shared/alerta-nova-tentativa';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { ENDERECO_NO_GEO } from '../../shared/endereco';
import { devolverFocoDaLista, focarAposNovaTentativa, focoEstaLivre } from '../../shared/foco';
import { EdicaoDaInstituicao } from './edicao-da-instituicao';
import { InstituicaoFormularioComponent } from './instituicao-formulario.component';
import { InstituicaoPainelComponent } from './instituicao-painel.component';
import { InstituicaoStore } from './instituicao.store';
import { ReitoriasStore } from './reitorias.store';

const ID_DO_TITULO = 'cfg-instituicao-titulo-da-pagina';
const ID_DO_SELECT_DA_UNIDADE_RAIZ = 'cfg-instituicao-unidadeRaizId';
const ID_DA_ACAO = 'cfg-instituicao-acao';

/** Cabeçalho institucional da plataforma: compõe o painel, o formulário e a confirmação de remoção. */
@Component({
  selector: 'cfg-instituicao-page',
  providers: [ENDERECO_NO_GEO, InstituicaoStore, ReitoriasStore, EdicaoDaInstituicao],
  standalone: true,
  imports: [
    AlertComponent,
    AlertaNovaTentativaComponent,
    ConfirmacaoDeRemocaoComponent,
    InstituicaoFormularioComponent,
    InstituicaoPainelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instituicao.page.html',
  host: { class: 'cfg-page' },
})
export class InstituicaoPage {
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly store = inject(InstituicaoStore);
  protected readonly reitorias = inject(ReitoriasStore);
  protected readonly edicao = inject(EdicaoDaInstituicao);

  protected readonly unidadeRaiz = computed(() =>
    this.reitorias.rotuloDaUnidadeRaiz(this.store.instituicao()?.unidadeRaizId ?? null),
  );
  /** A leitura carrega ou há escrita em curso: o "Tentar novamente" fica indisponível, sem perder o foco. */
  protected readonly indisponivel = computed(
    () => this.store.carregando() || this.edicao.gravando(),
  );
  private readonly novaTentativa = focarAposNovaTentativa(
    this.indisponivel,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById(ID_DO_TITULO),
  );
  private readonly novaTentativaDasReitorias = focarAposNovaTentativa(
    this.reitorias.carregando,
    this.reitorias.comErro,
    () => document.getElementById(ID_DO_SELECT_DA_UNIDADE_RAIZ),
  );
  private readonly foco = devolverFocoDaLista({
    gravando: this.edicao.gravando,
    carregando: this.store.carregando,
    atributoDaLinha: 'data-instituicao-id',
    idDoTitulo: ID_DO_TITULO,
    idDoCadastro: ID_DA_ACAO,
  });
  private readonly injector = inject(Injector);
  private acionador: Element | null = null;
  private estavaAberto = false;

  /**
   * A releitura que segue uma recusa pode trocar o painel enquanto o formulário está aberto: o
   * botão que o abriu sai da tela e fechar o formulário não tem a quem devolver o foco.
   */
  private readonly focoAoFechar = effect(() => {
    if (this.edicao.aberto()) {
      this.estavaAberto = true;
      return;
    }
    if (this.estavaAberto) {
      this.estavaAberto = false;
      afterNextRender(() => this.focarSeOAcionadorSaiu(), { injector: this.injector });
    }
  });

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }

  protected tentarNovamenteReitorias(): void {
    this.novaTentativaDasReitorias.executar(() => this.reitorias.tentarNovamente());
  }

  protected cadastrar(): void {
    this.acionador = document.activeElement;
    this.foco.registrar(null);
    this.edicao.abrirCadastro();
  }

  protected editar(instituicao: InstituicaoDto): void {
    this.acionador = document.activeElement;
    this.foco.registrar(null);
    this.edicao.abrirEdicao(instituicao);
  }

  private focarSeOAcionadorSaiu(): void {
    if (this.edicao.gravando() || !focoEstaLivre() || this.acionador?.isConnected) {
      return;
    }
    const destino = document.getElementById(ID_DA_ACAO) ?? document.getElementById(ID_DO_TITULO);
    destino?.focus();
  }
}

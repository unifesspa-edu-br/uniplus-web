import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ModalidadeDto, NATUREZAS_LEGAIS } from '@uniplus/shared-data/configuracao';
import {
  acompanharLeitura,
  AlertComponent,
  deClausulasDoWire,
  DialogComponent,
  FalhaDeLeituraComponent,
  fatosParaLeitura,
  resumoDaRegra,
  SpinnerComponent,
  type UiFilterChipOption,
  type UiFiltroAtivo,
} from '@uniplus/shared-ui/components';

import { RecusaDaLeituraComponent } from '../../shared/recusa-da-leitura';
import { ModalidadesFiltrosComponent } from './modalidades-filtros.component';
import { ModalidadesListaComponent } from './modalidades-lista.component';
import { ModalidadesTabelaComponent } from './modalidades-tabela.component';
import { EdicaoDasModalidades } from './edicao-das-modalidades';
import { ModalidadesStore } from './modalidades.store';

@Component({
  selector: 'cfg-modalidades-list-page',
  providers: [ModalidadesStore, EdicaoDasModalidades],
  standalone: true,
  imports: [
    FalhaDeLeituraComponent,
    RecusaDaLeituraComponent,
    ModalidadesFiltrosComponent,
    ModalidadesListaComponent,
    ModalidadesTabelaComponent,
    AlertComponent,
    DialogComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidades-list.page.html',
  host: { class: 'cfg-page' },
})
export class ModalidadesListPage {
  private readonly store = inject(ModalidadesStore);
  private readonly edicao = inject(EdicaoDasModalidades);
  private readonly injector = inject(Injector);
  private readonly entendi = viewChild<ElementRef<HTMLButtonElement>>('entendi');

  protected readonly busca = signal('');
  protected readonly naturezaSelecionada = signal<string | null>(null);
  protected readonly filtrosAtivos = computed<readonly UiFiltroAtivo[]>(() => {
    const natureza = this.naturezaSelecionada();
    if (natureza === null) {
      return [];
    }
    const rotulo = NATUREZAS_LEGAIS.find((n) => n.value === natureza)?.label ?? natureza;
    return [{ nome: 'Natureza', valor: rotulo }];
  });
  protected readonly dialogAberto = this.edicao.dialogAberto;
  protected readonly removendo = this.edicao.removendo;
  protected readonly anuncio = this.edicao.anuncio;
  protected readonly modalidadeParaRemover = this.edicao.modalidadeParaRemover;
  /** Bloqueio autoritativo do servidor (409) além do pré-cheque client-side. */
  protected readonly bloqueioServidor = this.edicao.bloqueioServidor;
  /** Mensagem do `ProblemDetails` do 409 — usada quando a referência viva não está na página carregada. */
  protected readonly mensagemBloqueioServidor = this.edicao.mensagemBloqueioServidor;
  protected readonly tituloDoBloqueio = this.edicao.tituloDoBloqueio;
  /** Fallback quando o servidor bloqueia sem título e o mapa reverso local está vazio. */
  protected readonly mensagemBloqueioPadrao =
    'Esta modalidade não pode ser removida porque outra modalidade viva a referencia ' +
    '(possivelmente fora desta página). Ajuste ou remova essas referências antes de removê-la.';

  protected readonly loading = this.store.carregando;
  protected readonly prevCursor = this.store.anterior;
  protected readonly nextCursor = this.store.proximo;
  protected readonly modalidades = this.store.modalidades;

  /**
   * Mapa reverso código → modalidades vivas que o referenciam (origem/destino/par/
   * fallback). Calculado sobre a página carregada — é uma DICA de UX (coluna
   * "Referenciada por" e pré-bloqueio de remoção); o backend é a fonte autoritativa
   * do bloqueio (409). Domínio pequeno e fechado: uma página cobre as vivas na prática.
   */
  protected readonly referenciasReversas = computed(() => {
    const mapa = new Map<string, ModalidadeDto[]>();
    for (const m of this.modalidades()) {
      const alvos = [
        m.composicaoOrigem,
        m.remanejamentoDestino,
        m.remanejamentoPar,
        m.remanejamentoFallback,
      ];
      for (const alvo of alvos) {
        if (!alvo || alvo === m.codigo) continue;
        const lista = mapa.get(alvo) ?? [];
        if (!lista.some((x) => x.id === m.id)) lista.push(m);
        mapa.set(alvo, lista);
      }
    }
    return mapa;
  });

  protected readonly chipsNatureza = computed<readonly UiFilterChipOption[]>(() => {
    const todas = this.modalidades();
    return NATUREZAS_LEGAIS.map((n) => ({
      value: n.value,
      label: n.label,
      count: todas.filter((m) => m.naturezaLegal === n.value).length,
    }));
  });

  protected readonly modalidadesFiltradas = computed(() => {
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    const natureza = this.naturezaSelecionada();
    return this.modalidades().filter((m) => {
      const casaBusca =
        termo.length === 0 ||
        m.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        (m.descricao ?? '').toLocaleLowerCase('pt-BR').includes(termo);
      const casaNatureza = natureza === null || m.naturezaLegal === natureza;
      return casaBusca && casaNatureza;
    });
  });

  /** A regra de aplicabilidade de cada modalidade numa linha. */
  protected readonly quemConcorre = computed<ReadonlyMap<string, string>>(() => {
    const catalogo = this.store.catalogo.data();
    const fatos = catalogo === null ? null : fatosParaLeitura(catalogo);
    return new Map(
      this.modalidadesFiltradas().map((m) => [
        m.id,
        resumoDaRegra(deClausulasDoWire(m.regraDeAplicabilidade), fatos),
      ]),
    );
  });

  protected readonly temFiltroAtivo = computed(
    () => this.busca().trim().length > 0 || this.naturezaSelecionada() !== null,
  );

  protected readonly remocaoBloqueada = computed(() => {
    if (this.bloqueioServidor()) return true;
    const alvo = this.modalidadeParaRemover();
    return alvo !== null && (this.referenciasReversas().get(alvo.codigo)?.length ?? 0) > 0;
  });

  protected readonly errorMessage = this.store.mensagemDeErro;
  protected readonly leitura = acompanharLeitura({
    assunto: 'modalidades',
    falha: this.errorMessage,
    pendente: this.loading,
    indisponivel: this.removendo,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-modalidades-title'),
  });

  /** Os fatos nomeiam as condições da coluna "Quem concorre"; sem eles a linha diz só que há condições. */
  protected readonly leituraDosFatos = acompanharLeitura({
    assunto: 'fatos',
    falha: this.store.falhaDosFatos,
    pendente: this.store.catalogo.isLoading,
    recusada: computed(() => this.store.recusaDosFatos() !== null),
    recarregar: () => this.store.catalogo.reload(),
    destino: () => document.getElementById('cfg-modalidades-title'),
  });
  protected readonly recusaDosFatos = this.store.recusaDosFatos;

  /** A linha da modalidade cuja remoção corre, para sinalizá-la. */
  protected readonly removendoId = computed(() =>
    this.removendo() ? (this.modalidadeParaRemover()?.id ?? null) : null,
  );

  constructor() {
    effect(() => {
      if (this.bloqueioServidor()) {
        afterNextRender(() => this.entendi()?.nativeElement.focus(), { injector: this.injector });
      }
    });
  }

  protected referenciadaPor(codigo: string): readonly ModalidadeDto[] {
    return this.referenciasReversas().get(codigo) ?? [];
  }

  protected proximaPagina(): void {
    this.store.proximaPagina();
  }
  protected paginaAnterior(): void {
    this.store.paginaAnterior();
  }
  protected limparFiltros(): void {
    this.busca.set('');
    this.naturezaSelecionada.set(null);
  }

  protected pedirRemocao(m: ModalidadeDto): void {
    if (this.removendo()) return;
    this.modalidadeParaRemover.set(m);
    this.bloqueioServidor.set(false);
    this.mensagemBloqueioServidor.set(null);
    this.anuncio.set('');
    this.dialogAberto.set(true);
  }

  protected aoFecharDialog(): void {
    this.modalidadeParaRemover.set(null);
    this.bloqueioServidor.set(false);
    this.mensagemBloqueioServidor.set(null);
  }

  protected fecharBloqueio(): void {
    if (this.removendo()) return;
    this.dialogAberto.set(false);
  }

  protected removerConfirmado(): void {
    const alvo = this.modalidadeParaRemover();
    if (alvo === null || this.remocaoBloqueada()) return;
    this.edicao.remover(alvo);
  }
}

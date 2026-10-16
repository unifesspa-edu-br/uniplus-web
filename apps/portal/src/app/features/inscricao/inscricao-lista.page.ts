import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  EmptyStateComponent,
  FilterBarComponent,
  SegmentedComponent,
  SpinnerComponent,
  TagComponent,
  TextareaComponent,
  type UiButtonVariant,
  type UiSegmentedOption,
  UiTagVariant,
} from '@uniplus/shared-ui/components';
import { mediaQuerySignal } from '@uniplus/shared-utils';
import { FormsModule } from '@angular/forms';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiFailure, type ApiResult, ProblemI18nService } from '@uniplus/shared-core/http';
import { SituacaoInscricao } from '@uniplus/shared-data/selecao';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map, type Observable } from 'rxjs';
import { type ItemDaLista, itemDaLista } from './inscricao-lista.model';
import { MinhasInscricoesService } from './minhas-inscricoes.service';

/** Abaixo desta largura a lista é a forma canônica (decisão do design system). */
const COMPACT_MEDIA_QUERY = '(max-width: 599.98px)';

const VISAO_STORE_KEY = 'uniplus.portal.inscricao-lista-visao';

function readVisao(): VisaoCertames {
  try {
    const valor = localStorage.getItem(VISAO_STORE_KEY);
    return valor === 'cards' ? 'cards' : 'lista';
  } catch {
    return 'lista';
  }
}

function writeVisao(visao: VisaoCertames): void {
  try {
    localStorage.setItem(VISAO_STORE_KEY, visao);
  } catch {
    // Storage pode estar indisponível em navegação privada.
  }
}

type VisaoCertames = 'lista' | 'cards';

const VIEW_OPTIONS: readonly UiSegmentedOption<VisaoCertames>[] = [
  { value: 'lista', label: 'Lista', icon: 'pi-list' },
  { value: 'cards', label: 'Cards', icon: 'pi-th-large' },
];

const INSCRICAO_STATUS_LABEL: Record<SituacaoInscricao, string> = {
  [SituacaoInscricao.rascunho]: 'Em rascunho',
  [SituacaoInscricao.submetida]: 'Enviada',
  [SituacaoInscricao.cancelada]: 'Cancelada',
};
const INSCRICAO_STATUS_VARIANT: Record<SituacaoInscricao, UiTagVariant> = {
  [SituacaoInscricao.rascunho]: 'warning',
  [SituacaoInscricao.submetida]: 'success',
  [SituacaoInscricao.cancelada]: 'neutral',
};

type TipoDeAcao = 'continuar' | 'corrigir' | 'comprovante' | 'cancelar' | 'descartar';

/** Uma ação que a lista oferece sobre uma inscrição. */
export interface AcaoDaInscricao {
  readonly tipo: TipoDeAcao;
  readonly label: string;
  readonly variant: UiButtonVariant;
}

const ACAO: Record<TipoDeAcao, AcaoDaInscricao> = {
  continuar: { tipo: 'continuar', label: 'Continuar inscrição', variant: 'primary' },
  corrigir: { tipo: 'corrigir', label: 'Corrigir dados', variant: 'primary' },
  comprovante: { tipo: 'comprovante', label: 'Ver comprovante', variant: 'tertiary' },
  cancelar: { tipo: 'cancelar', label: 'Cancelar inscrição', variant: 'secondary' },
  descartar: { tipo: 'descartar', label: 'Descartar rascunho', variant: 'secondary' },
};

/** O que o diálogo está confirmando: o item e a ação que o abriu. */
interface Confirmacao {
  readonly item: ItemDaLista;
  readonly tipo: 'cancelar' | 'descartar';
}

@Component({
  selector: 'ptl-inscricao-lista',
  standalone: true,
  imports: [
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    EmptyStateComponent,
    FilterBarComponent,
    FormsModule,
    SegmentedComponent,
    SpinnerComponent,
    TagComponent,
    TextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inscricao-lista.page.html',
  styleUrls: ['./inscricao-lista.page.css'],
  host: { class: 'ptl-page' },
})
export class InscricaoListaPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly minhasInscricoes = inject(MinhasInscricoesService);
  private readonly router = inject(Router);
  private readonly problemas = inject(ProblemI18nService);
  private readonly userContext = inject(UserContextService);
  private readonly paginaTitulo = viewChild<ElementRef<HTMLHeadingElement>>('paginaTitulo');
  protected readonly nomeUsuario = computed(() => this.userContext.displayName() || 'Candidato');
  /** Detecta a largura em que a lista é a forma canônica (<600px). */
  protected readonly isCompacto = mediaQuerySignal(COMPACT_MEDIA_QUERY);
  /** Abaixo de 600px a visão fica travada em lista, mesmo com "cards" salvo. */
  protected readonly visaoEfetiva = computed<VisaoCertames>(() =>
    this.isCompacto() ? 'lista' : this.visao(),
  );
  protected readonly inscricoesFiltradas = computed(() => {
    if (this.termoBusca()) {
      return this.lista().filter((inscricao) =>
        this.normalizaTexto(inscricao.nome).includes(this.normalizaTexto(this.termoBusca())),
      );
    }
    return this.lista();
  });
  private readonly inscricoesResource = rxResource({
    stream: () =>
      this.minhasInscricoes.listar().pipe(
        map((resultado) => {
          if (!resultado.ok) throw resultado.problem;
          return resultado.data.map(itemDaLista);
        }),
      ),
  });
  protected readonly lista = computed(() => this.inscricoesResource.value() ?? []);
  protected readonly loading = this.inscricoesResource.isLoading;
  protected readonly errorMessage = computed(() =>
    this.inscricoesResource.error() ? 'Tente novamente em alguns instantes.' : null,
  );
  protected readonly temFiltrosAtivos = computed(() => this.termoBusca().length > 0);
  protected readonly termoBusca = signal('');
  protected readonly viewOptions = VIEW_OPTIONS;
  protected readonly visao = signal<VisaoCertames>(readVisao());

  /** A inscrição e a ação que o diálogo confirma; fica até a próxima abertura, para o título não mudar na saída. */
  protected readonly confirmacao = signal<Confirmacao | null>(null);
  protected readonly dialogoAberto = signal(false);
  protected readonly motivo = signal('');
  protected readonly executando = signal(false);
  protected readonly erroDaAcao = signal<string | null>(null);
  /** O resultado da última ação, na região viva: a inscrição some ou muda e o leitor de tela precisa saber. */
  protected readonly aviso = signal<string | null>(null);
  /**
   * Com a ação concluída o botão que abriu o diálogo já não existe; o foco vai ao título da página em
   * vez de voltar a ele.
   */
  protected readonly devolveFocoAoGatilho = signal(true);
  private foiConcluida = false;

  constructor() {
    effect(() => writeVisao(this.visao()));
  }

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.inscricoesResource.reload();
      this.paginaTitulo()?.nativeElement?.focus();
    }
  }

  /** As ações que a API permite sobre a inscrição, na ordem em que a lista as mostra. */
  protected acoesDe(item: ItemDaLista): readonly AcaoDaInscricao[] {
    const { acoes } = item;
    return [
      ...(acoes.podeContinuar ? [ACAO.continuar] : []),
      ...(acoes.podeCorrigir ? [ACAO.corrigir] : []),
      ...(item.temComprovante ? [ACAO.comprovante] : []),
      ...(acoes.podeCancelar ? [ACAO.cancelar] : []),
      ...(acoes.podeDescartar ? [ACAO.descartar] : []),
    ];
  }

  protected executar(acao: AcaoDaInscricao, item: ItemDaLista): void {
    switch (acao.tipo) {
      case 'continuar':
      case 'corrigir':
        // O formulário abre a inscrição ativa do processo: o rascunho, ou a enviada na versão congelada.
        void this.router.navigate(['/inscricao', item.processoId]);
        return;
      case 'comprovante':
        void this.router.navigate(['/inscricao', 'comprovante', item.id]);
        return;
      case 'cancelar':
      case 'descartar':
        this.abrirConfirmacao(acao.tipo, item);
        return;
    }
  }

  protected confirmar(): void {
    const atual = this.confirmacao();
    if (!atual || this.executando()) return;
    this.executando.set(true);
    this.erroDaAcao.set(null);
    this.aviso.set(null);
    const { item, tipo } = atual;
    const chamada: Observable<ApiResult<void>> =
      tipo === 'descartar'
        ? this.minhasInscricoes.descartar(item.processoId)
        : this.minhasInscricoes.cancelar(item.processoId, this.motivo().trim() || null);
    chamada.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      this.executando.set(false);
      if (resultado.ok) {
        this.concluir(tipo, item);
      } else {
        this.erroDaAcao.set(this.mensagemDaFalha(resultado));
      }
    });
  }

  protected aoFecharDialogo(): void {
    const concluida = this.foiConcluida;
    this.foiConcluida = false;
    this.erroDaAcao.set(null);
    this.devolveFocoAoGatilho.set(true);
    if (concluida) this.paginaTitulo()?.nativeElement.focus();
  }

  private abrirConfirmacao(tipo: Confirmacao['tipo'], item: ItemDaLista): void {
    this.motivo.set('');
    this.erroDaAcao.set(null);
    this.confirmacao.set({ item, tipo });
    this.dialogoAberto.set(true);
  }

  private concluir(tipo: Confirmacao['tipo'], item: ItemDaLista): void {
    this.aviso.set(
      tipo === 'descartar'
        ? `Rascunho de ${item.nome} descartado.`
        : `Inscrição em ${item.nome} cancelada.`,
    );
    this.foiConcluida = true;
    this.devolveFocoAoGatilho.set(false);
    this.dialogoAberto.set(false);
    this.inscricoesResource.reload();
  }

  private mensagemDaFalha(falha: ApiFailure): string {
    const { title, detail } = this.problemas.resolve(falha.problem);
    return detail ?? title;
  }

  protected limparFiltros(): void {
    this.termoBusca.set('');
  }

  protected setVisao(visao: VisaoCertames | null): void {
    if (visao !== null) {
      this.visao.set(visao);
    }
  }

  protected exibeInscricaoStatusLabel(status: SituacaoInscricao): string {
    return INSCRICAO_STATUS_LABEL[status];
  }

  protected exibeInscricaoStatusVariantLabel(status: SituacaoInscricao): UiTagVariant {
    return INSCRICAO_STATUS_VARIANT[status];
  }

  private normalizaTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase();
  }
}

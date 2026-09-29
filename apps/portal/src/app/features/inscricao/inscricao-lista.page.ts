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
  EmptyStateComponent,
  FilterBarComponent,
  SegmentedComponent,
  SpinnerComponent,
  TagComponent,
  type UiButtonVariant,
  type UiSegmentedOption,
  UiTagVariant,
} from '@uniplus/shared-ui/components';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type Inscricao, InscricaoStatus, } from './inscricao-lista.mock';
import { rxResource } from '@angular/core/rxjs-interop';
import { InscricoesCandidatoMockService } from './inscricao-mock.service';

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
  { value: 'lista', label: 'Lista', icon: 'pi-list', },
  { value: 'cards', label: 'Cards', icon: 'pi-th-large', },
];

const INSCRICAO_STATUS_LABEL: Record<InscricaoStatus, string> = {
  analise: 'Em análise',
  rascunho: 'Em rascunho',
  aprovada: 'Aprovada',
  reprovada: 'Não aprovada',
};
const INSCRICAO_STATUS_VARIANT: Record<InscricaoStatus, UiTagVariant> = {
  analise: 'info',
  rascunho: 'warning',
  aprovada: 'success',
  reprovada: 'danger',
};

export interface InscricaoBotaoInfo {
  label: string;
  variant: UiButtonVariant;
}
const INSCRICAO_BUTTON_DEFINITION: Record<InscricaoStatus, InscricaoBotaoInfo> = {
  analise: { label: 'Ver detalhes', variant: 'tertiary' },
  rascunho: { label: 'Continuar inscrição', variant: 'primary' },
  aprovada: { label: 'Ver detalhes', variant: 'tertiary' },
  reprovada: { label: 'Ver detalhes', variant: 'tertiary' },
};

@Component({
  selector: 'ptl-inscricao-lista',
  standalone: true,
  imports: [
    AlertComponent,
    ButtonComponent,
    EmptyStateComponent,
    FilterBarComponent,
    SegmentedComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inscricao-lista.page.html',
  styleUrls: ['./inscricao-lista.page.css'],
  host: { class: 'ptl-page' },
})
export class InscricaoListaPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly inscricoesCandidatoService = inject(InscricoesCandidatoMockService);
  private readonly userContext = inject(UserContextService);
  private readonly paginaTitulo = viewChild<ElementRef<HTMLHeadingElement>>('paginaTitulo');
  protected readonly nomeUsuario = computed(() => this.userContext.displayName() || 'Candidato');
  /** Detecta a largura em que a lista é a forma canônica (<600px), via `matchMedia`. */
  protected readonly isCompacto = signal(this.mediaCompacta()?.matches ?? false);
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
    stream: () => this.inscricoesCandidatoService.listar(),
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

  constructor() {
    this.escutarBreakpoint();
    effect(() => writeVisao(this.visao()));
  }

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.inscricoesResource.reload();
      this.paginaTitulo()?.nativeElement?.focus();
    }
  }

  protected abrirInscricao(_inscricao: Inscricao): void {
    // navegação implementada na Story de detalhe da inscrição
  }

  protected limparFiltros(): void {
    this.termoBusca.set('');
  }

  protected setVisao(visao: VisaoCertames | null): void {
    if (visao !== null) {
      this.visao.set(visao);
    }
  }

  private mediaCompacta(): MediaQueryList | null {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(COMPACT_MEDIA_QUERY)
      : null;
  }

  private escutarBreakpoint(): void {
    const mediaQuery = this.mediaCompacta();
    if (mediaQuery === null) return;

    const ouvinte = (evento: MediaQueryListEvent) => this.isCompacto.set(evento.matches);
    mediaQuery.addEventListener('change', ouvinte);
    this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', ouvinte));
  }

  protected exibeInscricaoStatusLabel(status: InscricaoStatus): string {
    return INSCRICAO_STATUS_LABEL[status];
  }

  protected exibeInscricaoStatusVariantLabel(status: InscricaoStatus): UiTagVariant {
    return INSCRICAO_STATUS_VARIANT[status];
  }

  protected obterBotaoInfo(status: InscricaoStatus): InscricaoBotaoInfo {
    return INSCRICAO_BUTTON_DEFINITION[status];
  }

  private normalizaTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase();
  }
}

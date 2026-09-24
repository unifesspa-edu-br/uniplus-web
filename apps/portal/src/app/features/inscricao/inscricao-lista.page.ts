import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
  effect,
  DestroyRef,
} from '@angular/core';

import {
  AlertComponent,
  EmptyStateComponent,
  FilterBarComponent,
  SegmentedComponent,
  SpinnerComponent,
  TagComponent,
  type UiSegmentedOption,
  UiTagVariant,
} from '@uniplus/shared-ui/components';
import { AuthService } from '@uniplus/shared-auth';
import { InscricaoStatus, INSCRICOES_MOCK, } from './inscricao-lista.mock';

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
  className: string
}
const INSCRICAO_BUTTON_DEFINITION: Record<InscricaoStatus, InscricaoBotaoInfo> = {
  analise: { label: 'Ver detalhes', className: 'btn--tertiary' },
  rascunho: { label: 'Continuar', className: 'btn--primary' },
  aprovada: { label: 'Ver próximos passos', className: 'btn--tertiary' },
  reprovada: { label: 'Ver motivo e recorrer', className: 'btn--tertiary' },
};

@Component({
  selector: 'ptl-inscricao-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    AlertComponent,
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
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  protected nomeUsuario = computed(() => {
    const userProfile = this.authService.userProfile();
    if (!userProfile) {
      return 'Candidato';
    }
    return userProfile.nomeSocial ?? userProfile.nomeCivil;
  });
  /** Detecta a largura em que a lista é a forma canônica (<600px), via `matchMedia`. */
  protected readonly isCompacto = signal(this.mediaCompacta()?.matches ?? false);
  /** Abaixo de 600px a visão fica travada em lista, mesmo com "cards" salvo. */
  protected readonly visaoEfetiva = computed<VisaoCertames>(() =>
    this.isCompacto() ? 'lista' : this.visao(),
  );
  protected readonly lista = signal(INSCRICOES_MOCK);
  protected readonly inscricoesFiltradas = computed(() => {
    if (this.termoBusca()) {
      return this.lista().filter((inscricao) =>
        inscricao.nome.normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLocaleLowerCase()
          .includes(this.termoBusca().toLocaleLowerCase()),
      );
    }
    return this.lista();
  });
  protected readonly errorMessage = computed<string | null>(() => {
    return null;
  });
  protected readonly temFiltrosAtivos = computed(
    () => this.termoBusca().length > 0,
  );
  protected readonly loading = signal(false);
  protected readonly termoBusca = signal('');
  protected readonly viewOptions = VIEW_OPTIONS;
  protected readonly visao = signal<VisaoCertames>(readVisao());

  constructor() {
    this.escutarBreakpoint();
    effect(() => writeVisao(this.visao()));
  }

  protected tentarNovamente(): void {
    if (!this.loading) {
      //this.lista.reload();
    }
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
}

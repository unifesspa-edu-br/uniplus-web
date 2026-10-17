import {
  ChangeDetectionStrategy,
  Component,
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
import { SituacaoInscricao } from '@uniplus/shared-data/selecao';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { type ItemDaLista, itemDaLista } from './inscricao-lista.model';
import { MinhasInscricoesService } from './minhas-inscricoes.service';
import { mediaQuerySignal } from '@uniplus/shared-utils';

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

const INSCRICAO_STATUS_LABEL: Record<SituacaoInscricao, string> = {
  [SituacaoInscricao.rascunho]: 'Em rascunho',
  [SituacaoInscricao.submetida]: 'Enviada',
};
const INSCRICAO_STATUS_VARIANT: Record<SituacaoInscricao, UiTagVariant> = {
  [SituacaoInscricao.rascunho]: 'warning',
  [SituacaoInscricao.submetida]: 'success',
};

export interface InscricaoBotaoInfo {
  label: string;
  variant: UiButtonVariant;
}
const INSCRICAO_BUTTON_DEFINITION: Record<SituacaoInscricao, InscricaoBotaoInfo> = {
  [SituacaoInscricao.rascunho]: { label: 'Continuar inscrição', variant: 'primary' },
  [SituacaoInscricao.submetida]: { label: 'Ver comprovante', variant: 'tertiary' },
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
  private readonly minhasInscricoes = inject(MinhasInscricoesService);
  private readonly router = inject(Router);
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
      this.minhasInscricoes
        .listar()
        .pipe(
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

  constructor() {
    effect(() => writeVisao(this.visao()));
  }

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.inscricoesResource.reload();
      this.paginaTitulo()?.nativeElement?.focus();
    }
  }

  /** O rascunho volta ao formulário; a inscrição enviada abre o comprovante da última submissão. */
  protected abrirInscricao(inscricao: ItemDaLista): void {
    const destino =
      inscricao.situacao === SituacaoInscricao.submetida
        ? ['/inscricao', inscricao.id, 'comprovante']
        : ['/inscricao', inscricao.id];
    void this.router.navigate(destino);
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

  protected obterBotaoInfo(status: SituacaoInscricao): InscricaoBotaoInfo {
    return INSCRICAO_BUTTON_DEFINITION[status];
  }

  private normalizaTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase();
  }
}

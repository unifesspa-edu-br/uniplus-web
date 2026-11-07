import { Injectable, computed, inject, linkedSignal, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import {
  type ApiResult,
  type Cursor,
  type CursorPagina,
  ProblemI18nService,
  extractNextCursor,
  extractPrevCursor,
  useApiResource,
  useCursorObsoletoRecovery,
} from '@uniplus/shared-core/http';
import {
  type CertameNaVitrineDto,
  SELECAO_BASE_PATH,
  certamesPublicosRequest,
} from '@uniplus/shared-data/selecao';
import type { UiFilterChipOption, UiFiltroAtivo } from '@uniplus/shared-ui/components';

import { type ContadoresSituacao, contadoresDosHeaders } from './contadores-de-situacao';
import { SITUACOES_EXIBIDAS, recebeInscricao, rotuloDaSituacao } from './situacao-do-certame';

/** Debounce da busca textual — uma request por rajada de digitação, não por tecla. */
const BUSCA_DEBOUNCE_MS = 300;

type ListaDeCertames = ApiResult<readonly CertameNaVitrineDto[]> | undefined;

/**
 * O que a vitrine pública de certames lê: a lista de `GET /api/selecao/certames` (ADR-0131/ADR-0133
 * da `uniplus-api`; anônima), filtrada pela busca e pela situação, e paginada por cursor opaco
 * (Anterior/Próximo, sem "Página X de Y" — o contrato não expõe total). Busca e situação viram
 * parâmetros de request; os contadores dos chips vêm dos headers `X-Certames-*`. Provida pela página.
 */
@Injectable()
export class VitrineDeCertames {
  private readonly basePath = inject(SELECAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);

  /** Valor bruto do campo de busca — o que o `ui-filter-bar` lê/escreve a cada tecla. */
  readonly termoBusca = signal('');
  readonly situacaoSelecionada = signal<string | null>(null);

  /** Termo aplicado à busca server-side (`?q=`) — debounced: uma request por rajada. */
  private readonly buscaAplicada = toSignal(
    toObservable(this.termoBusca).pipe(
      map((termo) => termo.trim()),
      debounceTime(BUSCA_DEBOUNCE_MS),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  /** Chave do filtro vigente — fonte do reset de paginação (o cursor carrega o filtro antigo). */
  private readonly filtroKey = computed(() =>
    JSON.stringify([this.buscaAplicada(), this.situacaoSelecionada()]),
  );

  /** Página de navegação atual (`undefined` = primeira). Volta à primeira quando o filtro muda. */
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () => this.filtroKey(),
    computation: () => undefined,
  });

  private readonly lista = useApiResource<readonly CertameNaVitrineDto[]>(() =>
    certamesPublicosRequest(this.basePath, {
      pagina: this.pagina(),
      situacao: this.situacaoSelecionada(),
      q: this.buscaAplicada(),
      incluirContadores: true,
    }),
  );

  readonly carregando = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ListaDeCertames,
    { readonly prev: Cursor | null; readonly next: Cursor | null }
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? { prev: null, next: null };
      if (envelope === undefined) {
        return atual;
      }
      if (!envelope.ok) {
        return this.naPrimeiraPagina() ? { prev: null, next: null } : atual;
      }
      const link = untracked(() => this.lista.headers()?.get('Link') ?? null);
      return { prev: extractPrevCursor(link), next: extractNextCursor(link) };
    },
  });

  readonly hasPrevious = computed(() => this.cursores().prev !== null);
  readonly hasNext = computed(() => this.cursores().next !== null);

  readonly certames = linkedSignal<ListaDeCertames, readonly CertameNaVitrineDto[]>({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? [];
      if (envelope === undefined) {
        return atual;
      }
      if (!envelope.ok) {
        return this.naPrimeiraPagina() ? [] : atual;
      }
      return envelope.data;
    },
  });

  /** Contadores dos chips de situação — sempre pedidos, cobrem a vitrine inteira, não só a página. */
  private readonly contadores = linkedSignal<ListaDeCertames, ContadoresSituacao | null>({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? null;
      if (envelope === undefined || !envelope.ok) {
        return atual;
      }
      return contadoresDosHeaders(untracked(() => this.lista.headers()));
    },
  });

  readonly statusChips = computed<readonly UiFilterChipOption[]>(() => {
    const contadores = this.contadores();
    return SITUACOES_EXIBIDAS.map((situacao) => ({
      value: situacao,
      label: rotuloDaSituacao(situacao),
      count: contadores?.[situacao],
    }));
  });

  readonly filtrosAtivos = computed<readonly UiFiltroAtivo[]>(() => {
    const situacao = this.situacaoSelecionada();
    if (situacao === null) {
      return [];
    }
    const rotulo = this.statusChips().find((chip) => chip.value === situacao)?.label ?? situacao;
    return [{ nome: 'Situação', valor: rotulo }];
  });

  readonly temFiltrosAtivos = computed(
    () => this.buscaAplicada().length > 0 || this.situacaoSelecionada() !== null,
  );

  /**
   * Certame do hero — só na primeira página sem filtro ativo, e só entre os que
   * ainda recebem inscrição: o hero convida a se inscrever, e a API ordena por
   * urgência, de modo que sem esse recorte o primeiro item de uma vitrine sem
   * certame aberto seria um encerrado, anunciado com prazo vencido e botão de
   * inscrição.
   */
  readonly destaque = computed<CertameNaVitrineDto | null>(() => {
    if (this.pagina() !== undefined || this.temFiltrosAtivos()) {
      return null;
    }
    return this.certames().find(recebeInscricao) ?? null;
  });

  // Cursor que não continua esta consulta (400) ou que expirou (410): recomeça
  // a paginação sem cursor. Sem aviso ao candidato — o portal não tem um host
  // de notificação global (diferente dos apps administrativos), e para uma
  // navegação pública somente-leitura recarregar em silêncio do começo é uma
  // degradação aceitável, não uma perda de trabalho.
  private readonly recuperandoDeCursorObsoleto = useCursorObsoletoRecovery({
    problem: this.lista.problem,
    pagina: this.pagina,
    reiniciarPagina: () => this.pagina.set(undefined),
    aoRecuperar: () => undefined,
  });

  readonly erro = computed<string | null>(() => {
    if (this.recuperandoDeCursorObsoleto()) {
      return null;
    }
    const problem = this.lista.problem();
    if (problem) {
      const { title, detail } = this.problemI18n.resolve(problem);
      return problem.status === 422 && detail ? detail : title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar os certames.' : null;
  });

  /** Sem filtro aplicado não há o que limpar: o texto ainda no debounce não é apagado por engano. */
  limparFiltros(): void {
    if (!this.temFiltrosAtivos()) return;
    this.termoBusca.set('');
    this.situacaoSelecionada.set(null);
  }

  proximaPagina(): void {
    const proximo = this.cursores().next;
    if (proximo !== null && !this.carregando()) {
      this.pagina.set({ cursor: proximo, direction: 'next' });
    }
  }

  paginaAnterior(): void {
    const anterior = this.cursores().prev;
    if (anterior !== null && !this.carregando()) {
      this.pagina.set({ cursor: anterior, direction: 'prev' });
    }
  }

  /**
   * Repete a consulta que falhou, seja ela qual for: `reload()` reexecuta com
   * os parâmetros reativos vigentes, preservando a página em que o candidato
   * estava. Voltar à primeira página é recuperação de cursor obsoleto, e quem
   * cuida disso é `recuperandoDeCursorObsoleto`. Devolve `false` se a consulta
   * já corre e nenhuma outra começou.
   */
  recarregar(): boolean {
    return this.lista.reload();
  }

  private naPrimeiraPagina(): boolean {
    return untracked(() => this.pagina() === undefined);
  }
}

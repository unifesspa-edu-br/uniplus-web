import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import {
  ProblemI18nService,
  STATUS_HTTP,
  extractNextCursor,
  extractPrevCursor,
  useApiResource,
  useCursorObsoletoRecovery,
  type ApiResult,
  type Cursor,
  type CursorPagina,
} from '@uniplus/shared-core/http';
import {
  SELECAO_BASE_PATH,
  inscricoesDoProcessoRequest,
  type InscricaoDoProcessoDto,
} from '@uniplus/shared-data/selecao';

import { useCertameDoProcesso } from './certame-do-processo';

/** Itens por página iniciais. */
export const PAGE_SIZE_INICIAL = 50;

/** Onde a leitura da lista está; `nao-encontrado` é o 404 da API, que a tela diz com texto próprio. */
export type SituacaoDaLista =
  | { readonly estado: 'lendo' }
  | { readonly estado: 'nao-encontrado' }
  | { readonly estado: 'falha'; readonly mensagem: string }
  | { readonly estado: 'lido' };

interface PaginaLida {
  readonly itens: readonly InscricaoDoProcessoDto[];
  readonly cursores: { readonly anterior: Cursor | null; readonly proximo: Cursor | null };
}

const SEM_PAGINA: PaginaLida = { itens: [], cursores: { anterior: null, proximo: null } };

/**
 * O que a página das inscrições do processo sabe: a página corrente da lista, os cursores e o que
 * dá nome ao processo e aos cursos. Provido pela página, porque descreve um processo só.
 *
 * A lista mostra o que a API devolve; a decisão de visibilidade é dela. As leituras são
 * `useApiResource` (ADR-0018): trocar a página ou o limite cancela a leitura em curso, então a
 * última escolha é a que vale. A página anterior continua em tela enquanto a nova carrega e depois
 * de uma falha de navegação, para o pager não sumir sob o operador (ADR-0026).
 */
@Injectable()
export class InscricoesDoProcesso {
  private readonly basePath = inject(SELECAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);

  readonly processoId = signal<string | null>(null);
  readonly limite = signal(PAGE_SIZE_INICIAL);
  /** `undefined` é a primeira página: sem cursor, com `limit`. */
  private readonly pagina = signal<CursorPagina | undefined>(undefined);
  /** A lista voltou à primeira página porque o cursor da navegação deixou de valer. */
  readonly recomecou = signal(false);

  private readonly lista = useApiResource<readonly InscricaoDoProcessoDto[]>(() => {
    const id = this.processoId();
    if (id === null) return undefined;
    const pagina = this.pagina();
    return inscricoesDoProcessoRequest(this.basePath, id, {
      cursor: pagina?.cursor,
      direction: pagina?.direction,
      limit: pagina === undefined ? this.limite() : undefined,
    });
  });

  private readonly certame = useCertameDoProcesso(this.processoId);

  private readonly ultimaPagina = linkedSignal<
    {
      readonly id: string | null;
      readonly resultado: ApiResult<readonly InscricaoDoProcessoDto[]> | undefined;
      readonly primeira: boolean;
      readonly falhou: boolean;
    },
    PaginaLida
  >({
    source: () => ({
      id: this.processoId(),
      resultado: this.lista.value(),
      primeira: this.pagina() === undefined,
      falhou: this.lista.error() !== undefined,
    }),
    computation: (fonte, anterior) => {
      const retida =
        anterior !== undefined && anterior.source.id === fonte.id ? anterior.value : SEM_PAGINA;
      // Falha na primeira página limpa a lista; a de navegação preserva a página e os cursores.
      if (fonte.falhou || fonte.resultado?.ok === false)
        return fonte.primeira ? SEM_PAGINA : retida;
      if (fonte.resultado === undefined) return retida;
      const link = fonte.resultado.headers?.get('Link') ?? null;
      return {
        itens: fonte.resultado.data,
        cursores: { anterior: extractPrevCursor(link), proximo: extractNextCursor(link) },
      };
    },
  });

  readonly inscricoes = computed(() => this.ultimaPagina().itens);
  readonly cursores = computed(() => this.ultimaPagina().cursores);
  readonly carregando = this.lista.isLoading;

  readonly situacao = computed<SituacaoDaLista>(() => {
    const problema = this.lista.problem();
    if (problema !== null) {
      return problema.status === STATUS_HTTP.NAO_ENCONTRADO
        ? { estado: 'nao-encontrado' }
        : { estado: 'falha', mensagem: this.problemI18n.resolve(problema).title };
    }
    if (this.lista.error() !== undefined) {
      return { estado: 'falha', mensagem: 'Não foi possível carregar as inscrições.' };
    }
    return this.lista.value() === undefined ? { estado: 'lendo' } : { estado: 'lido' };
  });

  readonly situacaoDoCertame = this.certame.situacao;
  readonly carregandoCertame = this.certame.carregando;
  readonly nomeDoProcesso = this.certame.nomeDoProcesso;
  readonly nomesDasOfertas = this.certame.nomesDasOfertas;
  readonly admiteSegundaOpcao = this.certame.admiteSegundaOpcao;

  constructor() {
    // O cursor deixou de continuar a consulta: repeti-lo repetiria a recusa, então recomeça.
    useCursorObsoletoRecovery({
      problem: this.lista.problem,
      pagina: this.pagina,
      reiniciarPagina: () => this.pagina.set(undefined),
      aoRecuperar: () => this.recomecou.set(true),
    });
  }

  /** Lê o processo indicado desde a primeira página. */
  abrir(processoId: string): void {
    this.recomecou.set(false);
    this.pagina.set(undefined);
    this.processoId.set(processoId);
  }

  proximaPagina(): void {
    const proximo = this.cursores().proximo;
    if (proximo === null) return;
    this.recomecou.set(false);
    this.pagina.set({ cursor: proximo, direction: 'next' });
  }

  paginaAnterior(): void {
    const anterior = this.cursores().anterior;
    if (anterior === null) return;
    this.recomecou.set(false);
    this.pagina.set({ cursor: anterior, direction: 'prev' });
  }

  /** O cursor carrega a janela antiga: trocar o limite recomeça da primeira página. */
  trocarLimite(limite: number): void {
    if (limite === this.limite()) return;
    this.recomecou.set(false);
    this.limite.set(limite);
    this.pagina.set(undefined);
  }

  /** Relê a lista e, se o certame também falhou, o certame. */
  tentarNovamente(): void {
    this.lista.reload();
    if (this.situacaoDoCertame() === 'falha') this.certame.recarregar();
  }

  recarregarCertame(): void {
    this.certame.recarregar();
  }
}

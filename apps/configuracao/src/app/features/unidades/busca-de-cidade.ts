import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, map, merge, of, switchMap } from 'rxjs';
import { ApiResult, ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { GeoApi, type CidadeResumoDto } from '@uniplus/shared-data/geo';
import { ATRASO_DA_BUSCA_EM_MS } from './unidades.store';

/** Tamanho da janela do seletor de cidade (cursor pagination, ADR-0026). */
const LIMITE_DE_CIDADES = 20;

/** Abaixo disso a busca não sai (mesmo corte do Seleção). */
const MINIMO_DE_LETRAS = 3;

/**
 * Desfecho de uma busca de cidade, sempre carimbado com o termo que o originou: separados, um
 * reset que esquece um deles deixaria o resultado de uma busca convivendo com o termo de outra.
 */
interface RespostaDeCidade {
  readonly termo: string;
  readonly opcoes: readonly CidadeResumoDto[];
  readonly problema: ProblemDetails | null;
}

interface Emissao {
  readonly busca: string;
  readonly resultado: ApiResult<readonly CidadeResumoDto[]>;
}

/** A busca de cidade na Geo: termo, debounce, opções e a falha da consulta. */
@Injectable()
export class BuscaDeCidade {
  private readonly geo = inject(GeoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  /** O termo digitado; não integra o comando enviado, só a cidade escolhida. */
  readonly termo = signal('');
  readonly buscando = signal(false);
  private readonly ultima = signal<RespostaDeCidade | null>(null);
  private readonly repeticoes = new Subject<void>();

  /**
   * O desfecho só vale enquanto responde ao termo que está no campo: o `switchMap` cancela a
   * busca em voo apenas depois do debounce, e sem esta guarda as opções de "mar" seguiriam
   * clicáveis com "bel" no campo, gravando a cidade errada.
   */
  private readonly corrente = computed<RespostaDeCidade | null>(() => {
    const ultima = this.ultima();
    return ultima !== null && ultima.termo === this.termo().trim() ? ultima : null;
  });

  readonly opcoes = computed<readonly CidadeResumoDto[]>(() => this.corrente()?.opcoes ?? []);

  /** A falha da busca do termo corrente, nunca a de um termo já abandonado. */
  readonly erro = computed<string | null>(() => {
    const problema = this.corrente()?.problema;
    return problema ? this.problemI18n.resolve(problema).title : null;
  });

  /** "Busquei e não achei": a Geo respondeu para este termo com lista vazia. */
  readonly semResultado = computed(() => {
    const resposta = this.corrente();
    return resposta !== null && resposta.problema === null && resposta.opcoes.length === 0;
  });

  constructor() {
    const digitados = toObservable(this.termo).pipe(
      map((termo) => termo.trim()),
      debounceTime(ATRASO_DA_BUSCA_EM_MS),
      distinctUntilChanged(),
    );
    // A repetição passa por fora do `distinctUntilChanged`, que barraria o termo igual.
    merge(digitados, this.repeticoes.pipe(map(() => this.termo().trim())))
      .pipe(
        switchMap((busca) => this.consultar(busca)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((emissao) => this.registrar(emissao));
    effect(() => {
      const problema = this.corrente()?.problema;
      if (problema && problema.status >= 500) {
        untracked(() => this.notifications.errorFromProblem(problema));
      }
    });
  }

  /** Repete a busca do termo corrente, que o `distinctUntilChanged` do campo não deixaria passar. */
  tentarNovamente(): void {
    this.repeticoes.next();
  }

  /** Descarta termo, opções e falha, inclusive o resíduo de uma resposta que chegaria tarde. */
  reiniciar(): void {
    this.termo.set('');
    this.ultima.set(null);
  }

  private consultar(busca: string) {
    if (busca.length < MINIMO_DE_LETRAS) {
      this.buscando.set(false);
      return of<Emissao | null>(null);
    }
    this.buscando.set(true);
    return this.geo
      .listarCidades({ q: busca, limit: LIMITE_DE_CIDADES })
      .pipe(map((resultado): Emissao | null => ({ busca, resultado })));
  }

  private registrar(emissao: Emissao | null): void {
    if (emissao === null) {
      this.ultima.set(null);
      return;
    }
    const { busca, resultado } = emissao;
    this.buscando.set(false);
    this.ultima.set(
      resultado.ok
        ? { termo: busca, opcoes: resultado.data, problema: null }
        : { termo: busca, opcoes: [], problema: resultado.problem },
    );
  }
}

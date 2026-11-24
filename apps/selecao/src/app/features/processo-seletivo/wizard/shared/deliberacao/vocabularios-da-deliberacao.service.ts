import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, map } from 'rxjs';
import type { ApiResult } from '@uniplus/shared-core/http';
import { VocabulariosDaDeliberacaoApi } from '@uniplus/shared-data/selecao';
import type {
  ModoDeDeliberacaoDto,
  CriterioDeVotacaoDto,
  DesempateDaVotacaoDto,
  EncerramentoDaVotacaoDto,
  ResultadoSemUnanimidadeDto,
} from '@uniplus/shared-data/selecao';

export interface VocabulariosDaDeliberacao {
  readonly modos: readonly ModoDeDeliberacaoDto[];
  readonly criterios: readonly CriterioDeVotacaoDto[];
  readonly desempates: readonly DesempateDaVotacaoDto[];
  readonly encerramentos: readonly EncerramentoDaVotacaoDto[];
  readonly resultados: readonly ResultadoSemUnanimidadeDto[];
}

function dados<T>(resultado: ApiResult<T>): T {
  if (!resultado.ok) throw new Error('Falha ao carregar vocabulário');
  return resultado.data;
}

@Injectable({ providedIn: 'root' })
export class VocabulariosDaDeliberacaoService {
  private readonly api = inject(VocabulariosDaDeliberacaoApi);
  readonly opcoes = signal<VocabulariosDaDeliberacao | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal(false);

  constructor() {
    this.carregar();
  }

  private carregar(): void {
    forkJoin({
      modos: this.api.listarModosDeDeliberacao().pipe(map(dados)),
      criterios: this.api.listarCriteriosDeVotacao().pipe(map(dados)),
      desempates: this.api.listarDesempatesDaVotacao().pipe(map(dados)),
      encerramentos: this.api.listarEncerramentosDaVotacao().pipe(map(dados)),
      resultados: this.api.listarResultadosSemUnanimidade().pipe(map(dados)),
    }).subscribe({ next: (opcoes) => this.receber(opcoes), error: () => this.falhar() });
  }

  private receber(opcoes: VocabulariosDaDeliberacao): void {
    this.opcoes.set(opcoes);
    this.carregando.set(false);
  }

  private falhar(): void {
    this.erro.set(true);
    this.carregando.set(false);
  }
}

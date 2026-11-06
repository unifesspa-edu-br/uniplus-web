import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { API_MAX_PAGE_SIZE, lookupCompleto } from '@uniplus/shared-core/http';
import { CODIGOS_FASE_CANONICA, FasesCanonicasApi } from '@uniplus/shared-data/configuracao';

export interface OpcaoDeFase {
  readonly codigo: string;
  readonly rotulo: string;
}

/**
 * Nomes das fases canônicas cadastradas, por código. Só enriquece a apresentação: o domínio
 * fechado das opções é o roster canônico, que o servidor valida contra o catálogo da API, e não
 * contra este cadastro.
 */
@Injectable()
export class FasesDoGrafoStore {
  private readonly api = inject(FasesCanonicasApi);
  private readonly fases = lookupCompleto(
    (cursor) => this.api.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    inject(DestroyRef),
  );
  readonly nomes = computed(
    () => new Map(this.fases.opcoes().map((fase) => [fase.codigo, fase.nome])),
  );

  /** Sinalizada à parte da lista principal: sem os nomes, as opções ainda aparecem, só pelo código. */
  readonly falhou = this.fases.comErro;
  /** Enquanto os nomes carregam, as opções aparecem só pelo código, sem afirmar que a fase não existe. */
  readonly pendente = this.fases.pendente;

  private readonly houveFalha = signal(false);
  /** O aviso de falha fica na tela durante a nova tentativa, para o botão que a pediu não sumir. */
  readonly avisoDeFalha = computed(() => this.falhou() || (this.pendente() && this.houveFalha()));

  /**
   * O roster canônico completo, porque é contra ele que o servidor valida. Fase ainda não
   * cadastrada continua selecionável e é marcada como tal: restringir ao cadastro faria a tela
   * recusar arestas que a API aceita, e o seed da API cria arestas antes de as fases existirem.
   */
  readonly opcoes = computed<readonly OpcaoDeFase[]>(() =>
    CODIGOS_FASE_CANONICA.map((codigo) => {
      const nome = this.nomes().get(codigo);
      if (nome !== undefined) return { codigo, rotulo: `${codigo} — ${nome}` };
      const semNomes = this.pendente() || this.falhou();
      return { codigo, rotulo: semNomes ? codigo : `${codigo} — (não cadastrada)` };
    }),
  );

  constructor() {
    effect(() => {
      if (this.falhou()) this.houveFalha.set(true);
      else if (!this.pendente()) this.houveFalha.set(false);
    });
    this.fases.recarregar();
  }

  recarregar(): void {
    if (!this.pendente()) this.fases.recarregar();
  }

  nomeDaFase(codigo: string): string {
    return this.nomes().get(codigo) ?? '';
  }
}

import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, map } from 'rxjs';
import { coletarPaginas } from '@uniplus/shared-core/http';
import { RegraCatalogoDto, RegrasCatalogoApi } from '@uniplus/shared-data/selecao';

import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

const TIPO_REGRA_CONTAGEM = 'algoritmo_contagem_prazo';
const TIPO_REGRA_CONSOLIDACAO = 'regra_consolidacao';
const TIPO_REGRA_RECURSO = 'regra_prazo_recurso';

/**
 * As regras versionadas do `rol_de_regras` que o cronograma referencia: a de recurso de uma fase,
 * o algoritmo de contagem de prazo da convenção e a consolidação das notas de uma etapa de
 * avaliação humana.
 */
@Injectable()
export class CatalogoDeRegras {
  private readonly regrasApi = inject(RegrasCatalogoApi);

  readonly regrasRecurso = signal<readonly RegraCatalogoDto[]>([]);
  readonly regrasContagem = signal<readonly RegraCatalogoDto[]>([]);
  readonly regrasConsolidacao = signal<readonly RegraCatalogoDto[]>([]);

  private readonly leitura = new LeituraDeCatalogo({
    buscar: () =>
      forkJoin({
        recurso: this.regrasDoTipo(TIPO_REGRA_RECURSO),
        contagem: this.regrasDoTipo(TIPO_REGRA_CONTAGEM),
        consolidacao: this.regrasDoTipo(TIPO_REGRA_CONSOLIDACAO),
      }).pipe(
        map(({ recurso, contagem, consolidacao }) =>
          recurso && contagem && consolidacao ? { recurso, contagem, consolidacao } : null,
        ),
      ),
    aplicar: (dados) => {
      this.regrasRecurso.set(dados.recurso);
      this.regrasContagem.set(dados.contagem);
      this.regrasConsolidacao.set(dados.consolidacao);
    },
    mensagemDeErro: 'Não foi possível carregar as regras. Tente novamente.',
  });

  readonly carregando = this.leitura.carregando;
  readonly erro = this.leitura.erro;

  carregar(): void {
    this.leitura.carregar();
  }

  /** Busca de novo, descartando a resposta de uma busca anterior ainda em voo. */
  recarregar(): void {
    this.leitura.recarregar();
  }

  private regrasDoTipo(tipo: string) {
    return coletarPaginas((cursor) => this.regrasApi.listar({ tipo, cursor })).pipe(
      map(dadosOuNulo),
    );
  }
}

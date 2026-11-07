import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, map } from 'rxjs';
import { coletarPaginas } from '@uniplus/shared-core/http';
import {
  FaseCanonicaDto,
  FasesCanonicasApi,
  PrecedenciaFaseDto,
  PrecedenciasFaseApi,
} from '@uniplus/shared-data/configuracao';

import { ordemSugeridaDasFases } from '../ordem-sugerida-das-fases';
import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

/**
 * As fases canônicas e as precedências entre elas, cadastro de Configuração. Carrega tudo por
 * cursor até o fim, porque a ordem sugerida só se calcula com todas as fases e todas as
 * precedências.
 */
@Injectable()
export class CatalogoDeFases {
  private readonly fasesApi = inject(FasesCanonicasApi);
  private readonly precedenciasApi = inject(PrecedenciasFaseApi);

  readonly fases = signal<readonly FaseCanonicaDto[]>([]);
  readonly precedencias = signal<readonly PrecedenciaFaseDto[]>([]);

  /** Fase canônica por id — o que a linha do tempo lê para saber o que exigir. */
  readonly fasePorId = computed<ReadonlyMap<string, FaseCanonicaDto>>(
    () => new Map(this.fases().map((fase) => [fase.id, fase])),
  );

  /**
   * O nome da fase canônica pelo código — o que nomeia também a fase que o cronograma ainda não
   * tem. Sem o catálogo carregado, o próprio código.
   */
  readonly nomeDaFase = computed<(codigo: string) => string>(() => {
    const nomePorCodigo = new Map(this.fases().map((fase) => [fase.codigo, fase.nome]));
    return (codigo) => nomePorCodigo.get(codigo) ?? codigo;
  });

  /** Fases em ordem cronológica sugerida pelas precedências cadastradas. */
  readonly fasesEmOrdemSugerida = computed<readonly FaseCanonicaDto[]>(() =>
    ordemSugeridaDasFases(this.fases(), this.precedencias()),
  );

  private readonly leitura = new LeituraDeCatalogo({
    buscar: () =>
      forkJoin({
        fases: coletarPaginas((cursor) => this.fasesApi.listar({ cursor })),
        precedencias: coletarPaginas((cursor) => this.precedenciasApi.listar({ cursor })),
      }).pipe(
        map(({ fases, precedencias }) => {
          const fasesLidas = dadosOuNulo(fases);
          const precedenciasLidas = dadosOuNulo(precedencias);
          return fasesLidas && precedenciasLidas
            ? { fases: fasesLidas, precedencias: precedenciasLidas }
            : null;
        }),
      ),
    aplicar: (dados) => {
      this.fases.set(dados.fases);
      this.precedencias.set(dados.precedencias);
    },
    mensagemDeErro: 'Não foi possível carregar as fases.',
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
}

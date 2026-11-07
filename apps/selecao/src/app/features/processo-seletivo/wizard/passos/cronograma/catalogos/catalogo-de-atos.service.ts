import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { coletarPaginas } from '@uniplus/shared-core/http';
import { TipoAtoPublicadoDto, TiposAtoApi } from '@uniplus/shared-data/publicacoes';

import { hojeNoFusoInstitucional } from '../../../shared/fuso-institucional';
import { vigenteNoDia } from '../../../shared/vigencia';
import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

/**
 * Os tipos de ato publicado, do módulo Publicações, com a série completa de vigências: o servidor
 * assume `vigentes: true`, e só a série completa resolve o rótulo de um ato já referenciado cuja
 * versão encerrou. Quais podem ser escolhidos é recorte da tela, em `atosVigentes`.
 *
 * O dia da conferência de vigência é um signal fixado no carregamento, e não a leitura do relógio
 * dentro do `computed`, que só reage às fontes que lê: a lista ficaria congelada na data da
 * primeira avaliação. Amarrar ao carregamento mantém a data e os dados do mesmo instante.
 */
@Injectable()
export class CatalogoDeAtos {
  private readonly atosApi = inject(TiposAtoApi);

  readonly atos = signal<readonly TipoAtoPublicadoDto[]>([]);

  private readonly diaDeReferencia = signal(hojeNoFusoInstitucional());

  /**
   * Atos que podem ser escolhidos hoje. A vigência é semiaberta — `[início,
   * fim)` —, e é ela que o servidor confere ao resolver o ato declarado: um
   * código fora de vigência é recusado na gravação.
   *
   * "Hoje" é o dia no fuso institucional, não em UTC: à noite em Belém a data
   * UTC já é a de amanhã, e conferir por ela ofereceria um ato horas antes de
   * ele valer — para o servidor recusá-lo em seguida.
   */
  readonly atosVigentes = computed(() => {
    const hoje = this.diaDeReferencia();
    return this.atos().filter((ato) => vigenteNoDia(ato, hoje));
  });

  /** Rótulo de um ato, vigente ou não — um cronograma gravado precisa de nome. */
  readonly rotuloDoAto = computed<ReadonlyMap<string, string>>(
    () => new Map(this.atos().map((ato) => [ato.codigo, ato.nome])),
  );

  /**
   * O ato pelo código, vigente ou não. É por aqui que a tela sabe se um ato é
   * resultado — só ato que é resultado admite papel preliminar ou definitivo — e
   * a série completa importa: um ato já declarado cuja versão encerrou continua
   * descrevendo o que a fase publica.
   */
  readonly atoPorCodigo = computed<ReadonlyMap<string, TipoAtoPublicadoDto>>(
    () => new Map(this.atos().map((ato) => [ato.codigo, ato])),
  );

  private readonly leitura = new LeituraDeCatalogo({
    buscar: () =>
      coletarPaginas((cursor) => this.atosApi.listar({ cursor, vigentes: false })).pipe(
        map(dadosOuNulo),
      ),
    aplicar: (dados) => {
      this.diaDeReferencia.set(hojeNoFusoInstitucional());
      this.atos.set(dados);
    },
    mensagemDeErro: 'Não foi possível carregar os atos publicados.',
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

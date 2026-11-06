import { signal } from '@angular/core';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import type { FatoCandidatoDto, RegrasPadraoInput } from '@uniplus/shared-data/configuracao';
import {
  deClausulasDoWire,
  paraClausulasDoWire,
  problemaDaCondicao,
  type CondicaoEmClausula,
  type FatoEscolhivel,
} from '@uniplus/shared-ui/components';
import { indiceDaRegra } from './fato-candidato.regras';

/** Uma regra padrão em edição: o valor que contribui (nulo no booleano) e o predicado na forma do editor. */
export interface RegraEmEdicao {
  readonly contribui: string | null;
  readonly condicoes: readonly CondicaoEmClausula[];
}

type FatoPorCodigo = ReadonlyMap<string, FatoEscolhivel>;

type ErrosDasCondicoes = Readonly<Partial<Record<number, Readonly<Record<number, string>>>>>;

/**
 * As regras padrão do derivado enquanto a pessoa as monta: a lista, as marcas de erro de cada regra
 * e a conferência local antes do envio. Não grava nada; quem grava é a edição do fato.
 */
export class RegrasEmEdicao {
  readonly regras = signal<readonly RegraEmEdicao[]>([]);
  readonly errosDasRegras = signal<Readonly<Record<number, string>>>({});
  /** As regras sem o valor que acrescentam: o select delas é o controle inválido. */
  readonly contribuicoesFaltando = signal<ReadonlySet<number>>(new Set());
  /** O problema de cada condição, por regra, para o editor marcar a condição certa. */
  readonly errosDasCondicoes = signal<ErrosDasCondicoes>({});

  /** Copia as regras do servidor e apaga as marcas: elas valiam para a lista anterior. */
  copiarDe(fato: FatoCandidatoDto): void {
    this.regras.set(
      fato.regrasPadrao.map((regra) => ({
        contribui: regra.contribui,
        condicoes: deClausulasDoWire(regra.quando),
      })),
    );
    this.limparMarcas();
  }

  acrescentar(dominio: string): void {
    const contribui = dominio === 'CATEGORICO' ? '' : null;
    this.regras.update((regras) => [...regras, { contribui, condicoes: [] }]);
  }

  remover(indice: number): void {
    this.regras.update((regras) => regras.filter((_, posicao) => posicao !== indice));
    this.limparMarcas();
  }

  trocarContribuicao(indice: number, contribui: string): void {
    this.alterar(indice, { contribui });
  }

  trocarCondicoes(indice: number, condicoes: readonly CondicaoEmClausula[]): void {
    this.alterar(indice, { condicoes });
  }

  /**
   * Confere as regras na tela e marca as que não podem ir; diz se podem ir. O fato já citado que
   * o editor não oferece (fonte de valores do processo) é conferido pela API.
   */
  conferir(fatosPorCodigo: FatoPorCodigo, jaCitados: ReadonlySet<string>): boolean {
    const problemas: Record<number, string> = {};
    const faltando = new Set<number>();
    const condicoes: Record<number, Record<number, string>> = {};
    const conferidosPelaApi = new Set(
      [...jaCitados].filter((codigo) => !fatosPorCodigo.has(codigo)),
    );
    this.regras().forEach((regra, indice) => {
      if (regra.condicoes.length === 0) {
        problemas[indice] = 'Declare ao menos uma condição.';
      } else if (regra.contribui === '') {
        problemas[indice] = 'Escolha o valor que a regra acrescenta.';
        faltando.add(indice);
      } else {
        const porCondicao = problemasDasCondicoes(regra, fatosPorCodigo, conferidosPelaApi);
        if (Object.keys(porCondicao).length === 0) return;
        problemas[indice] = 'Há condição incompleta: corrija a condição marcada.';
        condicoes[indice] = porCondicao;
      }
    });
    this.errosDasRegras.set(problemas);
    this.contribuicoesFaltando.set(faltando);
    this.errosDasCondicoes.set(condicoes);
    return Object.keys(problemas).length === 0;
  }

  corpo(): RegrasPadraoInput {
    return {
      regras: this.regras().map((regra) => ({
        contribui: regra.contribui,
        quando: paraClausulasDoWire(regra.condicoes),
      })),
    };
  }

  /** Põe cada recusa de regra junto da regra; diz se alguma coube. */
  aplicarRecusa(problem: ProblemDetails): boolean {
    const porRegra: Record<number, string> = {};
    for (const erro of problem.errors ?? []) {
      const indice = indiceDaRegra(erro.field);
      if (indice !== null) porRegra[indice] = erro.message;
    }
    this.errosDasRegras.set(porRegra);
    return Object.keys(porRegra).length > 0;
  }

  private limparMarcas(): void {
    this.errosDasRegras.set({});
    this.contribuicoesFaltando.set(new Set());
    this.errosDasCondicoes.set({});
  }

  private alterar(indice: number, mudanca: Partial<RegraEmEdicao>): void {
    this.regras.update((regras) =>
      regras.map((regra, posicao) => (posicao === indice ? { ...regra, ...mudanca } : regra)),
    );
    this.esquecerErrosDaRegra(indice);
  }

  /**
   * Os erros de uma regra valem para as posições que ela tinha ao salvar: editada, a regra
   * reposiciona as condições, e o erro marcaria o controle errado. A conferência volta no
   * próximo "Salvar regras".
   */
  private esquecerErrosDaRegra(indice: number): void {
    this.errosDasRegras.update(({ [indice]: _, ...resto }) => resto);
    this.errosDasCondicoes.update(({ [indice]: _, ...resto }) => resto);
    this.contribuicoesFaltando.update(
      (faltando) => new Set([...faltando].filter((posicao) => posicao !== indice)),
    );
  }
}

function problemasDasCondicoes(
  regra: RegraEmEdicao,
  fatosPorCodigo: FatoPorCodigo,
  conferidosPelaApi: ReadonlySet<string>,
): Record<number, string> {
  const porCondicao: Record<number, string> = {};
  regra.condicoes.forEach((condicao, posicao) => {
    if (conferidosPelaApi.has(condicao.fato)) return;
    const problema = problemaDaCondicao(condicao, fatosPorCodigo);
    if (problema !== null) porCondicao[posicao] = problema;
  });
  return porCondicao;
}

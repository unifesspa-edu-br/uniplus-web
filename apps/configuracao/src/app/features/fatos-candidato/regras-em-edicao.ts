import { signal } from '@angular/core';
import { ProblemDetails, separarCausas } from '@uniplus/shared-core/http';
import {
  OperadorCodigo,
  TipoDoDadoCodigo,
  TipoDeCampoCodigo,
  type FatoCandidatoDto,
  type RegrasPadraoInput,
} from '@uniplus/shared-data/configuracao';
import { codigosDoContrato } from '@uniplus/shared-data/utils';
import {
  deClausulasDoWire,
  paraClausulasDoWire,
  predicadoComOperadores,
  problemaDaCondicao,
  type CondicaoEmClausula,
  type FatoEscolhivel,
} from '@uniplus/shared-inscricao/formulario';
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
    const contribui = dominio === TipoDoDadoCodigo.OPCAO ? '' : null;
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
    const problemas = Object.entries(conferirRegras(this.regras(), fatosPorCodigo, jaCitados));
    this.errosDasRegras.set(Object.fromEntries(problemas.map(([i, p]) => [i, p.mensagem])));
    this.contribuicoesFaltando.set(contribuicoesSemValor(problemas));
    this.errosDasCondicoes.set(Object.fromEntries(condicoesComProblema(problemas)));
    return problemas.length === 0;
  }

  corpo(): RegrasPadraoInput {
    return {
      regras: this.regras().map((regra) => ({
        contribui: regra.contribui,
        quando: predicadoComOperadores(
          paraClausulasDoWire(regra.condicoes),
          codigosDoContrato(OperadorCodigo, TipoDeCampoCodigo).operador,
        ),
      })),
    };
  }

  /** Põe cada recusa de regra junto da regra; diz se alguma coube. */
  aplicarRecusa(problem: ProblemDetails): boolean {
    const porRegra: Record<number, string> = {};
    for (const erro of separarCausas(problem.errors).deCampo) {
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

interface ProblemaDaRegra {
  readonly mensagem: string;
  readonly contribuicaoFaltando: boolean;
  readonly porCondicao: Record<number, string> | null;
}

const SEM_CONDICAO: ProblemaDaRegra = {
  mensagem: 'Declare ao menos uma condição.',
  contribuicaoFaltando: false,
  porCondicao: null,
};

const SEM_CONTRIBUICAO: ProblemaDaRegra = {
  mensagem: 'Escolha o valor que a regra acrescenta.',
  contribuicaoFaltando: true,
  porCondicao: null,
};

const MENSAGEM_INCOMPLETA = 'Há condição incompleta: corrija a condição marcada.';

function problemaDaRegra(
  regra: RegraEmEdicao,
  fatosPorCodigo: FatoPorCodigo,
  conferidosPelaApi: ReadonlySet<string>,
): ProblemaDaRegra | null {
  if (regra.condicoes.length === 0) return SEM_CONDICAO;
  if (regra.contribui === '') return SEM_CONTRIBUICAO;
  const porCondicao = problemasDasCondicoes(regra, fatosPorCodigo, conferidosPelaApi);
  if (Object.keys(porCondicao).length === 0) return null;
  return { mensagem: MENSAGEM_INCOMPLETA, contribuicaoFaltando: false, porCondicao };
}

type ProblemasPorRegra = Readonly<Record<number, ProblemaDaRegra>>;

function conferirRegras(
  regras: readonly RegraEmEdicao[],
  fatosPorCodigo: FatoPorCodigo,
  jaCitados: ReadonlySet<string>,
): ProblemasPorRegra {
  const conferidosPelaApi = new Set([...jaCitados].filter((codigo) => !fatosPorCodigo.has(codigo)));
  const problemas: Record<number, ProblemaDaRegra> = {};
  regras.forEach((regra, indice) => {
    const problema = problemaDaRegra(regra, fatosPorCodigo, conferidosPelaApi);
    if (problema !== null) problemas[indice] = problema;
  });
  return problemas;
}

type ProblemaIndexado = readonly [string, ProblemaDaRegra];

function contribuicoesSemValor(problemas: readonly ProblemaIndexado[]): ReadonlySet<number> {
  return new Set(
    problemas.filter(([, p]) => p.contribuicaoFaltando).map(([indice]) => Number(indice)),
  );
}

function condicoesComProblema(
  problemas: readonly ProblemaIndexado[],
): [string, Record<number, string>][] {
  return problemas.flatMap(([indice, p]) =>
    p.porCondicao === null ? [] : [[indice, p.porCondicao]],
  );
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

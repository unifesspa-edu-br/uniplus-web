import type { DefinicaoAgregado, DefinicaoDerivacao } from './definicao-do-formulario';
import { lerPredicado } from './leitura-do-predicado';
import { booleano, codigo, lista, Recusa } from './leitura-dos-valores';
import { fatosCitadosPor, type Predicado } from './predicado';
import type {
  AgregadoDasRegras,
  DerivacaoDasRegras,
  RegraDeDerivacaoDasRegras,
} from './regras-do-formulario';

type RegraDaDerivacao = DefinicaoDerivacao['regras'][number];

export function lerDerivacao(derivacao: DerivacaoDasRegras, caminho: string): DefinicaoDerivacao {
  const fatoCodigo = codigo(derivacao.fatoCodigo, `${caminho}.fatoCodigo`).trim();
  const ehBooleano = booleano(derivacao.booleano, `${caminho}.booleano`);
  const regras = lista(derivacao.regras, `${caminho}.regras`, (regra, daRegra) =>
    lerRegraDeDerivacao(regra, daRegra, fatoCodigo, ehBooleano),
  );
  const dependencias = dependenciasDaDerivacao(regras, fatoCodigo, caminho);
  return { fatoCodigo, booleano: ehBooleano, regras, dependencias };
}

function dependenciasDaDerivacao(
  regras: readonly RegraDaDerivacao[],
  fatoCodigo: string,
  caminho: string,
): string[] {
  if (regras.length === 0)
    throw new Recusa(
      `${caminho}.regras`,
      `A derivação de '${fatoCodigo}' precisa de ao menos uma regra.`,
    );
  const dependencias = [...new Set(regras.flatMap((r) => fatosCitadosPor(r.quando)))];
  if (dependencias.includes(fatoCodigo)) throw new Recusa(caminho, citaOProprioFato(fatoCodigo));
  return dependencias;
}

function citaOProprioFato(fatoCodigo: string): string {
  return `A derivação de '${fatoCodigo}' cita o próprio fato — um derivado não pode depender de si mesmo.`;
}

function lerRegraDeDerivacao(
  regra: RegraDeDerivacaoDasRegras,
  caminho: string,
  fatoCodigo: string,
  ehBooleano: boolean,
): RegraDaDerivacao {
  const quando = lerQuandoDaRegra(regra, caminho, fatoCodigo);
  return { quando, contribui: ehBooleano ? null : lerContribuicao(regra, caminho) };
}

function lerQuandoDaRegra(
  regra: RegraDeDerivacaoDasRegras,
  caminho: string,
  fatoCodigo: string,
): Predicado {
  if (regra.quando === null || regra.quando === undefined) {
    throw new Recusa(
      `${caminho}.quando`,
      `Uma regra de '${fatoCodigo}' não diz quando ativa; a regra sempre ativa tem a lista vazia.`,
    );
  }
  return lerPredicado(regra.quando, `${caminho}.quando`) as Predicado;
}

function lerContribuicao(regra: RegraDeDerivacaoDasRegras, caminho: string): string {
  const contribui = typeof regra.contribui === 'string' ? regra.contribui.trim() : '';
  if (contribui === '')
    throw new Recusa(
      `${caminho}.contribui`,
      'Uma regra de derivação precisa contribuir um código de valor do domínio do fato.',
    );
  return contribui;
}

export function lerAgregado(agregado: AgregadoDasRegras, caminho: string): DefinicaoAgregado {
  const codigoDoAgregado = codigo(agregado.codigo, `${caminho}.codigo`);
  if (agregado.operacao !== 'EXISTE' && agregado.operacao !== 'VALORES_PRESENTES') {
    throw new Recusa(
      `${caminho}.operacao`,
      `A operação do agregado '${codigoDoAgregado}' é EXISTE ou VALORES_PRESENTES.`,
    );
  }
  return {
    codigo: codigoDoAgregado,
    grupoCodigo: codigo(agregado.grupoCodigo, `${caminho}.grupoCodigo`),
    fatoDeMembro: codigo(agregado.fatoDeMembro, `${caminho}.fatoDeMembro`),
    operacao: agregado.operacao,
  };
}

import { RegraCatalogoDto } from '@uniplus/shared-data/selecao';

/**
 * Um parâmetro declarado no `esquemaArgs` da regra.
 *
 * O esquema é aberto por contrato — cada regra descreve o que precisa —, então
 * a tela não traduz as chaves: exibe o token como o catálogo o nomeia e o
 * valor ao lado. Inventar rótulo em português criaria um vocabulário paralelo
 * ao que a regra publica, e a divergência apareceria na primeira regra nova.
 */
export interface ParametroDaRegra {
  readonly chave: string;
  readonly valores: readonly string[];
}

/** O que a regra estabelece, na forma que a tela apresenta. */
export interface RegraExplicada {
  readonly codigo: string;
  readonly versao: string;
  readonly baseLegal: string;
  readonly invariantes: readonly string[];
  readonly parametros: readonly ParametroDaRegra[];
}

export function explicarRegra(regra: RegraCatalogoDto | undefined): RegraExplicada | null {
  if (regra === undefined) return null;

  return {
    codigo: regra.codigo,
    versao: regra.versao,
    baseLegal: regra.baseLegal,
    invariantes: comoTextos(regra.invariantes),
    parametros: comoParametros(regra.esquemaArgs),
  };
}

/**
 * `invariantes` chega como `JsonElement`: hoje é uma lista de frases, mas o
 * contrato não garante forma. O que não for texto é omitido em vez de virar
 * `[object Object]` na tela.
 */
function comoTextos(valor: unknown): readonly string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is string => typeof item === 'string');
}

/**
 * O rol admitido já aparece como o próprio conjunto de checkboxes da seção de
 * modalidades — repeti-lo aqui como prosa crua não acrescenta informação, só
 * ruído.
 */
const CHAVE_DO_ROL = 'modalidades_admitidas';

function comoParametros(esquemaArgs: unknown): readonly ParametroDaRegra[] {
  if (typeof esquemaArgs !== 'object' || esquemaArgs === null || Array.isArray(esquemaArgs)) {
    return [];
  }

  return Object.entries(esquemaArgs)
    .filter(([chave]) => chave !== CHAVE_DO_ROL)
    .map(([chave, valor]) => ({
      chave,
      valores: comoValores(valor),
    }));
}

function comoValores(valor: unknown): readonly string[] {
  if (typeof valor === 'string') return [valor];
  if (typeof valor === 'number' || typeof valor === 'boolean') return [String(valor)];
  if (Array.isArray(valor)) return valor.map((item) => String(item));
  return [];
}

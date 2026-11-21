import type { Obrigatoriedade } from './definicao-do-formulario';
import { lista, ehObjeto, Recusa } from './leitura-dos-valores';
import { type Condicao, comparaComLista, ehOperador, type Predicado } from './predicado';
import type {
  CondicaoDasRegras,
  ExibicaoEObrigatoriedadeDasRegras,
  ImpedimentoDasRegras,
  ObrigatoriedadeDasRegras,
  PredicadoDasRegras,
  ValorJson,
} from './regras-do-formulario';

/** O predicado da exibição e da obrigatoriedade: nulo é sem condição; a lista vazia, o predicado sem cláusula. */
export function lerPredicado(clausulas: PredicadoDasRegras, caminho: string): Predicado | null {
  if (clausulas === null || clausulas === undefined) return null;
  if (!Array.isArray(clausulas)) throw new Recusa(caminho, 'O predicado é uma lista de cláusulas.');
  return {
    clausulas: lista(clausulas, caminho, (clausula: readonly CondicaoDasRegras[], daClausula) => {
      if (!Array.isArray(clausula) || clausula.length === 0)
        throw new Recusa(daClausula, 'Uma cláusula deve ter ao menos uma condição.');
      return lista(clausula, daClausula, lerCondicao);
    }),
  };
}

/** O predicado do impedimento e das opções condicionadas: aqui, a lista vazia é ausência de condição. */
export function lerCondicaoQueValeSempreSeVazia(
  clausulas: PredicadoDasRegras,
  caminho: string,
): Predicado | null {
  return Array.isArray(clausulas) && clausulas.length === 0
    ? null
    : lerPredicado(clausulas, caminho);
}

export function lerObrigatoriedade(
  obrigatoriedade: ObrigatoriedadeDasRegras | null | undefined,
  caminho: string,
  dono: string,
): Obrigatoriedade {
  const tipo = obrigatoriedade?.tipo;
  const quando = lerPredicado(obrigatoriedade?.predicado, `${caminho}.obrigatoriedade.predicado`);
  if ((tipo === 'SEMPRE' || tipo === 'NUNCA') && quando === null) return { tipo, predicado: null };
  if (tipo === 'QUANDO' && quando !== null) return { tipo, predicado: quando };
  throw new Recusa(
    `${caminho}.obrigatoriedade`,
    `A obrigatoriedade do ${dono} é SEMPRE ou NUNCA sem predicado, ou QUANDO com ele.`,
  );
}

/** A exibição e a obrigatoriedade de um elemento, lidas das `regras` dele. */
export function lerExibicaoEObrigatoriedade(
  regras: ExibicaoEObrigatoriedadeDasRegras | null | undefined,
  caminho: string,
  dono: string,
): { exibicao: Predicado | null; obrigatoriedade: Obrigatoriedade } {
  if (!ehObjeto(regras)) throw new Recusa(caminho, `As regras do ${dono} são um objeto.`);
  return {
    exibicao: lerPredicado(regras.exibicao, `${caminho}.exibicao`),
    obrigatoriedade: lerObrigatoriedade(regras.obrigatoriedade, caminho, dono),
  };
}

export function lerImpedimento(
  impedimento: ImpedimentoDasRegras | null | undefined,
  caminho: string,
): Predicado | null {
  if (impedimento === null || impedimento === undefined) return null;
  if (!ehObjeto(impedimento)) throw new Recusa(caminho, 'O impedimento é um objeto.');
  const quando = lerCondicaoQueValeSempreSeVazia(impedimento.quando, `${caminho}.quando`);
  if (quando === null)
    throw new Recusa(
      `${caminho}.quando`,
      'O impedimento tem a condição sobre a resposta do campo.',
    );
  return quando;
}

function lerCondicao(condicao: CondicaoDasRegras, caminho: string): Condicao {
  if (typeof condicao.fato !== 'string' || condicao.fato.trim() === '')
    throw new Recusa(`${caminho}.fato`, 'O fato da condição é obrigatório.');
  if (typeof condicao.operador !== 'string' || !ehOperador(condicao.operador)) {
    throw new Recusa(`${caminho}.operador`, 'O operador da condição não é reconhecido.');
  }
  const valor = lerValor(condicao.valor ?? null, condicao.operador, `${caminho}.valor`);
  return { fato: condicao.fato.trim(), operador: condicao.operador, valor };
}

function lerValor(valor: unknown, operador: Condicao['operador'], caminho: string): ValorJson {
  if (!valorCoerenteComOperador(operador, valor)) {
    throw new Recusa(
      caminho,
      comparaComLista(operador)
        ? 'Os operadores EM e NAO_EM exigem uma lista, sem itens de texto em branco.'
        : 'Os operadores IGUAL, DIFERENTE, MAIOR_IGUAL e MENOR_IGUAL exigem um valor simples não branco.',
    );
  }
  return valor as ValorJson;
}

function valorCoerenteComOperador(operador: Condicao['operador'], valor: unknown): boolean {
  const emBranco = (v: unknown): boolean => typeof v === 'string' && v.trim() === '';
  return comparaComLista(operador)
    ? Array.isArray(valor) && !valor.some(emBranco)
    : !Array.isArray(valor) && !ehObjeto(valor) && !emBranco(valor);
}

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import postcss, { type Root, type Rule } from 'postcss';

export function lerFolhaDeEstilo(caminho: string): Root {
  const folha = postcss.parse(readFileSync(caminho, 'utf8'), { from: caminho });
  folha.walkAtRules('import', (importacao) => {
    const parametro = importacao.params.trim();
    const aspas = parametro[0];
    if ((aspas !== "'" && aspas !== '"') || !parametro.endsWith(aspas)) {
      throw new Error(`Importação de folha de estilo não suportada: ${parametro}`);
    }
    const destino = parametro.slice(1, -1);
    if (destino.startsWith('./')) {
      importacao.replaceWith(...lerFolhaDeEstilo(resolve(dirname(caminho), destino)).nodes);
    }
  });
  return folha;
}

function pertenceACondicao(regra: Rule, condicao?: string): boolean {
  const pai = regra.parent;
  return condicao === undefined
    ? pai?.type === 'root'
    : pai?.type === 'atrule' &&
        pai.name === 'media' &&
        pai.params === condicao &&
        pai.parent?.type === 'root';
}

function acrescentarDeclaracoes(regra: Rule, declaracoes: Map<string, string>): void {
  regra.walkDecls((declaracao) => {
    declaracoes.set(
      declaracao.prop,
      declaracao.value + (declaracao.important ? ' !important' : ''),
    );
  });
}

export function declaracoesDaRegra(
  folha: Root,
  seletor: string,
  condicaoDeMidia?: string,
): ReadonlyMap<string, string> {
  const declaracoes = new Map<string, string>();
  folha.walkRules((regra) => {
    if (regra.selectors.includes(seletor) && pertenceACondicao(regra, condicaoDeMidia)) {
      acrescentarDeclaracoes(regra, declaracoes);
    }
  });
  return declaracoes;
}

function valorDaVariavel(folha: Root, nome: string): string {
  let encontrado: string | undefined;
  folha.walkDecls(nome, (declaracao) => {
    encontrado = declaracao.value;
    return false;
  });
  if (encontrado === undefined) throw new Error(`Variável não encontrada: ${nome}`);
  return encontrado;
}

function separarTemas(folha: Root, valor: string): readonly [string, string] {
  const partes = postcss.list.comma(valor.slice(11, -1));
  if (partes.length !== 2) throw new Error(`Valor de tema inválido: ${valor}`);
  return [valoresNosTemas(folha, partes[0])[0], valoresNosTemas(folha, partes[1])[1]];
}

export function valoresNosTemas(
  folha: Root,
  valor: string,
): readonly [claro: string, escuro: string] {
  const atual = valor.trim();
  if (atual.startsWith('var(') && atual.endsWith(')')) {
    return valoresNosTemas(folha, valorDaVariavel(folha, atual.slice(4, -1).trim()));
  }
  if (atual.startsWith('light-dark(') && atual.endsWith(')')) return separarTemas(folha, atual);
  return [atual, atual];
}

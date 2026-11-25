import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

/** Uma edição pura: devolve um documento novo e deixa o recebido como estava. */
export type EdicaoDoDocumento = (documento: DocumentoDaConfiguracao) => DocumentoDaConfiguracao;

export type NomeDaSecao =
  | 'identificacao'
  | 'opcoesDeCurso'
  | 'ordemDeRemanejamento'
  | 'taxaDeInscricao'
  | 'classificacao'
  | 'atendimento'
  | 'cronograma'
  | 'documentosExigidos'
  | 'coleta';

export type SecaoDoDocumento<S extends NomeDaSecao> = NonNullable<DocumentoDaConfiguracao[S]>;

/**
 * Campo não preenchido é campo ausente: `undefined` remove a chave, nunca a grava vazia. O objeto
 * que já está como o valor pede volta como estava, a mesma instância.
 */
export function comCampo<T extends object, K extends keyof T>(
  objeto: T,
  chave: K,
  valor: T[K] | undefined,
): T {
  const jaEstaAssim = valor === undefined ? !(chave in objeto) : objeto[chave] === valor;
  if (jaEstaAssim) return objeto;
  const copia = { ...objeto };
  if (valor === undefined) {
    delete copia[chave];
  } else {
    copia[chave] = valor;
  }
  return copia;
}

/** Campo de escolha fechada: o seletor vazio (`''`) é "ainda não escolhido" e deixa o campo ausente. */
export function comEscolha<T extends object, K extends keyof T>(
  objeto: T,
  chave: K,
  escolha: NonNullable<T[K]> | '',
): T {
  return comCampo(objeto, chave, escolha === '' ? undefined : escolha);
}

/**
 * Campo que o contrato aceita como `null`. O formulário mostra `null` e ausente do mesmo jeito,
 * vazio; por isso o vazio não troca o `null` explícito do documento. O campo que tinha valor e foi
 * esvaziado sai do documento.
 */
export function comCampoNulavel<T extends object, K extends keyof T>(
  objeto: T,
  chave: K,
  valor: T[K] | undefined,
): T {
  return valor === undefined && objeto[chave] === null ? objeto : comCampo(objeto, chave, valor);
}

/**
 * Trocar o código descarta os descritivos que eram do código anterior: a API recalcula-os a partir
 * do novo código, e os antigos ficariam dizendo o que o código já não diz. Repetir o mesmo código
 * não muda nada.
 */
export function comCodigo<T extends object, K extends keyof T>(
  objeto: T,
  chave: K,
  codigo: T[K] | undefined,
  descritivos: readonly (keyof T)[],
): T {
  if (objeto[chave] === codigo) return objeto;
  const comNovoCodigo = comCampo(objeto, chave, codigo);
  return descritivos.reduce(
    (atual, descritivo) => comCampo(atual, descritivo, undefined),
    comNovoCodigo,
  );
}

/**
 * A lista vazia só fica no documento onde ela já estava: lista ausente é "ainda não decidido",
 * lista vazia é "decidido que não há".
 */
export function comLista<T extends object, K extends keyof T>(
  objeto: T,
  chave: K,
  itens: NonNullable<T[K]> & readonly unknown[],
): T {
  const aindaNaoDecidida = itens.length === 0 && objeto[chave] === undefined;
  if (mesmosItens(objeto[chave], itens)) return objeto;
  return comCampo(objeto, chave, aindaNaoDecidida ? undefined : itens);
}

function mesmosItens(atuais: unknown, itens: readonly unknown[]): boolean {
  return (
    Array.isArray(atuais) &&
    atuais.length === itens.length &&
    itens.every((item, posicao) => item === atuais[posicao])
  );
}

/** Seções em que todo campo é opcional: `{}` é uma seção válida, ainda sem nada preenchido. */
const SECAO_SEM_CAMPOS: { readonly [S in NomeDaSecao]: SecaoDoDocumento<S> } = {
  identificacao: {},
  opcoesDeCurso: {},
  ordemDeRemanejamento: {},
  taxaDeInscricao: {},
  classificacao: {},
  atendimento: {},
  cronograma: {},
  documentosExigidos: {},
  coleta: {},
};

/** Edita a seção; quando ela não existe, a edição parte de uma seção sem campos. */
export function naSecao<S extends NomeDaSecao>(
  documento: DocumentoDaConfiguracao,
  nome: S,
  alterar: (atual: SecaoDoDocumento<S>) => SecaoDoDocumento<S>,
): DocumentoDaConfiguracao {
  return comSecao(documento, nome, alterar(documento[nome] ?? SECAO_SEM_CAMPOS[nome]));
}

/**
 * Troca a seção do documento. Uma seção que não existia só nasce quando algum campo foi
 * preenchido: editar sem preencher nada não transforma "ausente" em "vazia".
 */
export function comSecao<S extends NomeDaSecao>(
  documento: DocumentoDaConfiguracao,
  nome: S,
  nova: SecaoDoDocumento<S>,
): DocumentoDaConfiguracao {
  const continuaAusente = documento[nome] === undefined && Object.keys(nova).length === 0;
  return continuaAusente || documento[nome] === nova ? documento : { ...documento, [nome]: nova };
}

/** Aplica as edições na ordem em que foram dadas; cada uma recebe o documento da anterior. */
export function emSequencia(...edicoes: readonly EdicaoDoDocumento[]): EdicaoDoDocumento {
  return (documento) => edicoes.reduce((atual, edicao) => edicao(atual), documento);
}

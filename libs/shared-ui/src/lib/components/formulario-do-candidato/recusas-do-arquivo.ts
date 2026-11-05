/** O primeiro problema de um arquivo importado: onde está e o que há de errado. */
export interface RecusaDoArquivo {
  readonly caminho: string;
  readonly mensagem: string;
}

type Validacao = (valor: unknown) => boolean;
type Forma = Readonly<Record<string, Validacao>>;
type Objeto = Record<string, unknown>;

export function ehObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

const texto: Validacao = (v) => typeof v === 'string';
const lista: Validacao = (v) => Array.isArray(v);
// O inteiro do contrato vem como número ou, como a API também o lê, como número escrito em texto.
const numero: Validacao = (v) =>
  typeof v === 'number' || (typeof v === 'string' && /^-?[0-9]+$/.test(v));
const opcional =
  (conferir: Validacao): Validacao =>
  (v) =>
    v === null || v === undefined || conferir(v);

const VALOR: Forma = { codigo: texto, ordem: numero, descricao: opcional(texto) };
const CAMPO: Forma = {
  fatoCodigo: texto,
  ordem: numero,
  rotulo: texto,
  tipoRenderizacao: texto,
  valoresSelecionaveis: opcional(lista),
};
const PRESSUPOSTO: Forma = {
  fatoCodigo: texto,
  rotulo: opcional(texto),
  tipoRenderizacao: opcional(texto),
  formato: opcional(texto),
  calculadoDe: opcional((v) => Array.isArray(v) && v.every(texto)),
  valoresSelecionaveis: opcional(lista),
};
const LISTAS_DO_FORMULARIO: Readonly<Record<string, Forma>> = {
  etapas: {
    codigo: texto,
    ordem: numero,
    tipo: texto,
    titulo: texto,
    codigoNasRegras: opcional(texto),
  },
  fatosColetados: CAMPO,
  grupos: { codigo: texto, ordem: numero, rotulo: texto, minimo: numero, subitens: lista },
  termos: { codigo: texto, codigoNasRegras: texto, ordem: numero, nome: texto, texto: texto },
};

/** Cada elemento da lista é um objeto com as propriedades da forma. */
function conferirLista(lista: unknown, caminho: string, forma: Forma): RecusaDoArquivo | null {
  if (!Array.isArray(lista)) return { caminho, mensagem: 'O formulário traz esta lista.' };
  for (const [i, elemento] of lista.entries()) {
    if (!ehObjeto(elemento))
      return { caminho: `${caminho}[${i}]`, mensagem: 'O elemento é um objeto.' };
    const errada = Object.entries(forma).find(
      ([propriedade, valida]) => !valida(elemento[propriedade]),
    );
    if (errada) {
      return {
        caminho: `${caminho}[${i}].${errada[0]}`,
        mensagem: 'A propriedade falta ou tem outra forma.',
      };
    }
  }
  return null;
}

function conferirValoresDosCampos(campos: Objeto[], caminho: string): RecusaDoArquivo | null {
  for (const [i, item] of campos.entries()) {
    const recusa = conferirLista(
      item['valoresSelecionaveis'] ?? [],
      `${caminho}[${i}].valoresSelecionaveis`,
      VALOR,
    );
    if (recusa) return recusa;
  }
  return null;
}

function conferirGrupos(grupos: Objeto[]): RecusaDoArquivo | null {
  for (const [i, grupo] of grupos.entries()) {
    const caminho = `grupos[${i}].subitens`;
    const recusa =
      conferirLista(grupo['subitens'], caminho, CAMPO) ??
      conferirValoresDosCampos(grupo['subitens'] as Objeto[], caminho);
    if (recusa) return recusa;
  }
  return null;
}

/** Os pressupostos são opcionais no arquivo; quando vêm, cada um é conferido como os campos. */
function conferirPressupostos(pressupostos: unknown): RecusaDoArquivo | null {
  if (pressupostos === undefined || pressupostos === null) return null;
  return (
    conferirLista(pressupostos, 'pressupostos', PRESSUPOSTO) ??
    conferirValoresDosCampos(pressupostos as Objeto[], 'pressupostos')
  );
}

/**
 * A apresentação do formulário renderizável, conferida no que o formulário do candidato lê: cada seção,
 * campo, grupo e termo com os códigos e textos dele. O primeiro problema sai com o caminho.
 */
export function recusaDaApresentacao(conteudo: Objeto): RecusaDoArquivo | null {
  for (const [nome, forma] of Object.entries(LISTAS_DO_FORMULARIO)) {
    const recusa = conferirLista(conteudo[nome], nome, forma);
    if (recusa) return recusa;
  }
  return (
    conferirGrupos(conteudo['grupos'] as Objeto[]) ??
    conferirValoresDosCampos(conteudo['fatosColetados'] as Objeto[], 'fatosColetados') ??
    conferirPressupostos(conteudo['pressupostos'])
  );
}

/**
 * As respostas de um caso, conferidas na forma que a simulação lê: respostas e pressupostos são objetos,
 * as ocorrências de cada grupo são listas de objetos, e as seções concluídas, uma lista de códigos.
 */
export function recusaDaSimulacao(caso: Objeto): RecusaDoArquivo | null {
  for (const chave of ['respostas', 'pressupostos', 'grupos'] as const) {
    if (caso[chave] !== undefined && caso[chave] !== null && !ehObjeto(caso[chave])) {
      return { caminho: chave, mensagem: 'O caso traz este campo como objeto.' };
    }
  }
  return recusaDasOcorrencias(caso['grupos'] as Objeto | null) ?? recusaDasConcluidas(caso);
}

function recusaDasOcorrencias(grupos: Objeto | null): RecusaDoArquivo | null {
  for (const [grupo, ocorrencias] of Object.entries(grupos ?? {})) {
    if (ocorrencias === null) continue;
    if (!Array.isArray(ocorrencias))
      return { caminho: `grupos.${grupo}`, mensagem: 'As ocorrências do grupo são uma lista.' };
    const errada = ocorrencias.findIndex((o) => !ocorrenciaValida(o));
    if (errada >= 0)
      return {
        caminho: `grupos.${grupo}[${errada}]`,
        mensagem: 'A ocorrência é um objeto com as respostas dela.',
      };
  }
  return null;
}

function ocorrenciaValida(ocorrencia: unknown): boolean {
  if (!ehObjeto(ocorrencia)) return false;
  const respostas = ocorrencia['respostas'];
  return respostas === undefined || respostas === null || ehObjeto(respostas);
}

function recusaDasConcluidas(caso: Objeto): RecusaDoArquivo | null {
  const concluidas = caso['etapasConcluidas'];
  if (concluidas === undefined || concluidas === null) return null;
  if (Array.isArray(concluidas) && concluidas.every((c) => typeof c === 'string')) return null;
  return {
    caminho: 'etapasConcluidas',
    mensagem: 'As seções concluídas são uma lista de códigos.',
  };
}

import type {
  ApresentacaoDaEtapa,
  ApresentacaoDoCampo,
} from '../editor-de-formulario/modelo/tipos';
import type {
  CampoRenderizavel,
  ColetaDoFormulario,
  ConteudoDoTermo,
  FormularioDoCandidato,
  GrupoRenderizavel,
  PressupostoDoFormulario,
  PressupostosDoFormulario,
  SecaoRenderizavel,
  TermoRenderizavel,
  ValorSelecionavel,
} from './formulario-do-candidato.model';
import type { OcorrenciasDoGrupoDasRegras } from './interpretador/regras-do-formulario';

/** O primeiro problema de um arquivo importado: onde está e o que há de errado. */
export interface RecusaDoArquivo {
  readonly caminho: string;
  readonly mensagem: string;
}

type Objeto = Record<string, unknown>;
type Conferencia = (valor: unknown, caminho: string) => RecusaDoArquivo | null;
type Obrigatorias<T> = { [K in keyof T]-?: undefined extends T[K] ? never : K }[keyof T];
/** Uma conferência por propriedade do modelo: as obrigatórias têm de constar, as opcionais podem. */
type FormaDe<T> = Readonly<Record<Obrigatorias<T>, Conferencia>> &
  Readonly<Partial<Record<Exclude<keyof T, Obrigatorias<T>>, Conferencia>>>;

export function ehObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function juntar(caminho: string, propriedade: string): string {
  return caminho === '' ? propriedade : `${caminho}.${propriedade}`;
}

function conferirTipo(ok: boolean): Conferencia {
  return (_valor, caminho) =>
    ok ? null : { caminho, mensagem: 'A propriedade falta ou tem outra forma.' };
}

const texto: Conferencia = (v, caminho) => conferirTipo(typeof v === 'string')(v, caminho);
const booleano: Conferencia = (v, caminho) => conferirTipo(typeof v === 'boolean')(v, caminho);
// O inteiro do contrato vem como número ou, como a API também o lê, como número escrito em texto.
const numero: Conferencia = (v, caminho) =>
  conferirTipo(typeof v === 'number' || (typeof v === 'string' && /^-?[0-9]+$/.test(v)))(
    v,
    caminho,
  );
// As regras já foram conferidas por `lerRegras`, antes de a apresentação ser olhada.
const regrasJaLidas: Conferencia = () => null;

function opcional(conferir: Conferencia): Conferencia {
  return (valor, caminho) =>
    valor === null || valor === undefined ? null : conferir(valor, caminho);
}

function lista(conferir: Conferencia): Conferencia {
  return (valor, caminho) => {
    if (!Array.isArray(valor)) return { caminho, mensagem: 'O formulário traz esta lista.' };
    for (const [i, elemento] of valor.entries()) {
      const recusa = conferir(elemento, `${caminho}[${i}]`);
      if (recusa) return recusa;
    }
    return null;
  };
}

function objeto<T>(forma: FormaDe<T>): Conferencia {
  const conferencias: Readonly<Record<string, Conferencia | undefined>> = forma;
  return (valor, caminho) => {
    if (!ehObjeto(valor)) return { caminho, mensagem: 'O elemento é um objeto.' };
    for (const [propriedade, conferir] of Object.entries(conferencias)) {
      const recusa = conferir?.(valor[propriedade], juntar(caminho, propriedade));
      if (recusa) return recusa;
    }
    return null;
  };
}

const VALOR = objeto<ValorSelecionavel>({
  codigo: texto,
  ordem: numero,
  descricao: opcional(texto),
  orientacao: opcional(texto),
});
const VALORES = opcional(lista(VALOR));
const APRESENTACAO_DO_CAMPO = objeto<ApresentacaoDoCampo>({
  rotulo: texto,
  tipoRenderizacao: texto,
  pedirConfirmacao: booleano,
  ajuda: opcional(texto),
});
const CAMPO = objeto<CampoRenderizavel>({
  fatoCodigo: texto,
  ordem: numero,
  apresentacao: APRESENTACAO_DO_CAMPO,
  valoresSelecionaveis: VALORES,
  formato: opcional(texto),
});
const OCORRENCIAS = objeto<OcorrenciasDoGrupoDasRegras>({
  minimo: numero,
  incluiCandidato: booleano,
  maximo: opcional(numero),
});
const GRUPO = objeto<GrupoRenderizavel>({
  codigo: texto,
  ordem: numero,
  rotulo: texto,
  ocorrencias: OCORRENCIAS,
  subitens: lista(CAMPO),
});
const APRESENTACAO_DA_ETAPA = objeto<ApresentacaoDaEtapa>({
  titulo: texto,
  descricao: opcional(texto),
  aviso: opcional(texto),
});
const SECAO = objeto<SecaoRenderizavel>({
  codigo: texto,
  ordem: numero,
  tipo: texto,
  apresentacao: APRESENTACAO_DA_ETAPA,
  codigoNasRegras: opcional(texto),
  bloco: opcional(texto),
});
const CONTEUDO_DO_TERMO = objeto<ConteudoDoTermo>({
  nome: texto,
  texto,
  baseLegal: texto,
});
const TERMO = objeto<TermoRenderizavel>({
  codigo: texto,
  codigoNasRegras: texto,
  ordem: numero,
  conteudo: CONTEUDO_DO_TERMO,
});
const PRESSUPOSTO = objeto<PressupostoDoFormulario>({
  fatoCodigo: texto,
  rotulo: opcional(texto),
  tipoRenderizacao: opcional(texto),
  formato: opcional(texto),
  calculadoDe: opcional(lista(texto)),
  valoresSelecionaveis: VALORES,
});
const COLETA = objeto<ColetaDoFormulario>({
  itens: lista(CAMPO),
  grupos: lista(GRUPO),
});
const PRESSUPOSTOS = objeto<PressupostosDoFormulario>({ fatos: lista(PRESSUPOSTO) });
const FORMULARIO = objeto<FormularioDoCandidato>({
  finalidade: texto,
  etapas: lista(SECAO),
  termos: lista(TERMO),
  coleta: COLETA,
  regras: regrasJaLidas,
  pressupostos: PRESSUPOSTOS,
  titulo: opcional(texto),
});

/**
 * A apresentação do formulário renderizável, conferida no que o formulário do candidato lê: cada seção,
 * campo, grupo e termo com os códigos e textos dele. O primeiro problema sai com o caminho.
 */
export function recusaDaApresentacao(conteudo: Objeto): RecusaDoArquivo | null {
  return FORMULARIO(conteudo, '');
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

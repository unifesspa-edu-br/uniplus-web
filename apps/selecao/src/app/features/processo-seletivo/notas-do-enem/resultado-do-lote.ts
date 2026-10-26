import type {
  AusenteDoLoteDto,
  LoteDeNotasDoEnemDto,
  OcorrenciaDoLoteDto,
  OpcaoDeCursoDoLoteDto,
} from '@uniplus/shared-data/selecao';
import { formatarNumeroPtBr, numeroDaApi } from '@uniplus/shared-utils';

/** Os totais do lote já como números, na ordem em que a tela os apresenta. */
export interface TotaisDoLote {
  readonly linhasLidas: number;
  readonly inscritosComNota: number;
  readonly notasLancadas: number;
  readonly inscritosSemNota: number;
  readonly linhasSemInscrito: number;
  readonly inscritosEmConflito: number;
  readonly inscritosAusentes: number;
}

export function totaisDoLote(lote: LoteDeNotasDoEnemDto): TotaisDoLote {
  return {
    linhasLidas: numeroDaApi(lote.totalDeLinhas),
    inscritosComNota: numeroDaApi(lote.totalDeInscritosComNota),
    notasLancadas: numeroDaApi(lote.totalDeLancamentos),
    inscritosSemNota: numeroDaApi(lote.totalDeInscritosSemLinha),
    linhasSemInscrito: numeroDaApi(lote.totalDeLinhasSemInscrito),
    inscritosEmConflito: numeroDaApi(lote.totalDeInscritosEmConflito),
    inscritosAusentes: numeroDaApi(lote.totalDeInscritosAusentes),
  };
}

/** Um total da API, que chega como número ou texto, no formato pt-BR das telas. */
export function formatarTotal(valor: number | string): string {
  return formatarNumeroPtBr(numeroDaApi(valor));
}

function quantos(n: number, singular: string, plural: string): string {
  return `${formatarNumeroPtBr(n)} ${n === 1 ? singular : plural}`;
}

/** Frase curta com o que importa do lote, para o resultado não depender de ler a lista de definições. */
export function fraseDoLote(totais: TotaisDoLote): string {
  const partes = [
    `${quantos(totais.inscritosComNota, 'inscrito com nota', 'inscritos com nota')}`,
    `${formatarNumeroPtBr(totais.inscritosSemNota)} sem nota`,
    quantos(totais.linhasSemInscrito, 'linha sem inscrito', 'linhas sem inscrito'),
  ];
  if (totais.inscritosEmConflito > 0) {
    partes.push(
      quantos(totais.inscritosEmConflito, 'inscrito em conflito', 'inscritos em conflito'),
    );
  }
  if (totais.inscritosAusentes > 0) {
    partes.push(quantos(totais.inscritosAusentes, 'inscrito ausente', 'inscritos ausentes'));
  }
  return `${partes.join(', ')}.`;
}

export type TipoDeGrupo =
  | 'inscritoSemLinha'
  | 'ausente'
  | 'linhaSemInscrito'
  | 'conflito'
  | 'outras';

/** Quem o lote aponta: o inscrito (nulo na linha sem inscrito) e as linhas do arquivo em que aparece. */
export interface LinhaDeOcorrencia {
  readonly inscricao: string | null;
  readonly candidato: string | null;
  readonly cpf: string | null;
  /** `Feminino` ou `Masculino`, só na linha sem inscrito; nulo quando o arquivo não traz. */
  readonly sexo: string | null;
  /** As opções de curso do inscrito, pela ordem de preferência. */
  readonly cursos: readonly string[];
  readonly linhas: readonly number[];
  /** Nomes curtos das áreas, só nos ausentes. */
  readonly areas: readonly string[];
}

/** Um grupo de ocorrências do mesmo tipo, com o texto que explica o efeito delas. */
export interface GrupoDeOcorrencias {
  readonly tipo: TipoDeGrupo;
  readonly rotulo: string;
  readonly texto: string;
  readonly itens: readonly LinhaDeOcorrencia[];
}

const TIPOS_CONHECIDOS: Readonly<Partial<Record<string, TipoDeGrupo>>> = {
  INSCRITO_SEM_LINHA: 'inscritoSemLinha',
  CONFLITO: 'conflito',
  LINHA_SEM_INSCRITO: 'linhaSemInscrito',
};

const DESCRICAO: Readonly<Record<TipoDeGrupo, { rotulo: string; texto: string }>> = {
  inscritoSemLinha: {
    rotulo: 'Sem nota',
    texto: 'O CPF destes inscritos não aparece no arquivo. Eles ficam sem nota da edição.',
  },
  ausente: {
    rotulo: 'Ausentes',
    texto: 'Estes inscritos constam no arquivo, mas não têm nota nas áreas indicadas.',
  },
  linhaSemInscrito: {
    rotulo: 'Linhas sem inscrito',
    texto: 'O CPF destas linhas não é de nenhuma inscrição desta edição.',
  },
  conflito: {
    rotulo: 'Conflitos',
    texto:
      'O inscrito tem mais de uma linha diferente no arquivo e fica sem nota até o CEPS conferir.',
  },
  outras: {
    rotulo: 'Outras ocorrências',
    texto: 'Ocorrências de um tipo que esta tela ainda não conhece.',
  },
};

const ORDEM: readonly TipoDeGrupo[] = [
  'inscritoSemLinha',
  'ausente',
  'linhaSemInscrito',
  'conflito',
  'outras',
];

const AREAS_CURTAS: Readonly<Record<string, string>> = {
  CIENCIAS_DA_NATUREZA: 'Natureza',
  CIENCIAS_HUMANAS: 'Humanas',
  LINGUAGENS: 'Linguagens',
  MATEMATICA: 'Matemática',
  REDACAO: 'Redação',
};

/** Nome curto da área para a tabela; uma área que a tela não conhece aparece como veio. */
export function nomeCurtoDaArea(codigo: string): string {
  return AREAS_CURTAS[codigo] ?? codigo;
}

const comparaInscricao = (a: string | null, b: string | null): number => {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return a.localeCompare(b, 'pt-BR', { numeric: true });
};

function linhasEmOrdem(ocorrencia: OcorrenciaDoLoteDto): number[] {
  return (ocorrencia.numerosDasLinhas ?? []).map(numeroDaApi).sort((a, b) => a - b);
}

function cursosEmOrdem(opcoes: readonly OpcaoDeCursoDoLoteDto[] | null | undefined): string[] {
  return [...(opcoes ?? [])]
    .sort((a, b) => numeroDaApi(a.ordem) - numeroDaApi(b.ordem))
    .map((o) => o.oferta);
}

const SEXOS: Readonly<Record<string, string>> = { F: 'Feminino', M: 'Masculino' };

/** O sexo por extenso; um código que a tela não conhece aparece como veio. */
function rotuloDoSexo(codigo: string | null | undefined): string | null {
  return codigo ? (SEXOS[codigo] ?? codigo) : null;
}

function daOcorrencia(ocorrencia: OcorrenciaDoLoteDto): LinhaDeOcorrencia {
  return {
    inscricao: ocorrencia.numeroDeInscricao,
    candidato: ocorrencia.nomeDoCandidato,
    cpf: ocorrencia.cpfMascarado,
    sexo: rotuloDoSexo(ocorrencia.sexo),
    cursos: cursosEmOrdem(ocorrencia.opcoesDeCurso),
    linhas: linhasEmOrdem(ocorrencia),
    areas: [],
  };
}

function doAusente(ausente: AusenteDoLoteDto): LinhaDeOcorrencia {
  return {
    inscricao: ausente.numeroDeInscricao,
    candidato: ausente.nomeDoCandidato,
    cpf: ausente.cpfMascarado,
    sexo: null,
    cursos: cursosEmOrdem(ausente.opcoesDeCurso),
    linhas: [],
    areas: ausente.areas.map(nomeCurtoDaArea),
  };
}

/**
 * As linhas em ordem, com três ou mais seguidas reunidas em intervalo: "10, 13, 16–19 e 22".
 * Duas seguidas ficam separadas, porque "4 e 5" lê melhor que "4–5".
 */
export function listaDeLinhas(linhas: readonly number[]): string {
  const partes: string[] = [];
  for (let i = 0; i < linhas.length; ) {
    let fim = i;
    while (fim + 1 < linhas.length && linhas[fim + 1] === linhas[fim] + 1) fim++;
    if (fim - i >= 2) {
      partes.push(`${linhas[i]}–${linhas[fim]}`);
    } else {
      for (let k = i; k <= fim; k++) partes.push(String(linhas[k]));
    }
    i = fim + 1;
  }
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/**
 * Agrupa as ocorrências por tipo, só os grupos que têm itens. A linha sem inscrito vira um item por
 * linha, com o nome, o sexo e o CPF mascarado que a API devolve. Um tipo que a API passe a publicar e a tela não
 * conheça vai para "Outras ocorrências", com o tipo como veio.
 */
export function agruparOcorrencias(lote: LoteDeNotasDoEnemDto): readonly GrupoDeOcorrencias[] {
  const porTipo = new Map<TipoDeGrupo, LinhaDeOcorrencia[]>();
  const incluir = (tipo: TipoDeGrupo, linha: LinhaDeOcorrencia): void => {
    const doTipo = porTipo.get(tipo);
    if (doTipo === undefined) porTipo.set(tipo, [linha]);
    else doTipo.push(linha);
  };
  for (const ocorrencia of lote.ocorrencias ?? []) {
    const tipo: TipoDeGrupo = TIPOS_CONHECIDOS[ocorrencia.tipo] ?? 'outras';
    const linha = daOcorrencia(ocorrencia);
    incluir(tipo, tipo === 'outras' ? { ...linha, candidato: ocorrencia.tipo } : linha);
  }
  for (const ausente of lote.ausentes ?? []) incluir('ausente', doAusente(ausente));

  return ORDEM.flatMap((tipo) => {
    const doTipo = porTipo.get(tipo);
    if (doTipo === undefined) return [];
    return [{ tipo, ...DESCRICAO[tipo], itens: ordenar(tipo, doTipo) }];
  });
}

function ordenar(tipo: TipoDeGrupo, itens: LinhaDeOcorrencia[]): LinhaDeOcorrencia[] {
  if (tipo === 'linhaSemInscrito') {
    return itens
      .flatMap((i) => i.linhas.map((linha) => ({ ...i, linhas: [linha] })))
      .sort((a, b) => a.linhas[0] - b.linhas[0]);
  }
  return itens.sort((a, b) => comparaInscricao(a.inscricao, b.inscricao));
}

/** Os oito primeiros caracteres do hash bastam para conferir um arquivo de relance. */
export function hashCurto(hash: string): string {
  return hash.slice(0, 8);
}

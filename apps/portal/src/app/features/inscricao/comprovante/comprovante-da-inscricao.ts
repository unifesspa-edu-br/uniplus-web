import type {
  CertamePublicadoDto,
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
  MinhaInscricaoDto,
} from '@uniplus/shared-data/selecao';
import {
  type CampoExibido,
  type NomesDosMunicipios,
  nomesPelaOrdem,
  respostaExibida,
  titulosDasOcorrencias,
} from '@uniplus/shared-ui/components';

import { formatarTamanhoDeArquivo } from '@uniplus/shared-utils';
import { nomeDaOferta, numeroDeOpcoesDeCurso } from '../oferta-da-inscricao';

export interface RespostaDoComprovante {
  readonly rotulo: string;
  readonly valor: string;
}

export interface OcorrenciaDoComprovante {
  /** "Você (candidato)" ou "Integrante {n}", como no formulário. */
  readonly titulo: string;
  readonly respostas: readonly RespostaDoComprovante[];
}

export interface GrupoDoComprovante {
  readonly rotulo: string;
  readonly ocorrencias: readonly OcorrenciaDoComprovante[];
}

export interface SecaoDoComprovante {
  readonly codigo: string;
  readonly titulo: string;
  readonly respostas: readonly RespostaDoComprovante[];
  readonly grupos: readonly GrupoDoComprovante[];
}

interface CampoDoFormulario extends CampoExibido {
  readonly fatoCodigo: string;
  readonly rotulo: string;
}

/**
 * Os fatos do conjunto básico que o cartão do candidato já mostra: não se repetem nas respostas. São os
 * mesmos de que a API tira o nome preferido.
 */
const FATOS_DO_CARTAO_DO_CANDIDATO = new Set(['NOME', 'NOME_SOCIAL', 'DESEJA_NOME_SOCIAL', 'CPF']);

const pelaOrdem = <T extends { readonly ordem: number | string }>(itens: readonly T[]): T[] =>
  [...itens].sort((a, b) => Number(a.ordem) - Number(b.ordem));

const respondido = (respostas: Readonly<Record<string, unknown>>, fato: string): boolean =>
  respostas[fato] !== undefined && respostas[fato] !== null;

/**
 * Os derivados que o formulário descreve: os fatos que as regras do processo citam, com o rótulo e o
 * tipo congelados na publicação. O que o sistema calcula sem regra que o cite fica no comprovante
 * gravado, mas não tem como ser apresentado.
 */
const derivadosDescritos = (formulario: FormularioRenderizavelDto): CampoDoFormulario[] =>
  formulario.pressupostos.flatMap((p) => (p.rotulo ? [{ ...p, rotulo: p.rotulo }] : []));

function respondidos(
  campos: readonly CampoDoFormulario[],
  respostas: Readonly<Record<string, unknown>>,
  municipios: NomesDosMunicipios,
): RespostaDoComprovante[] {
  return campos
    .filter((c) => respondido(respostas, c.fatoCodigo))
    .map((c) => ({
      rotulo: c.rotulo,
      valor: respostaExibida(c, respostas[c.fatoCodigo], municipios),
    }));
}

/**
 * Os códigos IBGE distintos que o comprovante mostra como município: os das respostas e dos derivados
 * cujo campo, no formulário da versão fixada, é de município.
 */
export function municipiosDoComprovante(
  formulario: FormularioRenderizavelDto,
  comprovante: ComprovanteInscricaoDto,
): string[] {
  const deMunicipio = (c: CampoExibido): boolean => c.tipoRenderizacao === 'MUNICIPIO';
  const codigos = (
    campos: readonly CampoDoFormulario[],
    respostas: Readonly<Record<string, unknown>>,
  ) =>
    campos
      .filter((c) => deMunicipio(c) && respondido(respostas, c.fatoCodigo))
      .map((c) => String(respostas[c.fatoCodigo]));
  return [
    ...new Set([
      ...codigos(formulario.fatosColetados, comprovante.respostas),
      ...formulario.grupos.flatMap((g) =>
        (comprovante.grupos[g.codigo] ?? []).flatMap((o) => codigos(g.subitens, o.respostas ?? {})),
      ),
      ...codigos(derivadosDescritos(formulario), comprovante.derivados),
    ]),
  ];
}

/** As respostas do comprovante pelas seções do formulário da versão fixada, com os rótulos de lá. */
export function secoesDoComprovante(
  formulario: FormularioRenderizavelDto,
  comprovante: ComprovanteInscricaoDto,
  municipios: NomesDosMunicipios = new Map(),
): SecaoDoComprovante[] {
  return pelaOrdem(formulario.etapas)
    .map((etapa) => ({
      codigo: etapa.codigo,
      titulo: etapa.titulo,
      respostas: respondidos(
        pelaOrdem(
          formulario.fatosColetados.filter(
            (c) =>
              c.etapaCodigo === etapa.codigo && !FATOS_DO_CARTAO_DO_CANDIDATO.has(c.fatoCodigo),
          ),
        ),
        comprovante.respostas,
        municipios,
      ),
      grupos: pelaOrdem(formulario.grupos.filter((g) => g.etapaCodigo === etapa.codigo))
        .map((grupo) => {
          const ocorrencias = comprovante.grupos[grupo.codigo] ?? [];
          const titulos = titulosDasOcorrencias(
            grupo.incluiCandidato,
            ocorrencias.map((o) => o.respostas),
          );
          return {
            rotulo: grupo.rotulo,
            ocorrencias: ocorrencias.map((o, i) => ({
              titulo: titulos[i],
              respostas: respondidos(pelaOrdem(grupo.subitens), o.respostas ?? {}, municipios),
            })),
          };
        })
        .filter((g) => g.ocorrencias.length > 0),
    }))
    .filter((s) => s.respostas.length > 0 || s.grupos.length > 0);
}

/** O que o sistema calculou das respostas e o formulário descreve, com o rótulo de lá. */
export function derivadosDoComprovante(
  formulario: FormularioRenderizavelDto,
  comprovante: ComprovanteInscricaoDto,
  municipios: NomesDosMunicipios = new Map(),
): RespostaDoComprovante[] {
  return respondidos(derivadosDescritos(formulario), comprovante.derivados, municipios);
}

/**
 * Os nomes das modalidades em que o envio concorre, como o comprovante os congelou. Nulo quando o
 * processo não define pela inscrição as modalidades de concorrência. Nunca vem vazio: o envio que não
 * dá nenhuma modalidade é recusado e não gera comprovante.
 */
export function modalidadesDoComprovante(
  comprovante: ComprovanteInscricaoDto,
): readonly string[] | null {
  return comprovante.modalidades ? nomesPelaOrdem(comprovante.modalidades) : null;
}

/** Uma opção de curso do envio, com as modalidades em que ele concorre nela. */
export interface OpcaoDeCursoDoComprovante {
  /** "Curso" quando o processo admite uma só opção; senão "1ª opção" ou "2ª opção". */
  readonly rotulo: string;
  /** O curso pelo nome congelado na publicação; nulo se o envio não declarou a opção ou ela não é mais do certame. */
  readonly curso: string | null;
  /** O que a tela mostra da opção: o curso, ou que ela não foi declarada ou não está mais no certame. */
  readonly exibicao: string;
  /** Nulo quando a opção não foi declarada ou o processo não define pela inscrição as modalidades. */
  readonly modalidades: readonly string[] | null;
}

const exibicaoDaOpcao = (curso: string | null, declarada: boolean): string =>
  declarada ? (curso ?? 'Curso não encontrado no certame') : 'Não declarada';

/**
 * Os cursos que o envio declarou, pela ordem das opções. Com 2 opções admitidas, ou com a 2ª declarada, a
 * 2ª aparece sempre, e não declarada diz isso; com 1, o comprovante tem a única opção, como sempre teve.
 */
export function opcoesDoComprovante(
  comprovante: ComprovanteInscricaoDto,
  processo: CertamePublicadoDto | null,
): readonly OpcaoDeCursoDoComprovante[] {
  const nomeDe = (id: string | null | undefined): string | null => {
    const oferta = id ? processo?.ofertas.find((o) => o.ofertaCursoOrigemId === id) : undefined;
    return oferta ? nomeDaOferta(oferta) : null;
  };
  const segundaDeclarada = !!comprovante.ofertaCursoSegundaOpcaoId;
  const admitePar = numeroDeOpcoesDeCurso(processo?.opcoesDeCurso.numero ?? 1) === 2;
  const opcao = (
    rotulo: string,
    id: string | null | undefined,
    modalidades: readonly string[] | null,
  ): OpcaoDeCursoDoComprovante => {
    const curso = nomeDe(id);
    return { rotulo, curso, exibicao: exibicaoDaOpcao(curso, !!id), modalidades };
  };
  const primeira = opcao(
    segundaDeclarada || admitePar ? '1ª opção' : 'Curso',
    comprovante.ofertaCursoId,
    modalidadesDoComprovante(comprovante),
  );
  if (!segundaDeclarada && !admitePar) return [primeira];
  return [
    primeira,
    opcao(
      '2ª opção',
      comprovante.ofertaCursoSegundaOpcaoId,
      comprovante.modalidadesSegundaOpcao
        ? nomesPelaOrdem(comprovante.modalidadesSegundaOpcao)
        : null,
    ),
  ];
}

export interface ArquivoDoComprovanteExibido {
  readonly formato: string;
  readonly tamanho: string;
  /** O código de verificação do arquivo, abreviado para caber numa linha. */
  readonly codigoAbreviado: string;
  readonly codigo: string;
}

export interface DocumentoDoComprovanteExibido {
  readonly nome: string;
  /** "Você (candidato)" ou "Integrante {n}" quando a exigência é de uma ocorrência de grupo. */
  readonly integrante: string | null;
  readonly obrigatoriedade: 'Obrigatório' | 'Facultativo';
  readonly situacao: string;
  readonly consequencia: string | null;
  readonly arquivos: readonly ArquivoDoComprovanteExibido[];
}

const SITUACOES_DO_DOCUMENTO: Readonly<Record<string, string>> = {
  SATISFEITA: 'Atendido',
  PENDENTE: 'Pendente',
  DISPENSADA: 'Dispensado',
  PODE_SER_EXIGIDO: 'Pode ser exigido, conforme as respostas',
  DEPENDE_DE_FASE_POSTERIOR: 'Pode ser exigido, conforme uma fase posterior do processo',
};

const SITUACAO_DESCONHECIDA = 'A confirmar';

/** Quantos caracteres do código de verificação ficam de cada lado quando ele é abreviado. */
const LADO_DO_CODIGO_ABREVIADO = 8;

const abreviado = (codigo: string): string =>
  codigo.length <= 2 * LADO_DO_CODIGO_ABREVIADO + 1
    ? codigo
    : `${codigo.slice(0, LADO_DO_CODIGO_ABREVIADO)}…${codigo.slice(-LADO_DO_CODIGO_ABREVIADO)}`;

/**
 * Os documentos que o envio registrou, com o que o candidato precisa guardar de cada arquivo. Vazio
 * quando o processo não exigiu documento nesse envio: a página não mostra a seção (UNI-REQ-0171).
 */
export function documentosDoComprovante(
  comprovante: ComprovanteInscricaoDto,
  formulario: FormularioRenderizavelDto | null = null,
): readonly DocumentoDoComprovanteExibido[] {
  const integrantes = new Map(
    (formulario?.grupos ?? []).flatMap((grupo) => {
      const ocorrencias = comprovante.grupos[grupo.codigo] ?? [];
      const titulos = titulosDasOcorrencias(
        grupo.incluiCandidato,
        ocorrencias.map((o) => o.respostas),
      );
      return ocorrencias.map((o, i): [string, string] => [o.id, titulos[i]]);
    }),
  );
  return comprovante.documentos.map((d) => ({
    nome: d.nome,
    integrante: d.ocorrenciaId === null ? null : (integrantes.get(d.ocorrenciaId) ?? null),
    obrigatoriedade: d.obrigatorio ? 'Obrigatório' : 'Facultativo',
    situacao: SITUACOES_DO_DOCUMENTO[d.situacao] ?? SITUACAO_DESCONHECIDA,
    consequencia: d.consequencia,
    arquivos: d.arquivos.map((a) => ({
      formato: a.formato,
      tamanho: formatarTamanhoDeArquivo(a.tamanhoBytes),
      codigoAbreviado: abreviado(a.hashSha256),
      codigo: a.hashSha256,
    })),
  }));
}

/** Os termos aceitos pelo nome que o formulário lhes dá. */
export function termosAceitos(
  formulario: FormularioRenderizavelDto,
  comprovante: ComprovanteInscricaoDto,
): string[] {
  const termos = new Map(formulario.termos.map((t) => [t.codigo, t.nome]));
  return comprovante.aceites.map((a) => termos.get(a.codigo) ?? a.codigo);
}

type ComprovanteEmitido = MinhaInscricaoDto['comprovantes'][number];

export interface Vizinhos {
  readonly anterior: number | null;
  readonly seguinte: number | null;
}

/** O número pedido, se a inscrição o emitiu; sem pedido, o da última submissão. */
export function numeroDoComprovante(
  emitidos: readonly ComprovanteEmitido[],
  pedido: number | null,
): number | null {
  const numeros = emitidos.map((e) => Number(e.numero));
  if (pedido === null) return numeros.at(-1) ?? null;
  return numeros.includes(pedido) ? pedido : null;
}

/** O comprovante anterior e o seguinte, na ordem em que foram emitidos. */
export function vizinhos(emitidos: readonly ComprovanteEmitido[], numero: number): Vizinhos {
  const numeros = emitidos.map((e) => Number(e.numero));
  const i = numeros.indexOf(numero);
  return { anterior: numeros[i - 1] ?? null, seguinte: numeros[i + 1] ?? null };
}

/** Qual envio da inscrição o comprovante registra, e se é o que vale: o último enviado (UNI-REQ-0132). */
export interface EnvioDoComprovante {
  readonly ordem: number;
  readonly total: number;
  readonly ehOQueVale: boolean;
  readonly maisRecente: number;
}

export function envioDoComprovante(
  emitidos: readonly ComprovanteEmitido[],
  numero: number,
): EnvioDoComprovante {
  const numeros = emitidos.map((e) => Number(e.numero));
  const maisRecente = numeros.at(-1) ?? numero;
  return {
    ordem: numeros.indexOf(numero) + 1,
    total: numeros.length,
    ehOQueVale: numero === maisRecente,
    maisRecente,
  };
}

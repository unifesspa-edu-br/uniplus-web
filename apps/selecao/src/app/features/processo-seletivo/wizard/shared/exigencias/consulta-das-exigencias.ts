import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  RegraDeComprovacao,
} from '../../processo-seletivo.models';

import { temNormaResolvida } from './exigencias-documentais';

/** As exigências declaradas numa fase, na ordem em que a estrutura de regras as guarda. */
export function exigenciasDaFase(
  exigencias: ExigenciasDoRascunho,
  faseCodigo: string,
): readonly ExigenciaDeDocumento[] {
  return documentosDe(exigencias.regrasDeComprovacao).filter(
    (documento) => documento.faseCodigo === faseCodigo,
  );
}

/**
 * Onde uma exigência está na estrutura de regras: solta, ou dentro de um grupo que a combina com outras.
 *
 * A distinção importa para quem monta o edital. Uma regra de documento dentro de um grupo de alternativas não é
 * exigida por si — basta satisfazer o grupo —, e a mesma lista mostrando-a ao lado de uma
 * exigência solta faz as duas parecerem a mesma coisa.
 */
export interface GrupoDaExigencia {
  readonly forma: 'TODOS_OS_ITENS' | 'QUANTIDADE_MINIMA_DE_ITENS';
  /** Quantas alternativas do grupo precisam ser satisfeitas; `null` é o padrão do domínio, 1. */
  readonly quantidadeMinima: number | null;
  /** Quantos itens o grupo reúne — regras de documento e subgrupos, que também são alternativas. */
  readonly alternativas: number;
}

/**
 * Pelas ocorrências de que grupo repetível do formulário a exigência se repete (ADR-0138): a da
 * própria regra de documento, ou a herdada do grupo de alternativas mais próximo que se repete — a repetição
 * não ocorre dentro de outra repetição, e a regra de documento dentro dele não declara outra.
 */
export interface RepeticaoDaExigencia {
  readonly grupo: string;
  readonly herdada: boolean;
}

/** Uma exigência com a posição que ela ocupa na estrutura de regras. */
export interface ExigenciaLocalizada {
  readonly identificadorNoRascunho: string;
  readonly documento: ExigenciaDeDocumento;
  /** `null` quando a exigência está solta, fora de qualquer grupo. */
  readonly grupo: GrupoDaExigencia | null;
  /** `null` quando a exigência é uma por candidato. */
  readonly repeticao: RepeticaoDaExigencia | null;
}

/** As exigências de uma fase com a posição de cada uma na estrutura de regras. */
export function exigenciasLocalizadasDaFase(
  exigencias: ExigenciasDoRascunho,
  faseCodigo: string,
): readonly ExigenciaLocalizada[] {
  return exigenciasLocalizadas(exigencias).filter(
    ({ documento }) => documento.faseCodigo === faseCodigo,
  );
}

/** Todas as exigências da estrutura de regras, de qualquer fase, com a posição de cada uma. */
export function exigenciasLocalizadas(
  exigencias: ExigenciasDoRascunho,
): readonly ExigenciaLocalizada[] {
  const achados: ExigenciaLocalizada[] = [];
  localizarExigencias(exigencias.regrasDeComprovacao, { grupo: null, herdada: null }, achados);
  return achados;
}

/** Onde a descida da estrutura de regras está: o grupo que contém os regras e a repetição que ele impõe a eles. */
interface PosicaoNaComprovacao {
  readonly grupo: GrupoDaExigencia | null;
  readonly herdada: string | null;
}

function localizarExigencias(
  regras: readonly RegraDeComprovacao[],
  posicao: PosicaoNaComprovacao,
  achados: ExigenciaLocalizada[],
): void {
  for (const regra of regras) {
    if (regra.forma === 'DOCUMENTO') {
      registrarDocumentoLocalizado(regra, posicao, achados);
    } else {
      localizarExigenciasNoGrupo({ ...regra, forma: regra.forma }, posicao, achados);
    }
  }
}

function localizarExigenciasNoGrupo(
  grupo: RegraDeComprovacao & Pick<GrupoDaExigencia, 'forma'>,
  posicao: PosicaoNaComprovacao,
  achados: ExigenciaLocalizada[],
): void {
  const itens = grupo.itens ?? [];
  localizarExigencias(itens, posicaoDentroDoGrupo(grupo, itens.length, posicao), achados);
}

function registrarDocumentoLocalizado(
  regra: RegraDeComprovacao,
  posicao: PosicaoNaComprovacao,
  achados: ExigenciaLocalizada[],
): void {
  if (regra.documento === null) return;
  achados.push({
    identificadorNoRascunho: regra.identificadorNoRascunho,
    documento: regra.documento,
    grupo: posicao.grupo,
    repeticao: repeticaoDoDocumento(regra, posicao.herdada),
  });
}

function posicaoDentroDoGrupo(
  grupo: Pick<RegraDeComprovacao, 'quantidadeMinima' | 'grupoDoFormularioParaRepeticao'> &
    Pick<GrupoDaExigencia, 'forma'>,
  alternativas: number,
  fora: PosicaoNaComprovacao,
): PosicaoNaComprovacao {
  return {
    // Conta TODOS os itens, não só as regras de documento: um grupo pode reunir outros grupos, e contar
    // só as regras de documento diretas diria "uma das 1 alternativas" onde há duas.
    grupo: { forma: grupo.forma, quantidadeMinima: grupo.quantidadeMinima, alternativas },
    herdada: fora.herdada ?? grupo.grupoDoFormularioParaRepeticao,
  };
}

function repeticaoDoDocumento(
  regraDocumental: RegraDeComprovacao,
  herdada: string | null,
): RepeticaoDaExigencia | null {
  if (herdada !== null) return { grupo: herdada, herdada: true };
  return regraDocumental.grupoDoFormularioParaRepeticao === null
    ? null
    : { grupo: regraDocumental.grupoDoFormularioParaRepeticao, herdada: false };
}

/**
 * Os grupos que decidem sozinhos o resultado e estão sem norma resolvida.
 *
 * É o mesmo que a publicação confere: grupo de alternativas com consequência própria precisa de ao menos
 * uma base legal resolvida, pela mesma razão que a exigência individual precisa. A tela não
 * edita grupo — eles chegam da configuração —, mas calar sobre a pendência faria a pessoa
 * descobrir no último passo, sem saber de qual grupo se trata.
 */
export function gruposSemNormaResolvida(
  exigencias: ExigenciasDoRascunho,
): readonly { readonly documentos: readonly string[]; readonly fases: readonly string[] }[] {
  return gruposQueDecidem(exigencias).filter((grupo) => !grupo.normaResolvida);
}

interface GrupoDecisivo {
  readonly documentos: readonly string[];
  readonly fases: readonly string[];
  readonly normaResolvida: boolean;
}

/**
 * Os grupos `OU` que decidem sozinhos o resultado (consequência própria), com os documentos e as
 * fases que reúnem e se têm norma resolvida.
 */
export function gruposQueDecidem(exigencias: ExigenciasDoRascunho): readonly GrupoDecisivo[] {
  return identificarGruposDecisivos(exigencias.regrasDeComprovacao);
}

function identificarGruposDecisivos(regras: readonly RegraDeComprovacao[]): GrupoDecisivo[] {
  return regras.flatMap((regra) => {
    if (regra.forma === 'DOCUMENTO') return [];
    const grupo =
      regra.forma === 'QUANTIDADE_MINIMA_DE_ITENS' && (regra.consequencia ?? '') !== ''
        ? [resumirGrupoDecisivo(regra)]
        : [];
    return [...grupo, ...identificarGruposDecisivos(regra.itens ?? [])];
  });
}

function resumirGrupoDecisivo(regra: RegraDeComprovacao): GrupoDecisivo {
  const documentos = documentosDe(regra.itens ?? []);
  return {
    documentos: documentos.map((documento) => documento.tipoDocumentoId),
    fases: [...new Set(documentos.map((documento) => documento.faseCodigo))],
    normaResolvida: temNormaResolvida(regra.basesLegais ?? []),
  };
}

/**
 * As exigências declaradas na regra principal da estrutura de regras — fora de qualquer grupo.
 *
 * É deste conjunto que sai o modelo ao espalhar um documento por todas as fases: copiar uma
 * regra de documento de dentro de um grupo de alternativas transformaria "um destes dois basta" em "este, sozinho,
 * obrigatório" nas demais fases — mudança de sentido que ninguém pediu.
 */
export function exigenciasSemGrupo(
  exigencias: ExigenciasDoRascunho,
): readonly ExigenciaDeDocumento[] {
  return exigencias.regrasDeComprovacao
    .filter((regra) => regra.forma === 'DOCUMENTO' && regra.documento !== null)
    .map((regra) => regra.documento as ExigenciaDeDocumento);
}

/** Todas as exigências da estrutura de regras, de qualquer fase. */
export function todasAsExigencias(
  exigencias: ExigenciasDoRascunho,
): readonly ExigenciaDeDocumento[] {
  return documentosDe(exigencias.regrasDeComprovacao);
}

/** As exigências das regras de documento, em qualquer profundidade, na ordem da estrutura de regras. */
export function documentosDe(
  regras: readonly RegraDeComprovacao[],
): readonly ExigenciaDeDocumento[] {
  return regras.flatMap((regra) =>
    regra.forma === 'DOCUMENTO'
      ? regra.documento === null
        ? []
        : [regra.documento]
      : documentosDe(regra.itens ?? []),
  );
}

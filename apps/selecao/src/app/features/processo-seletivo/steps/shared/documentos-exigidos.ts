import type { FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import { STEP_LABELS } from '../processo-seletivo.data';
import type { ExigenciasDoRascunho } from '../processo-seletivo.models';
import {
  composicaoResumida,
  descreverNorma,
  descreverPublico,
  publicoDaExigencia,
  repeticaoResumida,
  rotuloDaConsequencia,
  type NormaDescrita,
} from '../steps/fase/resumo-da-exigencia';
import {
  exigenciaDecideResultado,
  exigenciasLocalizadasDaFase,
  finalidadeDaExigencia,
  temNormaResolvida,
  type ExigenciaLocalizada,
} from './exigencias-documentais';
import { dominiosDoGatilho, fatosParaGatilho, type FatoEscolhivel } from './gatilho-de-exigencia';

const BYTES_POR_MB = 1024 * 1024;

/** Como a leitura nomeia o que o rascunho guarda por código. */
export interface VocabularioDosDocumentos {
  readonly fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>;
  readonly nomeDoTipo: (tipoDocumentoId: string, nomeGuardado: string | undefined) => string;
}

/** Um documento exigido, já em prosa, como o formulário e a revisão o mostram. */
export interface DocumentoExigidoLido {
  readonly chave: string;
  readonly nome: string;
  readonly obrigatoriedade: 'Obrigatório' | 'Facultativo';
  readonly aplicaA: string;
  readonly consequencia: string;
  readonly arquivo: string;
  /** Vazio quando o documento é exigido por si, fora de grupo. */
  readonly composicao: string;
  readonly repeticao: string;
  readonly normas: readonly NormaDescrita[];
  /** A publicação recusaria a exigência: decide o resultado e nenhuma norma está resolvida. */
  readonly faltaNorma: boolean;
}

/** Os formatos e o tamanho que a exigência aceita, numa frase. */
export function descreverArquivo(formatosPermitidos: unknown, tamanhoMaximoBytes: number | null): string {
  const formatos =
    Array.isArray(formatosPermitidos) && formatosPermitidos.length > 0
      ? formatosPermitidos.join(', ')
      : 'qualquer formato';
  const tamanho =
    tamanhoMaximoBytes === null
      ? 'sem limite de tamanho declarado'
      : `até ${Number((tamanhoMaximoBytes / BYTES_POR_MB).toFixed(1)).toLocaleString('pt-BR')} MB`;
  return `${formatos}, ${tamanho}`;
}

function lerExigencia(
  { documento, grupo, repeticao }: ExigenciaLocalizada,
  vocabulario: VocabularioDosDocumentos,
): DocumentoExigidoLido {
  const nome = vocabulario.nomeDoTipo(documento.tipoDocumentoId, documento.tipoDocumentoNome);
  return {
    chave: `${documento.faseCodigo}|${documento.tipoDocumentoId}|${documento.etapaId ?? ''}`,
    nome,
    obrigatoriedade: documento.obrigatorio ? 'Obrigatório' : 'Facultativo',
    aplicaA: descreverPublico(publicoDaExigencia(documento, vocabulario.fatoPorCodigo)),
    consequencia: rotuloDaConsequencia(documento.consequenciaIndeferimento, documento.obrigatorio),
    arquivo: descreverArquivo(documento.formatosPermitidos, documento.tamanhoMaximoBytes),
    composicao: composicaoResumida(grupo !== null && grupo.alternativas >= 2 ? grupo : null),
    repeticao: repeticaoResumida(repeticao?.grupo ?? null),
    normas: documento.basesLegais.map(descreverNorma),
    faltaNorma: exigenciaDecideResultado(documento) && !temNormaResolvida(documento.basesLegais),
  };
}

/**
 * Os documentos que o formulário da finalidade pede na fase dele: os da fase cujo formulário
 * efetivo é este. A fase que inscrição e isenção dividem leva cada documento ao formulário que o
 * operador declarou; o declarado que a fase não responde não aparece em nenhum.
 */
export function documentosDoFormulario(
  exigencias: ExigenciasDoRascunho,
  faseCodigo: string,
  finalidade: string,
  finalidadesDaFase: readonly string[],
  vocabulario: VocabularioDosDocumentos,
): readonly DocumentoExigidoLido[] {
  return exigenciasLocalizadasDaFase(exigencias, faseCodigo)
    .filter(({ documento }) => {
      const formulario = finalidadeDaExigencia(documento.finalidade, finalidadesDaFase);
      return formulario.situacao === 'DEFINIDO' && formulario.finalidade === finalidade;
    })
    .map((exigencia) => lerExigencia(exigencia, vocabulario));
}

/** O resumo dos documentos de uma fase, para a revisão. */
export interface DocumentosDaFase {
  readonly faseCodigo: string;
  readonly obrigatorios: number;
  readonly facultativos: number;
  /** Quantas exigências a publicação recusaria por falta de norma resolvida. */
  readonly semNorma: number;
}

/**
 * Os documentos exigidos por fase, só das fases que exigem algum, na ordem do cronograma.
 * A situação da base legal é a que a publicação confere: a exigência que decide o resultado
 * precisa de norma resolvida.
 */
export function documentosPorFase(
  exigencias: ExigenciasDoRascunho,
  faseCodigos: readonly string[],
): readonly DocumentosDaFase[] {
  return faseCodigos.flatMap((faseCodigo) => {
    const documentos = exigenciasLocalizadasDaFase(exigencias, faseCodigo).map(
      ({ documento }) => documento,
    );
    if (documentos.length === 0) return [];
    return [
      {
        faseCodigo,
        obrigatorios: documentos.filter((documento) => documento.obrigatorio).length,
        facultativos: documentos.filter((documento) => !documento.obrigatorio).length,
        semNorma: documentos.filter(
          (documento) => exigenciaDecideResultado(documento) && !temNormaResolvida(documento.basesLegais),
        ).length,
      },
    ];
  });
}

/**
 * O vocabulário com que se lê o público de uma exigência: todo fato que o gatilho sabe avaliar,
 * com os valores que o processo oferta (condições de atendimento e modalidades).
 */
export function fatosParaLerOGatilho(
  fatos: readonly FatoCandidatoView[],
  condicoesDeAtendimento: readonly string[],
  modalidades: readonly string[],
): ReadonlyMap<string, FatoEscolhivel> {
  return new Map(
    fatosParaGatilho(fatos, dominiosDoGatilho(fatos, condicoesDeAtendimento, modalidades)).map(
      (fato) => [fato.codigo, fato],
    ),
  );
}

/** Posição do passo onde a lista de documentos é editada, derivada da ordem única dos passos. */
export const PASSO_CRONOGRAMA = STEP_LABELS.indexOf('Cronograma');

import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  NoDeExigencia,
} from '../../processo-seletivo.models';

import { temNormaResolvida } from './exigencias-documentais';

/** As exigências declaradas numa fase, na ordem em que a árvore as guarda. */
export function exigenciasDaFase(
  exigencias: ExigenciasDoRascunho,
  faseCodigo: string,
): readonly ExigenciaDeDocumento[] {
  const achados: ExigenciaDeDocumento[] = [];
  const visitar = (nos: readonly NoDeExigencia[]): void => {
    for (const no of nos) {
      if (no.tipo === 'FOLHA') {
        if (no.documento !== null && no.documento.faseCodigo === faseCodigo) {
          achados.push(no.documento);
        }
        continue;
      }
      visitar(no.filhos ?? []);
    }
  };
  visitar(exigencias.raizes);
  return achados;
}

/**
 * Onde uma exigência está na árvore: solta, ou dentro de um grupo que a combina com outras.
 *
 * A distinção importa para quem monta o edital. Uma folha dentro de um grupo `OU` não é
 * exigida por si — basta satisfazer o grupo —, e a mesma lista mostrando-a ao lado de uma
 * exigência solta faz as duas parecerem a mesma coisa.
 */
export interface GrupoDaExigencia {
  readonly tipo: 'E' | 'OU';
  /** Quantas alternativas do grupo precisam ser satisfeitas; `null` é o padrão do domínio, 1. */
  readonly quantidadeMinima: number | null;
  /** Quantos filhos o grupo reúne — folhas e subgrupos, que também são alternativas. */
  readonly alternativas: number;
}

/**
 * Pelas ocorrências de que grupo repetível do formulário a exigência se repete (ADR-0138): a da
 * própria folha, ou a herdada do grupo de alternativas mais próximo que se repete — a repetição
 * não aninha, e a folha dentro dele não declara outra.
 */
export interface RepeticaoDaExigencia {
  readonly grupo: string;
  readonly herdada: boolean;
}

/** Uma exigência com a posição que ela ocupa na árvore. */
export interface ExigenciaLocalizada {
  readonly documento: ExigenciaDeDocumento;
  /** `null` quando a exigência está solta, fora de qualquer grupo. */
  readonly grupo: GrupoDaExigencia | null;
  /** `null` quando a exigência é uma por candidato. */
  readonly repeticao: RepeticaoDaExigencia | null;
}

/**
 * As exigências de uma fase com a posição de cada uma na árvore.
 *
 * A tela listava as folhas de dentro de um grupo como se fossem soltas, e um conjunto por tipo
 * de documento colapsava numa linha só o documento declarado solto E dentro de um grupo —
 * editar essa linha mexia numa das duas declarações, escolhida por acaso da ordem.
 */
export function exigenciasLocalizadasDaFase(
  exigencias: ExigenciasDoRascunho,
  faseCodigo: string,
): readonly ExigenciaLocalizada[] {
  return exigenciasLocalizadas(exigencias).filter(
    ({ documento }) => documento.faseCodigo === faseCodigo,
  );
}

/** Todas as exigências da árvore, de qualquer fase, com a posição de cada uma. */
export function exigenciasLocalizadas(
  exigencias: ExigenciasDoRascunho,
): readonly ExigenciaLocalizada[] {
  const achados: ExigenciaLocalizada[] = [];
  localizarExigencias(exigencias.raizes, { grupo: null, herdada: null }, achados);
  return achados;
}

/** Onde a descida da árvore está: o grupo que contém os nós e a repetição que ele impõe a eles. */
interface PosicaoNaArvore {
  readonly grupo: GrupoDaExigencia | null;
  readonly herdada: string | null;
}

function localizarExigencias(
  nos: readonly NoDeExigencia[],
  posicao: PosicaoNaArvore,
  achados: ExigenciaLocalizada[],
): void {
  for (const no of nos) {
    if (no.tipo === 'FOLHA') {
      if (no.documento !== null) {
        achados.push({
          documento: no.documento,
          grupo: posicao.grupo,
          repeticao: repeticaoDaFolha(no, posicao.herdada),
        });
      }
      continue;
    }

    const filhos = no.filhos ?? [];
    localizarExigencias(
      filhos,
      posicaoDentroDoGrupo({ ...no, tipo: no.tipo }, filhos.length, posicao),
      achados,
    );
  }
}

function posicaoDentroDoGrupo(
  grupo: Pick<NoDeExigencia, 'quantidadeMinima' | 'repetePorEntidade'> &
    Pick<GrupoDaExigencia, 'tipo'>,
  alternativas: number,
  fora: PosicaoNaArvore,
): PosicaoNaArvore {
  return {
    // Conta TODOS os filhos, não só as folhas: um grupo pode reunir outros grupos, e contar
    // só as folhas diretas diria "uma das 1 alternativas" onde há duas.
    grupo: { tipo: grupo.tipo, quantidadeMinima: grupo.quantidadeMinima, alternativas },
    herdada: fora.herdada ?? grupo.repetePorEntidade,
  };
}

function repeticaoDaFolha(
  folha: NoDeExigencia,
  herdada: string | null,
): RepeticaoDaExigencia | null {
  if (herdada !== null) return { grupo: herdada, herdada: true };
  return folha.repetePorEntidade === null
    ? null
    : { grupo: folha.repetePorEntidade, herdada: false };
}

/**
 * Os grupos que decidem sozinhos o resultado e estão sem norma resolvida.
 *
 * É o mesmo que a publicação confere: grupo `OU` com consequência própria precisa de ao menos
 * uma base legal resolvida, pela mesma razão que a exigência individual precisa. A tela não
 * edita grupo — eles chegam da configuração —, mas calar sobre a pendência faria a pessoa
 * descobrir no último passo, sem saber de qual grupo se trata.
 */
export function gruposSemNormaResolvida(
  exigencias: ExigenciasDoRascunho,
): readonly { readonly documentos: readonly string[]; readonly fases: readonly string[] }[] {
  return gruposQueDecidem(exigencias).filter((grupo) => !grupo.normaResolvida);
}

/**
 * Os grupos `OU` que decidem sozinhos o resultado (consequência própria), com os documentos e as
 * fases que reúnem e se têm norma resolvida.
 */
export function gruposQueDecidem(exigencias: ExigenciasDoRascunho): readonly {
  readonly documentos: readonly string[];
  readonly fases: readonly string[];
  readonly normaResolvida: boolean;
}[] {
  const decisivos: {
    documentos: readonly string[];
    fases: readonly string[];
    normaResolvida: boolean;
  }[] = [];

  const visitar = (nos: readonly NoDeExigencia[]): void => {
    for (const no of nos) {
      if (no.tipo === 'FOLHA') continue;

      if (no.tipo === 'OU' && (no.consequencia ?? '') !== '') {
        // Os documentos de TODA a subárvore, não só as folhas diretas: um grupo que reúne
        // outros grupos ficaria sem nome nenhum na mensagem, que é o oposto do que ela serve.
        const documentos = documentosDe(no.filhos ?? []);
        decisivos.push({
          documentos: documentos.map((documento) => documento.tipoDocumentoId),
          fases: [...new Set(documentos.map((documento) => documento.faseCodigo))],
          normaResolvida: temNormaResolvida(no.basesLegais ?? []),
        });
      }

      visitar(no.filhos ?? []);
    }
  };

  visitar(exigencias.raizes);
  return decisivos;
}

/**
 * As exigências declaradas na RAIZ da árvore — fora de qualquer grupo.
 *
 * É deste conjunto que sai o modelo ao espalhar um documento por todas as fases: copiar uma
 * folha de dentro de um grupo `OU` transformaria "um destes dois basta" em "este, sozinho,
 * obrigatório" nas demais fases — mudança de sentido que ninguém pediu.
 */
export function exigenciasDaRaiz(
  exigencias: ExigenciasDoRascunho,
): readonly ExigenciaDeDocumento[] {
  return exigencias.raizes
    .filter((no) => no.tipo === 'FOLHA' && no.documento !== null)
    .map((no) => no.documento as ExigenciaDeDocumento);
}

/** Todas as exigências da árvore, de qualquer fase. */
export function todasAsExigencias(
  exigencias: ExigenciasDoRascunho,
): readonly ExigenciaDeDocumento[] {
  return documentosDe(exigencias.raizes);
}

/** As exigências das folhas, em qualquer profundidade, na ordem da árvore. */
export function documentosDe(nos: readonly NoDeExigencia[]): readonly ExigenciaDeDocumento[] {
  return nos.flatMap((no) =>
    no.tipo === 'FOLHA'
      ? no.documento === null
        ? []
        : [no.documento]
      : documentosDe(no.filhos ?? []),
  );
}

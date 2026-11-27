import type { ProdutoDaFase } from '../../../processo-seletivo.models';
import type { MotivoNoDocumento } from '../../../shared/motivos/motivo-no-documento';

/** Um resultado que a regra pode apontar. */
export interface OpcaoDeResultado {
  readonly codigo: string;
  readonly nome: string;
  /** Falso quando o resultado apontado já não é publicação, com papel, desta fase. */
  readonly publicado: boolean;
}

/** Um motivo desfavorável que a condição pode apontar. */
export interface OpcaoDeMotivo {
  readonly codigo: string;
  readonly rotulo: string;
  /** Falso quando o motivo apontado deixou de estar entre os que a fase escolheu. */
  readonly escolhidoPelaFase: boolean;
}

/**
 * Os resultados que a regra oferece: as publicações da própria fase que têm papel, cada ato uma
 * vez, e o resultado já apontado que deixou de ser publicação da fase, ao fim e marcado, para a
 * pessoa vê-lo e trocá-lo em vez de o campo ficar em branco.
 */
export function opcoesDoResultado(
  produtos: readonly ProdutoDaFase[],
  apontado: string | null,
  nomeDoAto: (codigo: string) => string,
): readonly OpcaoDeResultado[] {
  const publicados = atosPublicadosComPapel(produtos);
  const opcoes = publicados.map((codigo) => ({ codigo, nome: nomeDoAto(codigo), publicado: true }));
  if (apontado === null || publicados.includes(apontado)) return opcoes;
  return [...opcoes, { codigo: apontado, nome: nomeDoAto(apontado), publicado: false }];
}

function atosPublicadosComPapel(produtos: readonly ProdutoDaFase[]): readonly string[] {
  const comPapel = produtos.filter((produto) => produto.papel !== null && produto.atoCodigo !== '');
  return [...new Set(comPapel.map((produto) => produto.atoCodigo))];
}

/**
 * Os motivos que a condição oferece: só os desfavoráveis que a fase escolheu para a homologação das
 * inscrições, e o motivo já apontado que a fase deixou de escolher, ao fim e marcado.
 */
export function opcoesDoMotivo(
  desfavoraveis: readonly MotivoNoDocumento[],
  apontado: string | null,
): readonly OpcaoDeMotivo[] {
  const escolhidos = desfavoraveis.map((motivo) => ({
    codigo: motivo.codigo,
    rotulo: motivo.descricao ?? motivo.codigo,
    escolhidoPelaFase: true,
  }));
  if (apontado === null || desfavoraveis.some((motivo) => motivo.codigo === apontado)) {
    return escolhidos;
  }
  return [...escolhidos, { codigo: apontado, rotulo: apontado, escolhidoPelaFase: false }];
}

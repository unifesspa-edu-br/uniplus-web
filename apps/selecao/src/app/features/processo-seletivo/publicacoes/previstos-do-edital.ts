import type {
  AtoDoProcessoDto,
  CampoDivulgacaoDto,
  ConfiguracaoDivulgacaoDto,
  EtapaComProdutosPrevistosDto,
  ProdutoPrevistoDto,
  ProdutosPrevistosDoProcessoDto,
} from '@uniplus/shared-data/selecao';

import { PAPEL_DEFINITIVO, PAPEL_PRELIMINAR } from '../steps/processo-seletivo.models';
import { atosQueAdmitemCorrecao } from './cadeia-de-correcao';

/** Uma etapa do cronograma e os itens que ela declara publicar. */
export interface EtapaDePrevistos {
  readonly id: string;
  readonly nome: string;
  readonly itens: readonly ProdutoPrevistoDto[];
}

/** Uma fase do cronograma, com os itens dela e os das suas etapas. */
export interface FaseDePrevistos {
  readonly id: string;
  readonly nome: string;
  readonly itens: readonly ProdutoPrevistoDto[];
  readonly etapas: readonly EtapaDePrevistos[];
}

/**
 * A política de divulgação do certame como a tela a mostra para o administrador confirmar: os
 * campos pelo nome, e não pelo código, e a justificativa quando a versão a registrou.
 */
export interface PoliticaParaConfirmar {
  readonly campos: readonly string[];
  readonly justificativa: string | null;
}

/**
 * Os itens que o edital declara, por fase e etapa, na ordem em que o servidor os devolve. Fase e
 * etapa sem item algum ficam de fora: não há o que publicar nelas. As etapas que não pertencem a
 * fase alguma formam um grupo à parte, para não sumirem da tela.
 */
export function fasesDePrevistos(
  consulta: ProdutosPrevistosDoProcessoDto,
  nomeDaFase: (codigo: string) => string,
  tituloDasEtapasSemFase: string,
): readonly FaseDePrevistos[] {
  const etapasDe = (etapas: readonly EtapaComProdutosPrevistosDto[]): readonly EtapaDePrevistos[] =>
    etapas
      .filter((etapa) => etapa.produtos.length > 0)
      .map((etapa) => ({ id: etapa.id, nome: etapa.nome, itens: etapa.produtos }));

  const fases = consulta.fases
    .map(
      (fase): FaseDePrevistos => ({
        id: fase.id,
        nome: nomeDaFase(fase.codigo),
        itens: fase.produtos,
        etapas: etapasDe(fase.etapas),
      }),
    )
    .filter((fase) => fase.itens.length > 0 || fase.etapas.length > 0);

  const etapasSemFase = etapasDe(consulta.etapasSemFase);
  return etapasSemFase.length === 0
    ? fases
    : [
        ...fases,
        { id: 'sem-fase', nome: tituloDasEtapasSemFase, itens: [], etapas: etapasSemFase },
      ];
}

/** O item é resultado quando o edital lhe dá papel: só o ato que não é resultado fica sem papel. */
export function ehResultado(item: Pick<ProdutoPrevistoDto, 'papel'>): boolean {
  return item.papel !== null;
}

/** O papel do item como a pessoa o lê. */
export function rotuloDoPapel(papel: string | null): string | null {
  switch (papel) {
    case PAPEL_PRELIMINAR:
      return 'Preliminar';
    case PAPEL_DEFINITIVO:
      return 'Definitivo';
    default:
      return null;
  }
}

/**
 * O ato que a correção do item aponta: a publicação mais recente da cadeia, desde que já esteja
 * registrada. `null` enquanto o item não foi publicado ou enquanto a última correção ainda
 * aguarda o registro — corrigir de novo antes disso apontaria um ato que já tem quem o corrija.
 *
 * Que o preliminar não se corrige depois do definitivo do ciclo dele a tela não decide: o servidor
 * recusa, e a recusa aparece no formulário.
 */
export function atoQueACorrecaoCorrige(item: ProdutoPrevistoDto): AtoDoProcessoDto | null {
  if (item.ato === null) return null;
  const cadeia = [item.ato, ...item.correcoes];
  return atosQueAdmitemCorrecao(cadeia, new Set<string>())[0] ?? null;
}

/** Traduz os códigos dos campos públicos da política para os nomes do vocabulário. */
export function politicaParaConfirmar(
  politica: ConfiguracaoDivulgacaoDto,
  campos: readonly CampoDivulgacaoDto[],
): PoliticaParaConfirmar {
  const nomes = new Map(campos.map((campo) => [campo.codigo, campo.nome]));
  const justificativa = politica.justificativa?.trim() ?? '';
  return {
    campos: politica.camposPublicos.map((codigo) => nomes.get(codigo) ?? codigo),
    justificativa: justificativa === '' ? null : justificativa,
  };
}

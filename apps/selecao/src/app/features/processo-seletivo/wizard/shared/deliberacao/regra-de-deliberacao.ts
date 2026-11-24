import {
  CriterioDeVotacaoCodigo,
  EncerramentoDaVotacaoCodigo,
  ModoDeDeliberacao,
} from '@uniplus/shared-data/selecao';

import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import { inteiroDoCampo } from '../numero-do-campo';

/** O campo da regra que o operador edita. */
export type CampoDaRegra = Exclude<keyof RegraDeDeliberacaoDaBanca, 'rotulos'>;

export function regraNova(modo: RegraDeDeliberacaoDaBanca['modo']): RegraDeDeliberacaoDaBanca {
  return normalizarRegra({
    modo,
    integrantes: '',
    suplentes: '0',
    quorum: '',
    criterio: null,
    desempate: null,
    encerramento: null,
    semUnanimidade: null,
  });
}

export const ehColegiada = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  regra.modo.codigo === ModoDeDeliberacao.colegiadaComVotacao;

export const modoConhecido = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  ehColegiada(regra) || regra.modo === ModoDeDeliberacao.atoIndividual;

const integrantesLidos = (regra: RegraDeDeliberacaoDaBanca): number | null =>
  inteiroDoCampo(regra.integrantes);

const ehMaioria = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  (regra.criterio !== null && regra.criterio.codigo === CriterioDeVotacaoCodigo.maioriaSimples) ||
  (regra.criterio !== null && regra.criterio.codigo === CriterioDeVotacaoCodigo.maioriaAbsoluta);

/** Com todos os titulares votando, o quórum é o número de integrantes: não se digita. */
export const quorumSegueOsIntegrantes = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  regra.encerramento !== null &&
  regra.encerramento.codigo === EncerramentoDaVotacaoCodigo.todosOsTitulares;

/** Só a maioria, com mais de um integrante, pode empatar. */
export const pedeDesempate = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  ehMaioria(regra) && (integrantesLidos(regra) ?? 0) > 1;

/** Só a unanimidade, com mais de um integrante, pode não ser alcançada. */
export const pedeResultadoSemUnanimidade = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  regra.criterio !== null &&
  regra.criterio.codigo === CriterioDeVotacaoCodigo.unanimidade &&
  (integrantesLidos(regra) ?? 0) > 1;

const CONTROLES_SEMPRE_A_VISTA: readonly CampoDaRegra[] = [
  'modo',
  'integrantes',
  'suplentes',
  'encerramento',
  'quorum',
  'criterio',
];

/**
 * Os controles que a tela mostra para a regra: sem regra só o modo; com regra, os fixos e o
 * desempate ou o resultado sem unanimidade quando o critério e os integrantes os pedem.
 */
export function controlesAVista(
  regra: RegraDeDeliberacaoDaBanca | null,
): ReadonlySet<CampoDaRegra> {
  if (regra === null || !modoConhecido(regra)) return new Set<CampoDaRegra>(['modo']);
  const condicionais: readonly CampoDaRegra[] = [
    ...(pedeDesempate(regra) ? (['desempate'] as const) : []),
    ...(pedeResultadoSemUnanimidade(regra) ? (['semUnanimidade'] as const) : []),
  ];
  return new Set([...CONTROLES_SEMPRE_A_VISTA, ...condicionais]);
}

/** Enquanto o número de integrantes não foi digitado, o que ele ainda pode permitir é mantido. */
const aindaPodeTerVarios = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  (integrantesLidos(regra) ?? 2) > 1;

/**
 * Deixa vazio o que o critério e o número de integrantes não pedem, e iguala o quórum aos
 * integrantes quando todos os titulares votam. Roda a cada edição: a regra nunca fica com um campo
 * que a API recusaria por não se aplicar.
 */
export function normalizarRegra(regra: RegraDeDeliberacaoDaBanca): RegraDeDeliberacaoDaBanca {
  const varios = aindaPodeTerVarios(regra);
  return {
    ...regra,
    quorum: quorumNormalizado(regra),
    desempate: varios && ehMaioria(regra) ? regra.desempate : null,
    semUnanimidade:
      varios &&
      regra.criterio !== null &&
      regra.criterio.codigo === CriterioDeVotacaoCodigo.unanimidade
        ? regra.semUnanimidade
        : null,
  };
}

function quorumNormalizado(regra: RegraDeDeliberacaoDaBanca): string {
  return quorumSegueOsIntegrantes(regra) ? regra.integrantes : regra.quorum;
}

/** Muda um campo e devolve a regra coerente. */
export function alterarRegra<K extends CampoDaRegra>(
  regra: RegraDeDeliberacaoDaBanca,
  campo: K,
  valor: RegraDeDeliberacaoDaBanca[K],
): RegraDeDeliberacaoDaBanca {
  return normalizarRegra({ ...regra, [campo]: valor });
}

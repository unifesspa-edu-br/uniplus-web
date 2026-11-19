import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';

import type {
  CriterioDaVotacao,
  DesempateDaVotacao,
  EncerramentoDaVotacao,
  RegraDeDeliberacaoDaBanca,
  ResultadoSemUnanimidade,
} from '../../modelos/deliberacao.models';
import { inteiroDoCampo } from '../numero-do-campo';

export interface OpcaoDaRegra<T extends string> {
  readonly valor: T;
  readonly rotulo: string;
}

export const MODOS_DE_DELIBERACAO: readonly OpcaoDaRegra<ModoDeDeliberacao>[] = [
  { valor: ModoDeDeliberacao.colegiadaComVotacao, rotulo: 'Colegiada, com votação' },
  { valor: ModoDeDeliberacao.atoIndividual, rotulo: 'Ato individual, sem votação' },
];

export const CRITERIOS_DE_VOTACAO: readonly OpcaoDaRegra<CriterioDaVotacao>[] = [
  { valor: 'maioriaSimples', rotulo: 'Maioria simples' },
  { valor: 'maioriaAbsoluta', rotulo: 'Maioria absoluta' },
  { valor: 'unanimidade', rotulo: 'Unanimidade' },
];

export const DESEMPATES_DA_VOTACAO: readonly OpcaoDaRegra<DesempateDaVotacao>[] = [
  { valor: 'votoDaPresidencia', rotulo: 'Voto da presidência' },
  { valor: 'novaVotacao', rotulo: 'Nova votação' },
];

export const ENCERRAMENTOS_DA_VOTACAO: readonly OpcaoDaRegra<EncerramentoDaVotacao>[] = [
  { valor: 'todosOsTitulares', rotulo: 'Todos os titulares votam' },
  { valor: 'presidenciaNoQuorum', rotulo: 'A presidência encerra ao atingir o quórum' },
];

export const RESULTADOS_SEM_UNANIMIDADE: readonly OpcaoDaRegra<ResultadoSemUnanimidade>[] = [
  { valor: 'favoravel', rotulo: 'Favorável' },
  { valor: 'desfavoravel', rotulo: 'Desfavorável' },
  { valor: 'novaVotacao', rotulo: 'Nova votação' },
];

/** O campo da regra que o operador edita. */
export type CampoDaRegra = keyof RegraDeDeliberacaoDaBanca;

export function regraNova(modo: ModoDeDeliberacao): RegraDeDeliberacaoDaBanca {
  return normalizarRegra({
    modo,
    integrantes: '',
    suplentes: '0',
    quorum: '',
    criterio: '',
    desempate: '',
    encerramento: '',
    semUnanimidade: '',
  });
}

export const ehColegiada = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  regra.modo === ModoDeDeliberacao.colegiadaComVotacao;

const integrantesLidos = (regra: RegraDeDeliberacaoDaBanca): number | null =>
  inteiroDoCampo(regra.integrantes);

const ehMaioria = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  regra.criterio === 'maioriaSimples' || regra.criterio === 'maioriaAbsoluta';

/** Com todos os titulares votando, o quórum é o número de integrantes: não se digita. */
export const quorumSegueOsIntegrantes = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  ehColegiada(regra) && regra.encerramento === 'todosOsTitulares';

/** Só a maioria, com mais de um integrante, pode empatar. */
export const pedeDesempate = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  ehColegiada(regra) && ehMaioria(regra) && (integrantesLidos(regra) ?? 0) > 1;

/** Só a unanimidade, com mais de um integrante, pode não ser alcançada. */
export const pedeResultadoSemUnanimidade = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  ehColegiada(regra) && regra.criterio === 'unanimidade' && (integrantesLidos(regra) ?? 0) > 1;

/** Enquanto o número de integrantes não foi digitado, o que ele ainda pode permitir é mantido. */
const aindaPodeTerVarios = (regra: RegraDeDeliberacaoDaBanca): boolean =>
  (integrantesLidos(regra) ?? 2) > 1;

/**
 * Deixa vazio o que o modo, o critério e o número de integrantes não pedem, e iguala o quórum aos
 * integrantes quando todos os titulares votam. Roda a cada edição: a regra nunca fica com um campo
 * que a API recusaria por não se aplicar.
 */
export function normalizarRegra(regra: RegraDeDeliberacaoDaBanca): RegraDeDeliberacaoDaBanca {
  const colegiada = ehColegiada(regra);
  const varios = colegiada && aindaPodeTerVarios(regra);
  return {
    ...regra,
    quorum: quorumNormalizado(regra),
    criterio: colegiada ? regra.criterio : '',
    encerramento: colegiada ? regra.encerramento : '',
    desempate: varios && ehMaioria(regra) ? regra.desempate : '',
    semUnanimidade: varios && regra.criterio === 'unanimidade' ? regra.semUnanimidade : '',
  };
}

function quorumNormalizado(regra: RegraDeDeliberacaoDaBanca): string {
  if (!ehColegiada(regra)) return '';
  return quorumSegueOsIntegrantes(regra) ? regra.integrantes : regra.quorum;
}

/** Muda um campo e devolve a regra coerente. */
export function alterarRegra(
  regra: RegraDeDeliberacaoDaBanca,
  campo: CampoDaRegra,
  valor: string,
): RegraDeDeliberacaoDaBanca {
  return normalizarRegra({ ...regra, [campo]: valor });
}

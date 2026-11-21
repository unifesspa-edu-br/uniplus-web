import type { ExigenciasDaFase } from '../../shared/descricao-da-fase';
import {
  controleDoRecurso,
  type ControleDoRecurso,
} from '../../shared/recusas/controle-do-recurso';
import type { LocalDaRecusa } from '../../shared/recusas/local-da-recusa';
import type { CampoDaFase } from './configuracao-da-fase';

/** O campo das recusas que a fase recebe mas a tela não mostra num controle: ficam no topo da fase. */
export const NO_TOPO_DA_FASE = '';

/** Um controle da regra de recurso da fase, que a recusa do servidor aponta campo a campo. */
export type CampoDoRecursoDaFase = `recurso.${ControleDoRecurso}`;

/**
 * Onde a recusa do servidor aparece: os campos que a conferência local já nomeia, mais os que só o
 * servidor recusa. `recurso` é a regra de recurso inteira, para a recusa que não aponta um
 * controle dela, e `NO_TOPO_DA_FASE` é a fase inteira ou um campo dela que a tela mostra sem
 * controle de recusa.
 */
export type CampoDaRecusaDaFase =
  | typeof NO_TOPO_DA_FASE
  | CampoDaFase
  | CampoDoRecursoDaFase
  | 'inicio'
  | 'fim'
  | 'unidadeResponsavelId'
  | 'recurso';

const CAMPOS_DA_FASE: ReadonlyMap<string, CampoDaRecusaDaFase> = new Map(
  (
    [
      'inicio',
      'fim',
      'unidadeResponsavelId',
      'produtos',
      'emiteParecerIndividual',
      'bancasRequeridas',
    ] as const
  ).map((campo) => [campo.toLowerCase(), campo]),
);

/**
 * Os campos da própria fase que a tela mostra mas não liga a um controle de recusa: a recusa a
 * eles fica no topo da fase. O que não está aqui nem entre os campos com controle não é campo da
 * fase, e a recusa vai ao resumo do passo.
 */
const CAMPOS_NO_TOPO_DA_FASE: ReadonlySet<string> = new Set(
  ['ordem', 'faseCanonicaId', 'noMesmoMomentoDaAnterior', 'tiposDeDecisao'].map((campo) =>
    campo.toLowerCase(),
  ),
);

/** O que a regra de recurso tem sem controle de recusa: a recusa fica na regra inteira. */
const CAMPOS_DA_REGRA_SEM_CONTROLE: ReadonlySet<string> = new Set(['procedimentosderecurso']);

/**
 * O campo da fase sob o qual a recusa do servidor aparece. `NO_TOPO_DA_FASE` é a fase inteira ou
 * um campo dela que a tela mostra sem controle de recusa; `null` é o caminho que a fase não
 * conhece, ou que não se lê, e a recusa vai ao resumo do passo.
 */
export function campoDaRecusaDaFase(local: LocalDaRecusa): CampoDaRecusaDaFase | null {
  if (local.dono !== 'fase' || local.caminho === null) return null;
  const [primeiro, segundo = ''] = local.caminho.split('.');
  const chave = primeiro.toLowerCase();
  if (chave === 'regrarecurso') return campoDoRecurso(segundo);
  if (chave === '' || CAMPOS_NO_TOPO_DA_FASE.has(chave)) return NO_TOPO_DA_FASE;
  return CAMPOS_DA_FASE.get(chave) ?? null;
}

/** O campo da regra de recurso; o campo que ela não tem é `null`. */
function campoDoRecurso(campo: string): CampoDaRecusaDaFase | null {
  const controle = controleDoRecurso(campo);
  if (controle !== null) return `recurso.${controle}`;
  const daRegraInteira = campo === '' || CAMPOS_DA_REGRA_SEM_CONTROLE.has(campo.toLowerCase());
  return daRegraInteira ? 'recurso' : null;
}

/**
 * O Fim da fase está à vista: o período é obrigatório, a publicação exige o Fim, ou há Fim ou
 * recusa a ele. O Fim que existe nunca fica escondido, nem na fase que a tela não sabe descrever.
 */
export function fimDaFaseNaTela(
  exigencias: ExigenciasDaFase | null,
  haFimOuRecusa: boolean,
): boolean {
  return (
    haFimOuRecusa || exigencias?.janelaObrigatoria === true || exigencias?.fimObrigatorio === true
  );
}

/**
 * O campo da linha do tempo da fase tem controle na tela. A fase que a tela não sabe descrever não
 * mostra a unidade nem o início: só existem quando se sabe o que a fase exige. O início aparece só
 * com o período obrigatório. O Fim tem sempre onde receber a recusa, porque `fimDaFaseNaTela` o
 * mostra quando há recusa a ele, mesmo sem saber o que a fase exige. Os demais campos da fase têm
 * controle sempre que a fase está aberta.
 */
export function campoNaTela(campo: string, exigencias: ExigenciasDaFase | null): boolean {
  if (campo === 'unidadeResponsavelId') return exigencias !== null;
  if (campo === 'inicio') return exigencias?.janelaObrigatoria === true;
  return true;
}

import type { ExigenciasDaFase } from '../../shared/descricao-da-fase';
import type { LocalDaRecusa } from '../../shared/recusas/local-da-recusa';
import type { CampoDaFase } from './configuracao-da-fase';

/**
 * Onde a recusa do servidor aparece: os campos que a conferência local já nomeia, mais os que só o
 * servidor recusa. `recurso` é a regra de recurso inteira, para a recusa que não aponta um
 * controle dela.
 */
export type CampoDaRecusaDaFase =
  | CampoDaFase
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

const CAMPOS_DO_RECURSO: ReadonlyMap<string, CampoDaRecusaDaFase> = new Map([
  ['regracodigo', 'recurso.regra'],
  ['regraversao', 'recurso.regra'],
  ['prazovalor', 'recurso.prazo'],
  ['prazounidade', 'recurso.prazo'],
  ['atoancoracodigo', 'recurso.ancora'],
  ['admiteinstanciasuperior', 'recurso.admiteInstanciaSuperior'],
]);

const SUSPENSIVIDADE_DA_PRIMEIRA = 'suspensividadeprimeirainstancia';
const SUSPENSIVIDADE_DA_SEGUNDA = 'suspensividadesegundainstancia';

/**
 * O campo da fase sob o qual a recusa do servidor aparece, ou `null` quando o caminho não aponta
 * um campo que a tela mostra e a recusa fica no topo da fase.
 */
export function campoDaRecusaDaFase(local: LocalDaRecusa): CampoDaRecusaDaFase | null {
  if (local.dono !== 'fase') return null;
  const [primeiro, segundo = ''] = (local.caminho ?? '').split('.');
  const chave = primeiro.toLowerCase();
  if (chave !== 'regrarecurso') return CAMPOS_DA_FASE.get(chave) ?? null;
  return campoDoRecurso(segundo.toLowerCase());
}

function campoDoRecurso(chave: string): CampoDaRecusaDaFase {
  if (chave.startsWith(SUSPENSIVIDADE_DA_PRIMEIRA))
    return 'recurso.suspensividadePrimeiraInstancia';
  if (chave.startsWith(SUSPENSIVIDADE_DA_SEGUNDA)) return 'recurso.suspensividadeSegundaInstancia';
  return CAMPOS_DO_RECURSO.get(chave) ?? 'recurso';
}

/**
 * O campo da linha do tempo da fase tem controle na tela. A unidade responsável só aparece quando
 * a tela sabe o que a fase exige, e o início e o fim só quando o período é obrigatório; os demais
 * campos da fase têm controle sempre que a fase está aberta.
 */
export function campoNaTela(campo: string, exigencias: ExigenciasDaFase | null): boolean {
  if (campo === 'unidadeResponsavelId') return exigencias !== null;
  if (campo === 'inicio' || campo === 'fim') return exigencias?.janelaObrigatoria === true;
  return true;
}

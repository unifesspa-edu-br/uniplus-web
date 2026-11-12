import { PERMISSAO, type CodigoDePermissao } from '@uniplus/shared-auth/bootstrap';
import type { ItemDaRevisaoDto, RevisaoDeAcessosDto } from '@uniplus/shared-data/autorizacao';

const { autorizacao } = PERMISSAO;

/**
 * A permissão que decide o item, por quem o decide (ADR-0162): o Representante do controlador
 * decide os itens comuns, e a gestão de acessos, os de quem é Representante. Quem só consulta
 * (`autorizacao:revisoes:consultar`) não tem nenhuma delas.
 */
const PERMISSAO_QUE_DECIDE: Readonly<Record<string, CodigoDePermissao | undefined>> = {
  'representante-do-controlador': autorizacao.revisoesConduzir,
  'gestor-de-acessos': autorizacao.revisoesReverProtecaoDeDados,
};

/** As permissões efetivas de quem lê a revisão. */
export interface QuemLe {
  readonly tem: (codigo: CodigoDePermissao) => boolean;
}

/** Os itens de um mesmo beneficiário, na ordem em que a revisão os trouxe. */
export interface ItensDoBeneficiario {
  readonly chave: string;
  readonly nome: string;
  readonly itens: readonly ItemDaRevisaoDto[];
}

const SEM_NOME = 'Pessoa não identificada';

/**
 * Confirmar e revogar valem só no item pendente de revisão aberta, quando quem lê tem a permissão
 * de quem decide o item e o item não é dele (`ehDoLeitor`, que a API calcula): ninguém decide a
 * própria concessão. A API confere de novo e recusa o que mudou entre a leitura e a decisão.
 */
export function decideOItem(
  revisao: RevisaoDeAcessosDto,
  item: ItemDaRevisaoDto,
  quemLe: QuemLe,
): boolean {
  if (revisao.situacao !== 'em_andamento' || item.situacao !== 'pendente') return false;
  if (item.ehDoLeitor) return false;
  const exigida = PERMISSAO_QUE_DECIDE[item.decide];
  return exigida !== undefined && quemLe.tem(exigida);
}

/** A mesma pessoa é o mesmo `sub` no mesmo emissor. */
function chaveDoBeneficiario(item: ItemDaRevisaoDto): string {
  return `${item.beneficiario.emissor}|${item.beneficiario.sub}`;
}

function agrupar(itens: readonly ItemDaRevisaoDto[]): Map<string, ItemDaRevisaoDto[]> {
  const grupos = new Map<string, ItemDaRevisaoDto[]>();
  for (const item of itens) {
    const chave = chaveDoBeneficiario(item);
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }
  return grupos;
}

/** A revisão organizada por beneficiário, em ordem alfabética do nome. */
export function porBeneficiario(
  itens: readonly ItemDaRevisaoDto[],
): readonly ItensDoBeneficiario[] {
  return [...agrupar(itens)]
    .map(([chave, doGrupo]) => ({
      chave,
      nome: doGrupo[0]?.beneficiario.nome ?? SEM_NOME,
      itens: doGrupo,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

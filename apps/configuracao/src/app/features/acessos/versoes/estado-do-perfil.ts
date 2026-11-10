import type { PerfilDto, PerfilListadoDto } from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

/** O que decide as situações e as ações de um perfil, igual para o resumo da lista e para o detalhe. */
export interface ResumoDoPerfil {
  readonly ativo: boolean;
  readonly governanca: boolean;
  readonly temVigente: boolean;
  readonly temPendente: boolean;
  /** A lista não traz a janela; só o detalhe sabe. */
  readonly emJanelaDeMigracao: boolean;
  /** Desde quando o acesso das concessões do perfil está bloqueado; `null` sem suspensão. */
  readonly suspensoDesde: string | null;
  /** Desde quando o perfil não aceita pedido nem versão nova; `null` enquanto ativo. */
  readonly desativadoDesde: string | null;
}

export interface SituacaoDoPerfil {
  readonly texto: string;
  readonly variante: UiTagVariant;
  /** O instante em que o perfil entrou na situação, quando a API o informa. */
  readonly desde?: string;
}

export interface AcoesDoPerfil {
  readonly proporVersao: boolean;
  readonly removerPermissoes: boolean;
  readonly cancelarVersaoPendente: boolean;
  readonly desativar: boolean;
  readonly reativar: boolean;
}

/** O que a pessoa que lê pode fazer na contenção do perfil, pelas permissões dela. */
export interface PermissoesDaContencao {
  readonly gestaoDeAcessos: boolean;
  readonly protecaoDeDados: boolean;
}

export function resumoDoPerfil(perfil: PerfilDto | PerfilListadoDto): ResumoDoPerfil {
  const comum = {
    ativo: perfil.ativo,
    governanca: perfil.governanca !== null,
    suspensoDesde: perfil.suspensao?.desde ?? null,
    desativadoDesde: perfil.desativadoDesde,
  };
  return 'temVersaoVigente' in perfil
    ? {
        ...comum,
        temVigente: perfil.temVersaoVigente,
        temPendente: perfil.temVersaoPendente,
        emJanelaDeMigracao: false,
      }
    : {
        ...comum,
        temVigente: perfil.composicaoEmVigor !== null,
        temPendente: perfil.versaoPendente !== null,
        emJanelaDeMigracao: perfil.janela != null,
      };
}

/** As situações que o perfil mostra juntas: a suspensão e a desativação são independentes. */
export function situacoesDoPerfil(perfil: ResumoDoPerfil): readonly SituacaoDoPerfil[] {
  if (perfil.governanca) return [perfil.ativo ? ATIVO : desativado(perfil)];
  return [
    ...(perfil.suspensoDesde === null ? [] : [{ ...SUSPENSO, desde: perfil.suspensoDesde }]),
    ...(perfil.ativo ? [] : [desativado(perfil)]),
    perfil.temVigente ? EM_VIGOR : SEM_VERSAO_EM_VIGOR,
    ...(perfil.temPendente ? [VERSAO_PENDENTE] : []),
    ...(perfil.emJanelaDeMigracao ? [EM_JANELA_DE_MIGRACAO] : []),
  ];
}

const ATIVO: SituacaoDoPerfil = { texto: 'Ativo', variante: 'success' };
const DESATIVADO: SituacaoDoPerfil = { texto: 'Desativado', variante: 'neutral' };
const SUSPENSO: SituacaoDoPerfil = { texto: 'Suspenso', variante: 'danger' };
const EM_VIGOR: SituacaoDoPerfil = { texto: 'Em vigor', variante: 'success' };
const SEM_VERSAO_EM_VIGOR: SituacaoDoPerfil = { texto: 'Sem versão em vigor', variante: 'warning' };
const VERSAO_PENDENTE: SituacaoDoPerfil = { texto: 'Versão pendente', variante: 'info' };
const EM_JANELA_DE_MIGRACAO: SituacaoDoPerfil = {
  texto: 'Janela de migração aberta',
  variante: 'warning',
};

function desativado(perfil: ResumoDoPerfil): SituacaoDoPerfil {
  return perfil.desativadoDesde === null
    ? DESATIVADO
    : { ...DESATIVADO, desde: perfil.desativadoDesde };
}

/**
 * O perfil de governança não tem versão nem situação para mudar: a composição dele muda por
 * migration. Com a janela de migração aberta o perfil não aceita versão nova, mas a remoção segue.
 */
export function acoesDoPerfil(
  perfil: ResumoDoPerfil,
  permissoes: PermissoesDaContencao,
): AcoesDoPerfil {
  if (perfil.governanca) return SEM_ACOES;
  return {
    proporVersao: perfil.ativo && !perfil.temPendente && !perfil.emJanelaDeMigracao,
    removerPermissoes: perfil.ativo && perfil.temVigente,
    cancelarVersaoPendente: perfil.temPendente,
    desativar: perfil.ativo && permissoes.gestaoDeAcessos,
    reativar: !perfil.ativo && permissoes.gestaoDeAcessos,
  };
}

const SEM_ACOES: AcoesDoPerfil = {
  proporVersao: false,
  removerPermissoes: false,
  cancelarVersaoPendente: false,
  desativar: false,
  reativar: false,
};

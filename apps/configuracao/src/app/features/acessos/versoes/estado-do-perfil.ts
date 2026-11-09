import type { PerfilDto, PerfilListadoDto } from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

/** O que decide as situações e as ações de um perfil, igual para o resumo da lista e para o detalhe. */
export interface ResumoDoPerfil {
  readonly ativo: boolean;
  readonly governanca: boolean;
  readonly temVigente: boolean;
  readonly temPendente: boolean;
}

export interface SituacaoDoPerfil {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

export interface AcoesDoPerfil {
  readonly proporVersao: boolean;
  readonly removerPermissoes: boolean;
  readonly cancelarVersaoPendente: boolean;
  readonly desativar: boolean;
  readonly reativar: boolean;
}

export function resumoDoPerfil(perfil: PerfilDto | PerfilListadoDto): ResumoDoPerfil {
  const governanca = perfil.governanca !== null;
  return 'temVersaoVigente' in perfil
    ? {
        ativo: perfil.ativo,
        governanca,
        temVigente: perfil.temVersaoVigente,
        temPendente: perfil.temVersaoPendente,
      }
    : {
        ativo: perfil.ativo,
        governanca,
        temVigente: perfil.composicaoEmVigor !== null,
        temPendente: perfil.versaoPendente !== null,
      };
}

/**
 * As situações que o perfil mostra juntas. A suspensão entra aqui como mais uma, ao lado das de
 * hoje, sem mexer nas demais.
 */
export function situacoesDoPerfil(perfil: ResumoDoPerfil): readonly SituacaoDoPerfil[] {
  if (perfil.governanca) return [perfil.ativo ? ATIVO : DESATIVADO];
  return [
    ...(perfil.ativo ? [] : [DESATIVADO]),
    perfil.temVigente ? EM_VIGOR : SEM_VERSAO_EM_VIGOR,
    ...(perfil.temPendente ? [VERSAO_PENDENTE] : []),
  ];
}

const ATIVO: SituacaoDoPerfil = { texto: 'Ativo', variante: 'success' };
const DESATIVADO: SituacaoDoPerfil = { texto: 'Desativado', variante: 'neutral' };
const EM_VIGOR: SituacaoDoPerfil = { texto: 'Em vigor', variante: 'success' };
const SEM_VERSAO_EM_VIGOR: SituacaoDoPerfil = { texto: 'Sem versão em vigor', variante: 'warning' };
const VERSAO_PENDENTE: SituacaoDoPerfil = { texto: 'Versão pendente', variante: 'info' };

/** O perfil de governança não tem versão nem situação para mudar: a composição dele muda por migration. */
export function acoesDoPerfil(perfil: ResumoDoPerfil): AcoesDoPerfil {
  const comum = !perfil.governanca;
  return {
    proporVersao: comum && perfil.ativo && !perfil.temPendente,
    removerPermissoes: comum && perfil.ativo && perfil.temVigente,
    cancelarVersaoPendente: comum && perfil.temPendente,
    desativar: comum && perfil.ativo,
    reativar: comum && !perfil.ativo,
  };
}

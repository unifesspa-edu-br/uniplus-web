import type { EtapaDaVersao, PerfilDto, PerfilListadoDto } from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

/** O que decide as situações de um perfil, igual para o resumo da lista e para o detalhe. */
export interface ResumoDoPerfil {
  readonly ativo: boolean;
  readonly governanca: boolean;
  readonly temVigente: boolean;
  readonly temPendente: boolean;
  /** Desde quando o acesso das concessões do perfil está bloqueado; `null` sem suspensão. */
  readonly suspensoDesde: string | null;
  /** Desde quando o perfil não aceita pedido nem versão nova; `null` enquanto ativo. */
  readonly desativadoDesde: string | null;
  /** As etapas da retomada que a suspensão exige agora e ainda não foram decididas. */
  readonly etapasDaRetomadaPorDecidir: readonly string[];
}

/** O resumo do detalhe: só ele sabe se há janela de migração, que a lista não informa. */
export interface ResumoDoDetalheDoPerfil extends ResumoDoPerfil {
  readonly emJanelaDeMigracao: boolean;
}

export interface SituacaoDoPerfil {
  readonly texto: string;
  readonly variante: UiTagVariant;
  /** O instante em que o perfil entrou na situação, quando a API o informa. */
  readonly desde?: string;
}

export interface AcoesDoPerfil {
  readonly suspender: boolean;
  /** As etapas da retomada que a pessoa pode decidir agora, pelas permissões dela. */
  readonly retomar: readonly EtapaDaVersao[];
  readonly proporVersao: boolean;
  readonly removerPermissoes: boolean;
  readonly cancelarVersaoPendente: boolean;
  readonly enviarDocumento: boolean;
  readonly desativar: boolean;
  readonly reativar: boolean;
}

/** O que a pessoa que lê pode fazer na contenção do perfil, pelas permissões dela. */
export interface PermissoesDaContencao {
  readonly gestaoDeAcessos: boolean;
  readonly protecaoDeDados: boolean;
}

type ParteComum = Pick<PerfilDto, 'ativo' | 'governanca' | 'suspensao' | 'desativadoDesde'>;

function resumoComum(perfil: ParteComum) {
  return {
    ativo: perfil.ativo,
    governanca: perfil.governanca !== null,
    suspensoDesde: perfil.suspensao?.desde ?? null,
    desativadoDesde: perfil.desativadoDesde,
    etapasDaRetomadaPorDecidir: etapasPorDecidir(perfil.suspensao),
  };
}

export function resumoDaLista(perfil: PerfilListadoDto): ResumoDoPerfil {
  return {
    ...resumoComum(perfil),
    temVigente: perfil.temVersaoVigente,
    temPendente: perfil.temVersaoPendente,
  };
}

export function resumoDoDetalhe(perfil: PerfilDto): ResumoDoDetalheDoPerfil {
  return {
    ...resumoComum(perfil),
    temVigente: perfil.composicaoEmVigor !== null,
    temPendente: perfil.versaoPendente !== null,
    emJanelaDeMigracao: perfil.janela != null,
  };
}

function etapasPorDecidir(suspensao: PerfilDto['suspensao']): readonly string[] {
  if (suspensao === null) return [];
  return suspensao.etapasExigidasAgora.filter(
    (etapa) => !suspensao.etapasDecididas.includes(etapa),
  );
}

/** As situações que o perfil mostra juntas: a suspensão e a desativação são independentes. */
export function situacoesDoPerfil(perfil: ResumoDoPerfil): readonly SituacaoDoPerfil[] {
  if (perfil.governanca) return [perfil.ativo ? ATIVO : desativado(perfil)];
  return [
    ...(perfil.suspensoDesde === null ? [] : [{ ...SUSPENSO, desde: perfil.suspensoDesde }]),
    ...(perfil.ativo ? [] : [desativado(perfil)]),
    perfil.temVigente ? EM_VIGOR : SEM_VERSAO_EM_VIGOR,
    ...(perfil.temPendente ? [VERSAO_PENDENTE] : []),
    ...('emJanelaDeMigracao' in perfil && perfil.emJanelaDeMigracao ? [EM_JANELA_DE_MIGRACAO] : []),
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
  perfil: ResumoDoDetalheDoPerfil,
  permissoes: PermissoesDaContencao,
): AcoesDoPerfil {
  if (perfil.governanca) return SEM_ACOES;
  return {
    ...acoesDeManutencao(perfil, permissoes.gestaoDeAcessos),
    retomar: etapasDaRetomada(perfil, permissoes),
    suspender:
      perfil.suspensoDesde === null && (permissoes.gestaoDeAcessos || permissoes.protecaoDeDados),
    desativar: perfil.ativo && permissoes.gestaoDeAcessos,
    reativar: !perfil.ativo && permissoes.gestaoDeAcessos,
  };
}

/** A manutenção do perfil é só de quem mantém perfis; quem apenas aprova não a vê. */
function acoesDeManutencao(
  perfil: ResumoDoDetalheDoPerfil,
  podeManter: boolean,
): Pick<
  AcoesDoPerfil,
  'proporVersao' | 'removerPermissoes' | 'cancelarVersaoPendente' | 'enviarDocumento'
> {
  return {
    proporVersao: podeManter && perfil.ativo && !perfil.temPendente && !perfil.emJanelaDeMigracao,
    removerPermissoes: podeManter && perfil.ativo && perfil.temVigente,
    cancelarVersaoPendente: podeManter && perfil.temPendente,
    enviarDocumento: podeManter && perfil.temPendente,
  };
}

const SEM_ACOES: AcoesDoPerfil = {
  suspender: false,
  retomar: [],
  proporVersao: false,
  removerPermissoes: false,
  cancelarVersaoPendente: false,
  enviarDocumento: false,
  desativar: false,
  reativar: false,
};

function etapasDaRetomada(
  perfil: ResumoDoPerfil,
  permissoes: PermissoesDaContencao,
): readonly EtapaDaVersao[] {
  const decidiveis: readonly EtapaDaVersao[] = [
    ...(permissoes.gestaoDeAcessos ? (['gestao_de_acessos'] as const) : []),
    ...(permissoes.protecaoDeDados ? (['protecao_de_dados'] as const) : []),
  ];
  return decidiveis.filter((etapa) => perfil.etapasDaRetomadaPorDecidir.includes(etapa));
}

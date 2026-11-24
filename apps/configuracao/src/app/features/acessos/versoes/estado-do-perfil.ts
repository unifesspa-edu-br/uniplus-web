import {
  SituacaoDoAcessoDoPerfilCodigo,
  type EtapaDaVersao,
  type PerfilDto,
  type PerfilListadoDto,
  type SituacaoDoAcessoDoPerfilDto,
} from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant, VariantesDosCodigos } from '@uniplus/shared-ui/components';

/** O que decide as situações de um perfil, igual para o resumo da lista e para o detalhe. */
export interface ResumoDoPerfil {
  readonly ativo: boolean;
  readonly governanca: boolean;
  /** A situação do acesso do perfil, calculada pela API: o rótulo é dela e o código só escolhe a cor. */
  readonly situacaoDoAcesso: SituacaoDoAcessoDoPerfilDto;
  readonly temPendente: boolean;
  /** Desde quando o acesso das concessões do perfil está bloqueado; `null` sem suspensão. */
  readonly suspensoDesde: string | null;
  /** Desde quando o perfil não aceita pedido nem versão nova; `null` enquanto ativo. */
  readonly desativadoDesde: string | null;
  /** As etapas da retomada que a suspensão exige agora e ainda não foram decididas. */
  readonly etapasDaRetomadaPorDecidir: readonly string[];
}

/** O resumo do detalhe: só ele sabe se há versão em vigor e janela de migração, que a lista não informa. */
export interface ResumoDoDetalheDoPerfil extends ResumoDoPerfil {
  readonly temVigente: boolean;
  readonly emJanelaDeMigracao: boolean;
}

export interface EtiquetaDoPerfil {
  readonly texto: string;
  readonly variante: UiTagVariant;
  /** O instante em que o perfil entrou na situação, quando a tela o mostra. */
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

type ParteComum = Pick<
  PerfilDto,
  'ativo' | 'governanca' | 'situacaoDoAcesso' | 'suspensao' | 'desativadoDesde'
>;

function resumoComum(perfil: ParteComum) {
  return {
    ativo: perfil.ativo,
    governanca: perfil.governanca !== null,
    situacaoDoAcesso: perfil.situacaoDoAcesso,
    suspensoDesde: perfil.suspensao?.desde ?? null,
    desativadoDesde: perfil.desativadoDesde,
    etapasDaRetomadaPorDecidir: etapasPorDecidir(perfil.suspensao),
  };
}

export function resumoDaLista(perfil: PerfilListadoDto): ResumoDoPerfil {
  return {
    ...resumoComum(perfil),
    temPendente: perfil.temVersaoPendente,
  };
}

export function resumoDoDetalhe(perfil: PerfilDto): ResumoDoDetalheDoPerfil {
  return {
    ...resumoComum(perfil),
    temVigente: perfil.composicaoEmVigor !== null,
    temPendente: perfil.versaoPendente !== null,
    emJanelaDeMigracao: perfil.revisaoDasConcessoes != null,
  };
}

function etapasPorDecidir(suspensao: PerfilDto['suspensao']): readonly string[] {
  if (suspensao === null) return [];
  return suspensao.etapasExigidasAgora.filter(
    (etapa) => !suspensao.etapasDecididas.includes(etapa),
  );
}

/** A cor de cada situação do acesso; o rótulo da etiqueta é o que a API devolve. */
export const VARIANTES_DO_ACESSO: VariantesDosCodigos<SituacaoDoAcessoDoPerfilCodigo> = {
  [SituacaoDoAcessoDoPerfilCodigo.SUSPENSO]: 'danger',
  [SituacaoDoAcessoDoPerfilCodigo.EM_VIGOR]: 'success',
  [SituacaoDoAcessoDoPerfilCodigo.SEM_VERSAO_EM_VIGOR]: 'warning',
};
const JANELA_DE_MIGRACAO: EtiquetaDoPerfil = {
  texto: 'Janela de migração aberta',
  variante: 'warning',
};

/**
 * As etiquetas que o web monta de estados do perfil que a API entrega como booleano ou data, sem
 * código nem rótulo, como a desativação. A situação do acesso fica de fora: vem da API com código
 * e rótulo e é independente da desativação, então a lista e o detalhe mostram a situação do
 * acesso e, depois, estas.
 */
export function etiquetasDoPerfil(perfil: ResumoDoPerfil): readonly EtiquetaDoPerfil[] {
  return perfil.ativo ? [] : [etiquetaDeDesativado(perfil)];
}

export function etiquetasDoDetalhe(perfil: ResumoDoDetalheDoPerfil): readonly EtiquetaDoPerfil[] {
  return [...etiquetasDoPerfil(perfil), ...(perfil.emJanelaDeMigracao ? [JANELA_DE_MIGRACAO] : [])];
}

function etiquetaDeDesativado(perfil: ResumoDoPerfil): EtiquetaDoPerfil {
  const etiqueta: EtiquetaDoPerfil = { texto: 'Desativado', variante: 'neutral' };
  return perfil.desativadoDesde === null
    ? etiqueta
    : { ...etiqueta, desde: perfil.desativadoDesde };
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

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import type { CodigoDePermissao } from '@uniplus/shared-auth/bootstrap';

const { autorizacao, configuracao, organizacao, publicacoes } = PERMISSAO;

/** O perfil de acesso abre para quem o mantém ou aprova uma das etapas da versão dele. */
export const PERMISSOES_DO_PERFIL = [
  autorizacao.perfisManter,
  autorizacao.perfisAprovarFuncional,
  autorizacao.perfisAprovarProtecaoDeDados,
] as const satisfies readonly CodigoDePermissao[];

/**
 * Permissões que abrem cada tela, por caminho de rota (basta uma). Rotas e menu leem daqui, para
 * que o item visível seja sempre um clique que a guarda aceita. A ordem é a da primeira tela
 * oferecida a quem entra sem destino.
 *
 * Lista vazia libera a tela a toda pessoa autenticada; ela não conta como destino de entrada.
 *
 * Tipo de processo, fato do candidato e modelo de formulário abrem pela consulta; a manutenção é
 * a ação dentro da tela.
 */
export const PERMISSOES_DAS_TELAS = {
  unidades: [organizacao.unidadesManter],
  instituicao: [organizacao.instituicaoManter],
  campi: [configuracao.campiManter],
  'locais-oferta': [configuracao.locaisOfertaManter],
  'reserva-demografica': [configuracao.referenciasReservaDemograficaManter],
  'pesos-por-area': [configuracao.pesosAreaEnemManter],
  cursos: [configuracao.cursosManter],
  'ofertas-curso': [configuracao.ofertasCursoManter],
  modalidades: [configuracao.modalidadesManter],
  'fases-canonicas': [configuracao.fasesCanonicasManter],
  'precedencias-fase': [configuracao.precedenciasFaseManter],
  'tipos-banca': [configuracao.tiposBancaManter],
  'tipos-etapa': [configuracao.tiposEtapaManter],
  'tipos-processo': [configuracao.tiposProcessoConsultar],
  'tipos-ato': [publicacoes.tiposAtoManter],
  'fatos-candidato': [configuracao.fatosCandidatoConsultar],
  'modelos-formulario': [configuracao.modelosFormularioConsultar],
  'simulador-de-formulario': [configuracao.modelosFormularioConsultar],
  'tipos-documento': [configuracao.tiposDocumentoManter],
  'protecao-do-catalogo': [configuracao.protecaoDoCatalogoAprovar],
  'base-legal-bonus-regional': [configuracao.baseLegalBonusRegionalManter],
  'condicoes-atendimento': [configuracao.condicoesAtendimentoManter],
  'recursos-acessibilidade': [configuracao.recursosAcessibilidadeManter],
  'tipos-deficiencia': [configuracao.tiposDeficienciaManter],
  'termos-consentimento': [configuracao.termosConsentimentoManter],
  'calendario-dias-uteis': [configuracao.calendariosDiasUteisManter],
  // Pedir acesso e acompanhar os próprios pedidos é de toda pessoa autenticada: lista vazia.
  'acessos/pedidos': [],
  'acessos/fila-do-gestor': [autorizacao.pedidosAprovarFuncional],
  'acessos/fila-da-protecao-de-dados': [autorizacao.pedidosAprovarProtecaoDeDados],
  'acessos/historico': [
    autorizacao.pedidosAprovarFuncional,
    autorizacao.pedidosAprovarProtecaoDeDados,
  ],
  'acessos/concessoes': [autorizacao.concessoesAdministrar],
  'acessos/perfis': PERMISSOES_DO_PERFIL,
  'acessos/versoes-de-perfil/gestao-de-acessos': [autorizacao.perfisAprovarFuncional],
  'acessos/versoes-de-perfil/protecao-de-dados': [autorizacao.perfisAprovarProtecaoDeDados],
  'acessos/janelas-de-migracao/gestao-de-acessos': [autorizacao.perfisAprovarFuncional],
  'acessos/janelas-de-migracao/protecao-de-dados': [autorizacao.perfisAprovarProtecaoDeDados],
  'acessos/reclassificacoes/gestao-de-acessos': [autorizacao.perfisAprovarFuncional],
  'acessos/reclassificacoes/protecao-de-dados': [autorizacao.perfisAprovarProtecaoDeDados],
  'acessos/governanca/divergencias': [
    autorizacao.perfisManter,
    autorizacao.perfisAprovarProtecaoDeDados,
  ],
} as const satisfies Record<string, readonly CodigoDePermissao[]>;

/** A janela de migração abre para quem mantém o perfil ou aprova uma das etapas dela. */
export const PERMISSOES_DA_JANELA_DE_MIGRACAO = PERMISSOES_DO_PERFIL;

/** O detalhe da reclassificação abre para quem aprova uma das etapas dela. */
export const PERMISSOES_DA_RECLASSIFICACAO = [
  autorizacao.perfisAprovarFuncional,
  autorizacao.perfisAprovarProtecaoDeDados,
] as const satisfies readonly CodigoDePermissao[];

export type CaminhoDeTela = keyof typeof PERMISSOES_DAS_TELAS;

/** Entrada sem destino: leva à primeira tela que a pessoa pode abrir. */
export const entradaPelaPermissao: CanActivateFn = async () => {
  const permissoes = inject(PermissoesService);
  const router = inject(Router);
  await permissoes.garantir();
  const caminhos = Object.keys(PERMISSOES_DAS_TELAS) as CaminhoDeTela[];
  const primeira = caminhos.find((caminho) =>
    permissoes.temAlguma(...PERMISSOES_DAS_TELAS[caminho]),
  );
  return router.createUrlTree([primeira ?? 'acesso-negado']);
};

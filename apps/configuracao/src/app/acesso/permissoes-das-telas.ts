import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import type { CodigoDePermissao } from '@uniplus/shared-auth/bootstrap';

const { autorizacao, configuracao, organizacao, publicacoes } = PERMISSAO;

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
  'base-legal-bonus-regional': [configuracao.baseLegalBonusRegionalManter],
  'condicoes-atendimento': [configuracao.condicoesAtendimentoManter],
  'recursos-acessibilidade': [configuracao.recursosAcessibilidadeManter],
  'tipos-deficiencia': [configuracao.tiposDeficienciaManter],
  'termos-consentimento': [configuracao.termosConsentimentoManter],
  'calendario-dias-uteis': [configuracao.calendariosDiasUteisManter],
  // Pedir acesso e acompanhar os próprios pedidos é de toda pessoa autenticada: lista vazia.
  'acessos/pedidos': [],
  'acessos/fila-do-gestor': [autorizacao.pedidosAprovarFuncional],
  'acessos/fila-da-encarregada': [autorizacao.pedidosAprovarProtecaoDeDados],
  'acessos/historico': [
    autorizacao.pedidosAprovarFuncional,
    autorizacao.pedidosAprovarProtecaoDeDados,
  ],
  'acessos/concessoes': [autorizacao.concessoesAdministrar],
  'acessos/perfis': [autorizacao.perfisManter],
} as const satisfies Record<string, readonly CodigoDePermissao[]>;

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

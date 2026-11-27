import type { PerfilParaPedidoDto } from '@uniplus/shared-data/autorizacao';
import type { JsonDaApi } from '@uniplus/shared-e2e';
import { tipoDeEscopo } from '../enumerados-de-autorizacao';
import { PERFIS } from './modelo';
import { json, type Rota } from './resposta';

const SOLICITANTE_NAO_INSTITUCIONAL = {
  type: 'about:blank',
  title: 'Solicitante sem e-mail institucional',
  status: 403,
  code: 'uniplus.autorizacao.pedido.solicitante_nao_institucional',
  traceId: 'e2e',
};

const PERFIS_PARA_PEDIDO = PERFIS.map(
  ({ id, nome, descricao }): JsonDaApi<PerfilParaPedidoDto> => ({
    id,
    nome,
    descricao,
    escopo: tipoDeEscopo('UNIDADE'),
    exigeAprovacaoDeProtecaoDeDados: false,
    governanca: null,
  }),
);

/** Os perfis da gestão e os que a pessoa pode pedir; sem e-mail institucional, ela não pede. */
export function rotasDePerfis(solicitanteInstitucional: boolean): Rota[] {
  return [
    { caminho: /\/perfis$/u, responder: ({ route }) => json(route, PERFIS) },
    {
      caminho: /\/perfis-para-pedido$/u,
      responder: ({ route }) =>
        solicitanteInstitucional
          ? json(route, PERFIS_PARA_PEDIDO)
          : json(route, SOLICITANTE_NAO_INSTITUCIONAL, 403),
    },
  ];
}

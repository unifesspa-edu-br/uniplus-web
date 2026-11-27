import type {
  ConcessaoDto,
  DivergenciaDaGovernancaDto,
  EnvioDoDocumentoDto,
  ItemDaRevisaoDto,
  PerfilListadoDto,
  PedidoDeConcessaoDto,
  ProvidenciaDto,
  SuspensaoDoPerfilDto,
  RevisaoResumoDto,
} from '@uniplus/shared-data/autorizacao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

/**
 * Os enums de resposta da API de autorização chegam como `{ codigo, rotulo }`. Cada fábrica está
 * tipada pelo campo do cliente gerado: um código que a API não tem, ou um que falte, não compila.
 */

type CodigoDe<T> = JsonDaApi<T> extends { readonly codigo: infer C extends string } ? C : never;

const enumerado =
  <C extends string>(rotulos: Readonly<Record<C, string>>) =>
  (codigo: C) => ({ codigo, rotulo: rotulos[codigo] });

export const tipoDeEscopo = enumerado<CodigoDe<ConcessaoDto['escopo']['tipo']>>({
  UNIDADE: 'Unidade',
  INSTITUICAO: 'Instituição',
});

export const tipoDeOrigem = enumerado<CodigoDe<ConcessaoDto['origem']['tipo']>>({
  PEDIDO: 'Pedido',
  INSTALACAO: 'Instalação',
});

export const situacaoDoPedido = enumerado<CodigoDe<PedidoDeConcessaoDto['situacao']>>({
  AGUARDANDO_BENEFICIARIO: 'Aguardando beneficiário',
  AGUARDANDO_GESTOR: 'Aguardando gestor',
  AGUARDANDO_PROTECAO_DE_DADOS: 'Aguardando proteção de dados',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
  CANCELADO: 'Cancelado',
  AGUARDANDO_DOCUMENTO: 'Aguardando documento',
  DEVOLVIDO: 'Devolvido',
});

export const etapaDoPedido = enumerado<CodigoDe<NonNullable<PedidoDeConcessaoDto['etapaAtual']>>>({
  GESTOR: 'Gestor',
  PROTECAO_DE_DADOS: 'Proteção de dados',
});

export const quemDecideOItem = enumerado<CodigoDe<ItemDaRevisaoDto['decide']>>({
  GESTOR_DE_ACESSOS: 'Gestor de acessos',
  REPRESENTANTE_DO_CONTROLADOR: 'Representante do controlador',
  GESTOR_DE_PROTECAO_DE_DADOS: 'Gestor de proteção de dados',
});

export const situacaoDoItemDaRevisao = enumerado<CodigoDe<ItemDaRevisaoDto['situacao']>>({
  PENDENTE: 'Pendente',
  CONFIRMADA: 'Confirmada',
  REVOGADA: 'Revogada',
  CONCESSAO_ENCERRADA: 'Concessão encerrada',
});

export const situacaoDaRevisao = enumerado<CodigoDe<RevisaoResumoDto['situacao']>>({
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
});

export const tipoDaProvidencia = enumerado<CodigoDe<ProvidenciaDto['tipo']>>({
  RETIRADA: 'Retirada do acesso',
  REVISAO: 'Revisão do acesso',
});

export const situacaoDaProvidencia = enumerado<CodigoDe<ProvidenciaDto['situacao']>>({
  ABERTA: 'Aberta',
  RESPONDIDA: 'Respondida',
  ATENDIDA: 'Atendida',
  PREJUDICADA: 'Prejudicada',
});

export const causaDoEncerramento = enumerado<
  CodigoDe<NonNullable<ProvidenciaDto['encerramentoDaConcessao']>['causa']>
>({ REVOGADA: 'Revogada', VENCIDA: 'Vencida' });

export const classificacaoDeProtecao = enumerado<CodigoDe<PerfilListadoDto['sensibilidade']>>({
  PUBLICO: 'Público',
  INTERNO: 'Interno',
  PESSOAL: 'Pessoal',
  IDENTIFICADOR: 'Identificador',
  SENSIVEL: 'Sensível',
});

export const situacaoDoAnexo = enumerado<CodigoDe<EnvioDoDocumentoDto['situacao']>>({
  AGUARDANDO_ENVIO: 'Aguardando envio',
  EM_VERIFICACAO: 'Em verificação',
  VERIFICADO: 'Verificado',
  RECUSADO: 'Recusado',
});

export const tipoDeDivergencia = enumerado<CodigoDe<DivergenciaDaGovernancaDto['tipo']>>({
  COMPOSICAO_FALTANTE: 'Composição faltante',
  COMPOSICAO_EXCEDENTE: 'Composição excedente',
  CLASSIFICACAO: 'Classificação',
  ESCOPO: 'Escopo',
});

export const etapaDaVersao = enumerado<CodigoDe<SuspensaoDoPerfilDto['papelDeQuemSuspendeu']>>({
  GESTAO_DE_ACESSOS: 'Gestão de acessos',
  PROTECAO_DE_DADOS: 'Proteção de dados',
});

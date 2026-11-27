import type { PedidoResumoDto } from '@uniplus/shared-data/autorizacao';
import type { JsonDaApi } from '@uniplus/shared-e2e';
import { etapaDoPedido, situacaoDoPedido, tipoDeEscopo } from '../enumerados-de-autorizacao';
import { PERFIS, PERFIL_SENSIVEL_ID, concessaoDoPedido, pedidoSeed, type Pedido } from './modelo';
import type { EstadoDaApi } from './modelo';
import { json, semConteudo, contaIdDe, type Requisicao, type Rota } from './resposta';

const PEDIDO_NAO_ENCONTRADO = {
  type: 'x',
  title: 'Pedido não encontrado',
  status: 404,
  code: 'uniplus.autorizacao.pedido.nao_encontrado',
  traceId: '',
};

interface CorpoDaCriacao {
  perfilId: string;
  unidadeId: string | null;
  justificativa: string;
  beneficiarioEmail: string | null;
  validaAteSugerida?: string;
}

/** Quem vê cada fila: a do gestor, a da segunda etapa, todos ou só os pedidos da própria pessoa. */
const FILAS: Readonly<Record<string, (pedido: Pedido, eu: string) => boolean>> = {
  gestor: (pedido) => pedido.situacao.codigo === 'AGUARDANDO_GESTOR',
  protecao_de_dados: (pedido) => pedido.situacao.codigo === 'AGUARDANDO_PROTECAO_DE_DADOS',
  todos: () => true,
};
const meus = (pedido: Pedido, eu: string) => pedido.solicitante.contaId === eu;

function resumo(p: Pedido): JsonDaApi<PedidoResumoDto> {
  const { id, situacao, etapaAtual, beneficiario, perfil, versao } = p;
  const { escopo, justificativa, criadoEm } = p;
  const identificacao = { id, situacao, etapaAtual, beneficiario, perfil, versao };
  return { ...identificacao, escopo, justificativa, criadoEm, aguardaAceiteDoTermo: false };
}

const pedidoDe = (estado: EstadoDaApi, caminho: string) =>
  estado.pedidos.find((p) => caminho.includes(p.id));

function listar({ route, url, estado }: Requisicao): Promise<void> {
  const daFila = FILAS[url.searchParams.get('fila') ?? 'meus'] ?? meus;
  const situacao = url.searchParams.get('situacao');
  const eu = contaIdDe(route);
  const filtrados = estado.pedidos
    .filter((p) => daFila(p, eu))
    .filter((p) => !situacao || p.situacao.codigo === situacao);
  return json(route, filtrados.map(resumo));
}

/** O pedido que a tela cria é sempre da própria pessoa, como beneficiária e solicitante. */
function pedidoCriado(corpo: CorpoDaCriacao, contaId: string): Pedido {
  const perfil = PERFIS.find((p) => p.id === corpo.perfilId);
  if (!perfil) throw new Error(`Perfil fora do seed: ${corpo.perfilId}`);
  const identidade = { emissor: 'unifesspa', contaId };
  return pedidoSeed({
    id: '01960000-0000-7000-0000-00000000cc99',
    solicitante: identidade,
    beneficiario: { email: 'fernanda.teste@unifesspa.edu.br', identidade, nome: 'Fernanda Teste' },
    perfil,
    escopo: { tipo: tipoDeEscopo('UNIDADE'), unidadeId: corpo.unidadeId },
    justificativa: corpo.justificativa,
    validaAteSugerida: corpo.validaAteSugerida ?? null,
  });
}

function criar({ route, estado }: Requisicao): Promise<void> {
  const corpo = route.request().postDataJSON() as CorpoDaCriacao;
  estado.criacoes.push(corpo);
  const novo = pedidoCriado(corpo, contaIdDe(route));
  estado.pedidos.push(novo);
  return json(route, novo, 201);
}

function obterOuCancelar({ route, metodo, url, estado }: Requisicao): Promise<void> {
  const alvo = pedidoDe(estado, url.pathname);
  if (!alvo) return json(route, PEDIDO_NAO_ENCONTRADO, 404);
  if (metodo !== 'DELETE') return json(route, alvo);
  alvo.situacao = situacaoDoPedido('CANCELADO');
  alvo.etapaAtual = null;
  return semConteudo(route);
}

/** O gestor aprova o perfil sensível para a segunda etapa; a última aprovação concede. */
function aprovar({ route, url, estado }: Requisicao): Promise<void> {
  const alvo = pedidoDe(estado, url.pathname);
  if (!alvo) return json(route, {}, 404);
  const corpo = route.request().postDataJSON() as { validaAte?: string } | null;
  estado.aprovacoes.push(corpo);
  const naEtapaDoGestor = alvo.etapaAtual?.codigo === 'GESTOR';
  if (naEtapaDoGestor) alvo.validaAte = corpo?.validaAte ?? null;
  if (naEtapaDoGestor && alvo.perfil.id === PERFIL_SENSIVEL_ID) {
    Object.assign(alvo, {
      situacao: situacaoDoPedido('AGUARDANDO_PROTECAO_DE_DADOS'),
      etapaAtual: etapaDoPedido('PROTECAO_DE_DADOS'),
    });
  } else conceder(estado, alvo);
  return json(route, alvo);
}

function conceder(estado: EstadoDaApi, pedido: Pedido): void {
  pedido.situacao = situacaoDoPedido('APROVADO');
  pedido.etapaAtual = null;
  pedido.concessaoId = `${pedido.id}-concessao`;
  estado.concessoes.push(concessaoDoPedido(pedido, pedido.concessaoId));
}

function recusar({ route, url, estado }: Requisicao): Promise<void> {
  const alvo = pedidoDe(estado, url.pathname);
  if (!alvo) return json(route, {}, 404);
  estado.recusas.push(route.request().postDataJSON());
  alvo.situacao = situacaoDoPedido('RECUSADO');
  alvo.etapaAtual = null;
  return json(route, alvo);
}

export const ROTAS_DE_PEDIDOS: readonly Rota[] = [
  { caminho: /\/pedidos-de-concessao$/u, metodo: 'GET', responder: listar },
  { caminho: /\/pedidos-de-concessao$/u, metodo: 'POST', responder: criar },
  { caminho: /\/pedidos-de-concessao\/[^/]+\/trilha$/u, responder: ({ route }) => json(route, []) },
  { caminho: /\/pedidos-de-concessao\/[^/]+$/u, responder: obterOuCancelar },
  { caminho: /\/aprovacoes$/u, responder: aprovar },
  { caminho: /\/recusa$/u, responder: recusar },
];

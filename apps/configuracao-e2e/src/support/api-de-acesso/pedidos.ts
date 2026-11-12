import { PERFIS, PERFIL_SENSIVEL_ID, concessaoDoPedido, pedidoSeed, type Pedido } from './modelo';
import type { EstadoDaApi } from './modelo';
import { json, semConteudo, subDe, type Requisicao, type Rota } from './resposta';

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
  gestor: (pedido) => pedido.situacao === 'aguardando_gestor',
  protecao_de_dados: (pedido) => pedido.situacao === 'aguardando_protecao_de_dados',
  todos: () => true,
};
const meus = (pedido: Pedido, eu: string) => pedido.solicitante.sub === eu;

function resumo(p: Pedido) {
  const { id, situacao, etapaAtual, beneficiario, perfil, escopo, justificativa, criadoEm } = p;
  return { id, situacao, etapaAtual, beneficiario, perfil, escopo, justificativa, criadoEm };
}

const pedidoDe = (estado: EstadoDaApi, caminho: string) =>
  estado.pedidos.find((p) => caminho.includes(p.id));

function listar({ route, url, estado }: Requisicao): Promise<void> {
  const daFila = FILAS[url.searchParams.get('fila') ?? 'meus'] ?? meus;
  const situacao = url.searchParams.get('situacao');
  const eu = subDe(route);
  const filtrados = estado.pedidos
    .filter((p) => daFila(p, eu))
    .filter((p) => !situacao || p.situacao === situacao);
  return json(route, filtrados.map(resumo));
}

/** O pedido que a tela cria é sempre da própria pessoa, como beneficiária e solicitante. */
function pedidoCriado(corpo: CorpoDaCriacao, sub: string): Pedido {
  const perfil = PERFIS.find((p) => p.id === corpo.perfilId);
  if (!perfil) throw new Error(`Perfil fora do seed: ${corpo.perfilId}`);
  const identidade = { emissor: 'unifesspa', sub };
  return pedidoSeed({
    id: '01960000-0000-7000-0000-00000000cc99',
    solicitante: identidade,
    beneficiario: { email: 'fernanda.teste@unifesspa.edu.br', identidade, nome: 'Fernanda Teste' },
    perfil,
    escopo: { tipo: 'unidade', unidadeId: corpo.unidadeId },
    justificativa: corpo.justificativa,
    validaAteSugerida: corpo.validaAteSugerida ?? null,
  });
}

function criar({ route, estado }: Requisicao): Promise<void> {
  const corpo = route.request().postDataJSON() as CorpoDaCriacao;
  estado.criacoes.push(corpo);
  const novo = pedidoCriado(corpo, subDe(route));
  estado.pedidos.push(novo);
  return json(route, novo, 201);
}

function obterOuCancelar({ route, metodo, url, estado }: Requisicao): Promise<void> {
  const alvo = pedidoDe(estado, url.pathname);
  if (!alvo) return json(route, PEDIDO_NAO_ENCONTRADO, 404);
  if (metodo !== 'DELETE') return json(route, alvo);
  alvo.situacao = 'cancelado';
  alvo.etapaAtual = null;
  return semConteudo(route);
}

/** O gestor aprova o perfil sensível para a segunda etapa; a última aprovação concede. */
function aprovar({ route, url, estado }: Requisicao): Promise<void> {
  const alvo = pedidoDe(estado, url.pathname);
  if (!alvo) return json(route, {}, 404);
  const corpo = route.request().postDataJSON() as { validaAte?: string } | null;
  estado.aprovacoes.push(corpo);
  const naEtapaDoGestor = alvo.etapaAtual === 'gestor';
  if (naEtapaDoGestor) alvo.validaAte = corpo?.validaAte ?? null;
  if (naEtapaDoGestor && alvo.perfil.id === PERFIL_SENSIVEL_ID) {
    Object.assign(alvo, {
      situacao: 'aguardando_protecao_de_dados',
      etapaAtual: 'protecao_de_dados',
    });
  } else conceder(estado, alvo);
  return json(route, alvo);
}

function conceder(estado: EstadoDaApi, pedido: Pedido): void {
  pedido.situacao = 'aprovado';
  pedido.etapaAtual = null;
  pedido.concessaoId = `${pedido.id}-concessao`;
  estado.concessoes.push(concessaoDoPedido(pedido, pedido.concessaoId));
}

function recusar({ route, url, estado }: Requisicao): Promise<void> {
  const alvo = pedidoDe(estado, url.pathname);
  if (!alvo) return json(route, {}, 404);
  estado.recusas.push(route.request().postDataJSON());
  alvo.situacao = 'recusado';
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

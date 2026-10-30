import type { Page, Route } from '@playwright/test';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
  'access-control-expose-headers': 'link',
};

/** Pessoas fictícias do portal que aparecem como partes dos pedidos. */
export const FERNANDA = { emissor: 'unifesspa', sub: 'sub-fernanda-0001-fictícia' };
export const BETINA_EMAIL = 'betina.teste@unifesspa.edu.br';

export const UNIDADE_ID = '01960000-0000-7000-0000-00000000aa01';
export const PERFIL_COMUM_ID = '01960000-0000-7000-0000-00000000bb01';
export const PERFIL_SENSIVEL_ID = '01960000-0000-7000-0000-00000000bb02';

const PERFIS = [
  perfil(PERFIL_COMUM_ID, 'Operador de inscrições', 'interno'),
  perfil(PERFIL_SENSIVEL_ID, 'Analista de documentos', 'sensivel'),
];

function perfil(id: string, nome: string, sensibilidade: string) {
  return {
    id,
    nome,
    descricao: `${nome}.`,
    ativo: true,
    governanca: null,
    sensibilidade,
    permissoes: [],
  };
}

interface Pedido {
  id: string;
  situacao: string;
  etapaAtual: string | null;
  solicitante: { emissor: string; sub: string };
  beneficiario: {
    email: string;
    identidade: { emissor: string; sub: string } | null;
    nome: string | null;
  };
  perfil: { id: string; nome: string };
  escopo: { tipo: string; unidadeId: string | null };
  justificativa: string;
  criadoEm: string;
  encerradoEm: string | null;
  concessaoId: string | null;
  anexos: unknown[];
  decisoes: unknown[];
}

interface Concessao {
  id: string;
  beneficiario: { emissor: string; sub: string };
  perfil: { id: string; nome: string };
  escopo: { tipo: string; unidadeId: string | null };
  origem: { tipo: string; id: string };
  concedidaEm: string;
  validaAte: null;
  revogadaEm: string | null;
  revogadaPor: null;
  motivoRevogacao: string | null;
  ativa: boolean;
}

/** O que a tela enviou à API, para os testes conferirem. */
export interface EstadoDaApi {
  pedidos: Pedido[];
  concessoes: Concessao[];
  criacoes: unknown[];
  recusas: unknown[];
  revogacoes: unknown[];
}

/** O `sub` de quem fez a requisição, lido do Bearer, para os pedidos que a tela cria. */
function subDe(route: Route): string {
  const token = (route.request().headers()['authorization'] ?? '').replace(/^Bearer /u, '');
  const carga = JSON.parse(
    Buffer.from(token.split('.')[1] ?? 'e30', 'base64url').toString('utf-8'),
  );
  return String(carga.sub ?? 'sub-desconhecido');
}

export function pedidoSeed(parcial: Partial<Pedido> = {}): Pedido {
  return {
    id: '01960000-0000-7000-0000-00000000cc01',
    situacao: 'aguardando_gestor',
    etapaAtual: 'gestor',
    solicitante: FERNANDA,
    beneficiario: {
      email: BETINA_EMAIL,
      identidade: { emissor: 'unifesspa', sub: 'sub-betina-0002-fictícia' },
      nome: 'Betina Teste',
    },
    perfil: { id: PERFIL_SENSIVEL_ID, nome: 'Analista de documentos' },
    escopo: { tipo: 'unidade', unidadeId: UNIDADE_ID },
    justificativa: 'Analisa os documentos do processo seletivo da unidade.',
    criadoEm: '2026-10-28T12:00:00Z',
    encerradoEm: null,
    concessaoId: null,
    anexos: [],
    decisoes: [],
    ...parcial,
  };
}

function resumo(p: Pedido) {
  const { id, situacao, etapaAtual, beneficiario, perfil, escopo, justificativa, criadoEm } = p;
  return { id, situacao, etapaAtual, beneficiario, perfil, escopo, justificativa, criadoEm };
}

/**
 * Simula a API de autorização com estado: o pedido percorre gestor e proteção de dados, a última
 * aprovação gera a concessão e a revogação a tira das ativas. Quem decide é a tela de quem
 * navega; a API simulada só aplica a transição.
 */
export async function mockApiDeAcesso(
  page: Page,
  pedidosIniciais: Pedido[] = [],
  { solicitanteInstitucional = true }: { solicitanteInstitucional?: boolean } = {},
): Promise<EstadoDaApi> {
  const estado: EstadoDaApi = {
    pedidos: [...pedidosIniciais],
    concessoes: [],
    criacoes: [],
    recusas: [],
    revogacoes: [],
  };

  const json = (route: Route, corpo: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: status >= 400 ? 'application/problem+json' : 'application/json',
      headers: CORS,
      body: JSON.stringify(corpo),
    });
  const pedidoDe = (url: string) => estado.pedidos.find((p) => url.includes(p.id));

  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/u, (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : json(route, [{ id: UNIDADE_ID, nome: 'Centro de Seleção', sigla: 'CEPS' }]),
  );

  await page.route(
    /\/api\/autorizacao\/(pedidos-de-concessao|concessoes|perfis)/u,
    async (route) => {
      const requisicao = route.request();
      const metodo = requisicao.method();
      const url = new URL(requisicao.url());
      const caminho = url.pathname;

      if (metodo === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

      if (caminho.endsWith('/perfis')) return json(route, PERFIS);

      if (caminho.endsWith('/perfis-para-pedido') && !solicitanteInstitucional) {
        return json(
          route,
          {
            type: 'about:blank',
            title: 'Solicitante sem e-mail institucional',
            status: 403,
            code: 'uniplus.autorizacao.pedido.solicitante_nao_institucional',
            traceId: 'e2e',
          },
          403,
        );
      }

      if (caminho.endsWith('/perfis-para-pedido')) {
        return json(
          route,
          PERFIS.map(({ id, nome, descricao }) => ({
            id,
            nome,
            descricao,
            escopo: 'unidade',
            exigeAprovacaoDeProtecaoDeDados: false,
          })),
        );
      }

      if (caminho.endsWith('/pedidos-de-concessao') && metodo === 'GET') {
        const fila = url.searchParams.get('fila') ?? 'meus';
        const situacao = url.searchParams.get('situacao');
        const eu = subDe(route);
        const filtrados = estado.pedidos
          .filter((p) =>
            fila === 'gestor'
              ? p.situacao === 'aguardando_gestor'
              : fila === 'protecao_de_dados'
                ? p.situacao === 'aguardando_protecao_de_dados'
                : fila === 'todos'
                  ? true
                  : p.solicitante.sub === eu,
          )
          .filter((p) => !situacao || p.situacao === situacao);
        return json(route, filtrados.map(resumo));
      }

      if (caminho.endsWith('/pedidos-de-concessao') && metodo === 'POST') {
        const corpo = requisicao.postDataJSON() as {
          perfilId: string;
          unidadeId: string | null;
          justificativa: string;
          beneficiarioEmail: string | null;
        };
        estado.criacoes.push(corpo);
        const sub = subDe(route);
        const novo = pedidoSeed({
          id: '01960000-0000-7000-0000-00000000cc99',
          solicitante: { emissor: 'unifesspa', sub },
          beneficiario: {
            email: 'fernanda.teste@unifesspa.edu.br',
            identidade: { emissor: 'unifesspa', sub },
            nome: 'Fernanda Teste',
          },
          perfil: PERFIS.find((p) => p.id === corpo.perfilId) ?? PERFIS[0]!,
          escopo: { tipo: 'unidade', unidadeId: corpo.unidadeId },
          justificativa: corpo.justificativa,
        });
        estado.pedidos.push(novo);
        return json(route, novo, 201);
      }

      if (/\/pedidos-de-concessao\/[^/]+\/trilha$/u.test(caminho)) return json(route, []);

      if (/\/pedidos-de-concessao\/[^/]+$/u.test(caminho)) {
        const alvo = pedidoDe(caminho);
        if (!alvo)
          return json(
            route,
            {
              type: 'x',
              title: 'Pedido não encontrado',
              status: 404,
              code: 'uniplus.autorizacao.pedido.nao_encontrado',
              traceId: '',
            },
            404,
          );
        if (metodo === 'DELETE') {
          alvo.situacao = 'cancelado';
          alvo.etapaAtual = null;
          return route.fulfill({ status: 204, headers: CORS });
        }
        return json(route, alvo);
      }

      if (caminho.endsWith('/aprovacoes')) {
        const alvo = pedidoDe(caminho);
        if (!alvo) return json(route, {}, 404);
        const sensivel = alvo.perfil.id === PERFIL_SENSIVEL_ID;
        if (alvo.etapaAtual === 'gestor' && sensivel) {
          alvo.situacao = 'aguardando_protecao_de_dados';
          alvo.etapaAtual = 'protecao_de_dados';
        } else {
          alvo.situacao = 'aprovado';
          alvo.etapaAtual = null;
          alvo.concessaoId = `${alvo.id}-concessao`;
          estado.concessoes.push({
            id: alvo.concessaoId,
            beneficiario: alvo.beneficiario.identidade ?? alvo.solicitante,
            perfil: alvo.perfil,
            escopo: alvo.escopo,
            origem: { tipo: 'pedido', id: alvo.id },
            concedidaEm: '2026-10-29T10:00:00Z',
            validaAte: null,
            revogadaEm: null,
            revogadaPor: null,
            motivoRevogacao: null,
            ativa: true,
          });
        }
        return json(route, alvo);
      }

      if (caminho.endsWith('/recusa')) {
        const alvo = pedidoDe(caminho);
        if (!alvo) return json(route, {}, 404);
        estado.recusas.push(requisicao.postDataJSON());
        alvo.situacao = 'recusado';
        alvo.etapaAtual = null;
        return json(route, alvo);
      }

      if (caminho.endsWith('/concessoes') && metodo === 'GET') {
        const situacao = url.searchParams.get('situacao') ?? 'ativa';
        return json(
          route,
          estado.concessoes.filter(
            (c) => situacao === 'todas' || (situacao === 'ativa' ? c.ativa : !c.ativa),
          ),
        );
      }

      if (/\/concessoes\/[^/]+\/trilha$/u.test(caminho)) return json(route, []);

      if (caminho.endsWith('/revogacao')) {
        const alvo = estado.concessoes.find((c) => caminho.includes(c.id));
        if (!alvo) return json(route, {}, 404);
        estado.revogacoes.push(requisicao.postDataJSON());
        alvo.ativa = false;
        alvo.revogadaEm = '2026-10-29T11:00:00Z';
        return route.fulfill({ status: 204, headers: CORS });
      }

      return route.fallback();
    },
  );

  return estado;
}

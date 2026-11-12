import type { Page, Route } from '@playwright/test';
import { ROTAS_DE_CONCESSOES } from './concessoes';
import { UNIDADE_ID, estadoInicial, type EstadoDaApi, type Pedido } from './modelo';
import { ROTAS_DE_PEDIDOS } from './pedidos';
import { rotasDePerfis } from './perfis';
import { json, semConteudo, type Rota } from './resposta';

export {
  BETINA_EMAIL,
  FERNANDA,
  PERFIL_COMUM_ID,
  PERFIL_SENSIVEL_ID,
  UNIDADE_ID,
  pedidoSeed,
  type EstadoDaApi,
} from './modelo';

const API_DE_AUTORIZACAO = /\/api\/autorizacao\/(pedidos-de-concessao|concessoes|perfis)/u;

/** Atende pela primeira rota que casa com o caminho e o método; o resto segue adiante. */
function atenderPelasRotas(rotas: readonly Rota[], estado: EstadoDaApi) {
  return (route: Route): Promise<void> => {
    const metodo = route.request().method();
    if (metodo === 'OPTIONS') return semConteudo(route);
    const url = new URL(route.request().url());
    const rota = rotas.find(
      (r) => r.caminho.test(url.pathname) && (r.metodo === undefined || r.metodo === metodo),
    );
    return rota ? rota.responder({ route, metodo, url, estado }) : route.fallback();
  };
}

function atenderUnidades(route: Route): Promise<void> {
  return route.request().method() === 'OPTIONS'
    ? semConteudo(route)
    : json(route, [{ id: UNIDADE_ID, nome: 'Centro de Seleção', sigla: 'CEPS' }]);
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
  const estado = estadoInicial(pedidosIniciais);
  const rotas = [
    ...rotasDePerfis(solicitanteInstitucional),
    ...ROTAS_DE_PEDIDOS,
    ...ROTAS_DE_CONCESSOES,
  ];
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/u, atenderUnidades);
  await page.route(API_DE_AUTORIZACAO, atenderPelasRotas(rotas, estado));
  return estado;
}

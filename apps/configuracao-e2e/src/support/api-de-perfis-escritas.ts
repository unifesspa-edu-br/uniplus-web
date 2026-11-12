import type { Page, Route } from '@playwright/test';
import {
  CORS_HEADERS,
  ERRO_INTERNO,
  OK,
  envioDe,
  esperarARecarga,
  reter,
  responder,
  responderPreflight,
  type Envio,
  type Recarga,
  type Resposta,
} from './escritas-retidas';

/** O perfil, o catálogo e o envio de documento que o mock das escritas de perfis atende. */

export const PERFIL = {
  id: '01960000-0000-7000-0000-0000000000a1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  ativo: true,
  governanca: null,
  sensibilidade: 'interno',
  temVersaoVigente: true,
  temVersaoPendente: false,
  suspensao: null,
  desativadoDesde: null,
};

const DETALHE_DO_PERFIL = {
  id: PERFIL.id,
  nome: PERFIL.nome,
  descricao: PERFIL.descricao,
  governanca: null,
  sensibilidade: 'interno',
  composicaoEmVigor: {
    versaoId: '01960000-0000-7000-0000-0000000000b1',
    numero: 1,
    permissoes: [],
    protocolo: 'P-1/2026',
    documentoVerificadoEm: '2026-10-20T12:00:00Z',
    desde: '2026-10-21T12:00:00Z',
  },
  versaoPendente: null,
  ultimaVersaoEncerradaSemVigor: null,
  suspensao: null,
};

const URL_DE_ENVIO = 'http://localhost:9000/uniplus-teste/documento-do-perfil.pdf';
const ENVIO_DO_DOCUMENTO = {
  perfilId: '01960000-0000-7000-0000-0000000000a2',
  versaoId: '01960000-0000-7000-0000-0000000000b2',
  documentoId: '01960000-0000-7000-0000-0000000000c2',
  situacao: 'aguardando_envio',
  urlDeEnvio: URL_DE_ENVIO,
  tipoDeMidia: 'application/pdf',
  expiraEm: '2099-01-01T00:00:00Z',
};
export const PDF_DO_TESTE = {
  name: 'portaria.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
};

const CATALOGO = [
  {
    modulo: 'selecao',
    resources: [
      {
        resource: 'processos',
        permissoes: [
          {
            codigo: 'selecao:processos:configurar',
            nome: 'Configurar processos',
            descricao: '',
            sensibilidade: 'interno',
          },
        ],
      },
    ],
  },
];

const ROTA_DOS_PERFIS =
  /\/api\/autorizacao\/perfis(\/[^/?]+(\/(desativacao|reativacao|contencao))?)?(\?.*)?$/;
const ROTA_DA_CONFIRMACAO =
  /\/api\/autorizacao\/perfis\/[^/]+\/versoes\/[^/]+\/documento\/confirmacao$/;

/**
 * Os perfis com as escritas retidas. Cada escrita consome a próxima resposta; depois da primeira
 * gravada, a recarga demora `ATRASO_DA_RECARGA_EM_MS` e responde conforme `recarga`.
 */
class PerfisComEscritasRetidas {
  readonly envios: Envio[] = [];
  private readonly barreira = reter();
  private readonly perfil = { ...PERFIL };
  private gravou = false;
  private consultas = 0;

  constructor(
    private readonly respostas: readonly Resposta[],
    private readonly recarga: Recarga,
    private readonly primeiraConsulta: 'ok' | 'falha',
  ) {}

  readonly liberar = () => this.barreira.liberar();

  readonly atender = async (route: Route): Promise<void> => {
    const metodo = route.request().method();
    if (metodo === 'OPTIONS') await responderPreflight(route);
    else if (metodo === 'GET') await this.consultar(route);
    else await this.escrever(route);
  };

  private async consultar(route: Route): Promise<void> {
    this.consultas += 1;
    if (this.primeiraConsulta === 'falha' && this.consultas === 1) {
      await responder(route, { status: 500, corpo: ERRO_INTERNO });
      return;
    }
    if (this.consultas > 1) await esperarARecarga();
    if (this.gravou && this.recarga === 'com-falha') {
      await responder(route, { status: 500, corpo: ERRO_INTERNO });
      return;
    }
    const caminho = new URL(route.request().url()).pathname;
    await responder(route, { status: 200, corpo: this.corpoDaConsulta(caminho) });
  }

  /** A contenção vazia, o detalhe do perfil com a situação atual ou a lista, conforme o caminho. */
  private corpoDaConsulta(caminho: string): unknown {
    if (caminho.endsWith('/contencao')) return [];
    if (caminho.endsWith(`/perfis/${PERFIL.id}`)) {
      const desativadoDesde = this.perfil.ativo ? null : '2026-11-10T12:00:00Z';
      return { ...DETALHE_DO_PERFIL, ativo: this.perfil.ativo, desativadoDesde };
    }
    return this.gravou && this.recarga === 'sem-o-item' ? [] : [this.perfil];
  }

  private async escrever(route: Route): Promise<void> {
    const requisicao = route.request();
    const resposta = this.respostas[this.envios.length] ?? OK;
    this.envios.push(envioDe(requisicao, requisicao.headers()['idempotency-key']));
    await this.barreira.retida;
    if (resposta.status < 300) this.gravar(requisicao.url());
    await responder(
      route,
      resposta.status === 201 ? { status: 201, corpo: ENVIO_DO_DOCUMENTO } : resposta,
    );
  }

  private gravar(url: string): void {
    this.gravou = true;
    if (url.endsWith('/desativacao')) this.perfil.ativo = false;
    if (url.endsWith('/reativacao')) this.perfil.ativo = true;
  }
}

function confirmarDocumento(route: Route) {
  const preflight = route.request().method() === 'OPTIONS';
  return route.fulfill({
    status: preflight ? 204 : 200,
    headers: CORS_HEADERS,
    ...(preflight ? {} : { json: {} }),
  });
}

/** O catálogo de permissões e o envio do documento, de que a criação do perfil depende. */
async function mockCatalogoEDocumento(page: Page): Promise<void> {
  await page.route(/\/api\/autorizacao\/permissoes(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: CATALOGO }),
  );
  await page.route(URL_DE_ENVIO, (route) =>
    route.fulfill({ status: 200, headers: { ...CORS_HEADERS, etag: '"etag-do-teste"' } }),
  );
  await page.route(ROTA_DA_CONFIRMACAO, confirmarDocumento);
}

/** Simula os perfis, o catálogo e o envio do documento, com as escritas retidas até `liberar`. */
export async function mockPerfis(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga = 'com-o-item',
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  const perfis = new PerfisComEscritasRetidas(respostas, recarga, primeiraConsulta);
  await mockCatalogoEDocumento(page);
  await page.route(ROTA_DOS_PERFIS, perfis.atender);
  return { liberar: perfis.liberar, envios: perfis.envios };
}

import { type Page, type Route } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import {
  FUNDAMENTOS_DE_ISENCAO,
  PROCESSO_PUBLICADO_DA_MEDICINA,
  TIPOS_DE_PROCESSO,
} from '../fixtures/consulta-da-medicina';
import { PERMISSOES_DO_LEANDRO } from './permissoes';
import { responder, responderCom } from './responder';

export const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };
export const PALMAS = { codigoIbge: '1721000', nome: 'Palmas', uf: 'TO' };
const MUNICIPIOS = [MARABA, PALMAS];
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type',
};

type Municipio = { codigoIbge: string; uf: string };
type Declaracao = { temProvaPresencial: boolean; municipios: Municipio[] };
type Recusa = { field: string; code: string; message: string };

/** Estado da API simulada, isolado por teste. */
export class ApiDaProvaPresencial {
  declaracao: Declaracao | null = null;
  recusas: Recusa[] = [];
  geoIndisponivel = false;
  puts: Declaracao[] = [];
  releituras = 0;

  async instalar(page: Page, permissoes: readonly string[] = PERMISSOES_DO_LEANDRO): Promise<void> {
    await responder(page, /\/api\//, [], CORS);
    await mockPermissoesEfetivas(page, permissoes);
    await this.catalogos(page);
    await page.route(/\/api\/cidades(?:\/[^?]+)?(?:\?.*)?$/, (route) => this.geo(route));
    await page.route(
      new RegExp(
        `/api/selecao/processos-seletivos/${PROCESSO_PUBLICADO_DA_MEDICINA.id}(?:[/?].*)?$`,
      ),
      (route) => this.processo(route),
    );
  }

  private async catalogos(page: Page): Promise<void> {
    await responder(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_DE_PROCESSO, CORS);
    await responder(
      page,
      /\/api\/selecao\/fundamentos-isencao(\?.*)?$/,
      FUNDAMENTOS_DE_ISENCAO,
      CORS,
    );
  }

  private async geo(route: Route): Promise<void> {
    if (await preflight(route)) return;
    if (this.geoIndisponivel) {
      await route.fulfill({ status: 503, headers: CORS });
      return;
    }
    await responderCom(route, this.municipiosDa(new URL(route.request().url())) ?? [], CORS);
  }

  private municipiosDa(url: URL): unknown {
    const termo = (url.searchParams.get('q') ?? '').toLocaleLowerCase('pt-BR');
    const codigo = url.pathname.split('/').pop();
    if (codigo !== 'cidades')
      return MUNICIPIOS.find((municipio) => municipio.codigoIbge === codigo);
    return MUNICIPIOS.filter((municipio) =>
      municipio.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  }

  private async processo(route: Route): Promise<void> {
    if (await preflight(route)) return;
    const caminho = new URL(route.request().url()).pathname;
    if (caminho.endsWith('/prova-presencial') && route.request().method() === 'PUT') {
      await this.gravar(route);
    } else if (caminho.endsWith(PROCESSO_PUBLICADO_DA_MEDICINA.id)) {
      if (this.puts.length && !this.recusas.length) this.releituras++;
      await responderCom(route, this.detalhe(), CORS);
    } else if (caminho.endsWith('/documentos-a-publicar')) {
      await responderCom(route, [], CORS);
    } else {
      await route.fulfill({ status: 404, headers: CORS });
    }
  }

  private detalhe(): object {
    const provaPresencial = this.declaracao && {
      ...this.declaracao,
      municipios: this.declaracao.municipios.map((municipio) => ({
        ...municipio,
        nome: MUNICIPIOS.find((item) => item.codigoIbge === municipio.codigoIbge)?.nome ?? null,
      })),
    };
    return {
      ...PROCESSO_PUBLICADO_DA_MEDICINA,
      situacao: { codigo: 'RASCUNHO', rotulo: 'Rascunho' },
      provaPresencial,
    };
  }

  private async gravar(route: Route): Promise<void> {
    const corpo = route.request().postDataJSON() as Declaracao;
    this.puts.push(corpo);
    if (this.recusas.length) {
      await route.fulfill(problemaDeRecusa(this.recusas));
      return;
    }
    this.declaracao = corpo;
    await route.fulfill({ status: 204, headers: CORS });
  }
}

function problemaDeRecusa(recusas: Recusa[]) {
  return {
    status: 422,
    headers: CORS,
    contentType: 'application/problem+json',
    body: JSON.stringify({
      type: 'https://exemplo.org/erros/recusa',
      title: 'Recusa',
      status: 422,
      code: 'recusa',
      traceId: 'teste',
      errors: recusas,
    }),
  };
}

async function preflight(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false;
  await route.fulfill({ status: 204, headers: CORS });
  return true;
}

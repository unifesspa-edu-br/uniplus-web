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
import { PERFIL } from './api-de-perfis-escritas';

export const CONCESSAO = {
  id: '01960000-0000-7000-0000-0000000000c1',
  beneficiario: { emissor: 'unifesspa', sub: 'sub-betina-0002-ficticia' },
  perfil: { id: PERFIL.id, nome: PERFIL.nome },
  versao: 1,
  escopo: { tipo: 'unidade', unidadeId: '01960000-0000-7000-0000-00000000aa01' },
  origem: { tipo: 'pedido', id: '01960000-0000-7000-0000-00000000cc01' },
  concedidaEm: '2026-10-28T12:00:00Z',
  validaAte: null,
  revogadaEm: null,
  revogadaPor: null,
  motivoRevogacao: null,
  ativa: true,
};

/**
 * As concessões com a revogação retida. A recusa que diz que a lista mudou também conta como
 * gravação: a recarga seguinte traz o estado novo.
 */
class ConcessoesComEscritasRetidas {
  readonly envios: Envio[] = [];
  private readonly barreira = reter();
  private gravou = false;

  constructor(
    private readonly respostas: readonly Resposta[],
    private readonly recarga: Recarga,
  ) {}

  readonly liberar = () => this.barreira.liberar();

  readonly atender = async (route: Route): Promise<void> => {
    const metodo = route.request().method();
    if (metodo === 'OPTIONS') await responderPreflight(route);
    else if (metodo === 'GET') await this.consultar(route);
    else await this.escrever(route);
  };

  private async consultar(route: Route): Promise<void> {
    if (this.gravou) await esperarARecarga();
    if (this.gravou && this.recarga === 'com-falha') {
      await responder(route, { status: 500, corpo: ERRO_INTERNO });
      return;
    }
    const semOItem = this.gravou && this.recarga === 'sem-o-item';
    await responder(route, { status: 200, corpo: semOItem ? [] : [CONCESSAO] });
  }

  private async escrever(route: Route): Promise<void> {
    const resposta = this.respostas[this.envios.length] ?? OK;
    this.envios.push(envioDe(route.request(), undefined));
    await this.barreira.retida;
    if (resposta.status < 300 || resposta.listaMudou) this.gravou = true;
    await responder(route, resposta);
  }
}

/** Simula as concessões e as unidades, com a revogação retida até `liberar`. */
export async function mockConcessoes(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga = 'sem-o-item',
) {
  const concessoes = new ConcessoesComEscritasRetidas(respostas, recarga);
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: [] }),
  );
  await page.route(
    /\/api\/autorizacao\/concessoes(\/[^/?]+\/revogacao)?(\?.*)?$/,
    concessoes.atender,
  );
  return { liberar: concessoes.liberar, envios: concessoes.envios };
}

import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CIDADES,
  MARABA,
  PARAUAPEBAS,
  montarNovo,
  type PaginaNova,
} from './calendario-dias-uteis.testing';

describe('Busca de municípios na criação', () => {
  let pagina: PaginaNova;
  beforeEach(async () => {
    ligarRelogioControlado();
    pagina = await montarNovo();
  });
  afterEach(() => {
    pagina.http.verify();
    vi.useRealTimers();
  });

  it('só busca a partir de três letras e usa a UF do dia', async () => {
    const indice = await pagina.adicionarDia();
    await pagina.preencherDia(indice, 'MUNICIPAL', '2026-04-05');
    pagina.escolher(pagina.dia(indice, 'uf') as HTMLSelectElement, 'SP');
    const campo = pagina.dia(indice, 'codigo-municipio') as HTMLInputElement;
    pagina.escrever(campo, 'Ma');
    await passarOTempo(400);
    pagina.http.expectNone((pedido) => pedido.url === CIDADES);
    pagina.escrever(campo, 'Mar');
    await passarOTempo(400);
    const pedido = pagina.http.expectOne((requisicao) => requisicao.url === CIDADES);
    expect(pedido.request.params.get('q')).toBe('Mar');
    expect(pedido.request.params.get('uf')).toBe('SP');
    pedido.flush([]);
  });

  it('mantém as buscas de dois dias independentes', async () => {
    const primeiro = await pagina.adicionarDia();
    const segundo = await pagina.adicionarDia();
    await pagina.preencherDia(primeiro, 'MUNICIPAL', '2026-04-05');
    await pagina.preencherDia(segundo, 'MUNICIPAL', '2026-04-06');
    pagina.escrever(pagina.dia(primeiro, 'codigo-municipio') as HTMLInputElement, 'Mar');
    pagina.escrever(pagina.dia(segundo, 'codigo-municipio') as HTMLInputElement, 'Par');
    await passarOTempo(400);
    const pedidos = pagina.http.match((pedido) => pedido.url === CIDADES);
    expect(pedidos.map((pedido) => pedido.request.params.get('q')).sort()).toEqual(['Mar', 'Par']);
    pedidos.find((pedido) => pedido.request.params.get('q') === 'Mar')?.flush([MARABA]);
    pedidos.find((pedido) => pedido.request.params.get('q') === 'Par')?.flush([PARAUAPEBAS]);
    await pagina.propagar();
    const campos = pagina.fixture.nativeElement.querySelectorAll('ui-valor-de-municipio');
    expect(campos[0].textContent).toContain('Marabá (PA)');
    expect(campos[1].textContent).toContain('Parauapebas (PA)');
  });
});

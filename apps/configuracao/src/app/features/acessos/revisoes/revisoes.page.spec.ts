import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevisaoResumoDto } from '@uniplus/shared-data/autorizacao';
import { ok, recusaPeloInterceptor } from '../testes';
import {
  CONDUZIR,
  CONSULTAR,
  REVER,
  api,
  assentar,
  botao,
  botoes,
  leituras,
  notificacoes,
  pessoa,
  provedores,
} from './revisao.testing';
import { RevisoesPage } from './revisoes.page';

const ABERTA: RevisaoResumoDto = {
  id: 'r1',
  abertaEm: '2026-11-09T12:00:00Z',
  abertaPor: pessoa('sub-betina', 'Betina Neves'),
  situacao: 'em_andamento',
  totalDeItens: 4,
  pendentes: 3,
};
const ENCERRADA: RevisaoResumoDto = {
  ...ABERTA,
  id: 'r0',
  abertaEm: '2026-05-04T12:00:00Z',
  situacao: 'concluida',
  pendentes: 0,
};

async function abrirLista(concedidas: readonly string[], lista = ok([ABERTA, ENCERRADA])) {
  leituras.mockReturnValue(of(lista));
  TestBed.configureTestingModule({ providers: provedores(concedidas) });
  const fixture = TestBed.createComponent(RevisoesPage);
  const host = fixture.nativeElement as HTMLElement;
  document.body.appendChild(host);
  fixture.detectChanges();
  await assentar();
  return { fixture, host };
}

function escolher(host: HTMLElement, situacao: string): void {
  const filtro = host.querySelector<HTMLSelectElement>('select');
  if (filtro === null) throw new Error('filtro ausente');
  filtro.value = situacao;
  filtro.dispatchEvent(new Event('change'));
}

const linhas = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>('tr[data-revisao-id]')].map((l) => l.dataset['revisaoId']);

describe('RevisoesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lista revisões abertas e encerradas, com o link do resultado', async () => {
    const { host } = await abrirLista([CONSULTAR]);

    expect(linhas(host)).toEqual(['r1', 'r0']);
    expect(host.textContent).toContain('Aberta');
    expect(host.textContent).toContain('Encerrada');
    expect(host.querySelector('tr[data-revisao-id="r0"] a')?.getAttribute('href')).toBe(
      '/acessos/revisoes/r0',
    );
  });

  it('sem filtro, lê todas as revisões sem o parâmetro de situação', async () => {
    await abrirLista([CONSULTAR]);

    expect(leituras).toHaveBeenCalledTimes(1);
    expect(leituras.mock.calls[0]?.[0]).not.toContain('situacao=');
  });

  it('filtra por situação no servidor e mostra o que a API devolve', async () => {
    const { fixture, host } = await abrirLista([CONSULTAR]);
    leituras.mockReturnValue(of(ok([ENCERRADA])));

    escolher(host, 'concluida');
    fixture.detectChanges();
    await assentar();

    expect(leituras.mock.lastCall?.[0]).toContain('situacao=concluida');
    expect(linhas(host)).toEqual(['r0']);
  });

  it('a troca de situação volta à primeira página, sem o cursor da anterior', async () => {
    const { fixture, host } = await abrirLista(
      [CONSULTAR],
      ok([ABERTA], '<http://api.test/x?cursor=proximo>; rel="next"'),
    );
    host.querySelector<HTMLButtonElement>('[data-pager="next"]')?.click();
    await assentar();
    expect(leituras.mock.lastCall?.[0]).toContain('cursor=');

    escolher(host, 'em_andamento');
    fixture.detectChanges();
    await assentar();

    expect(leituras.mock.lastCall?.[0]).toContain('situacao=em_andamento');
    expect(leituras.mock.lastCall?.[0]).not.toContain('cursor=');
  });

  it('diz que não há revisão na situação escolhida', async () => {
    const { host } = await abrirLista([CONSULTAR], ok([]));

    expect(host.textContent).toContain('Nenhuma revisão nesta situação.');
  });

  it.each([
    ['quem conduz', [CONDUZIR], true],
    ['quem revê', [REVER], false],
    ['quem só consulta', [CONSULTAR], false],
  ] as const)('%s vê "Abrir revisão": %s', async (_, concedidas, ve) => {
    const { host } = await abrirLista(concedidas);

    expect(botoes(host).includes('Abrir revisão')).toBe(ve);
  });

  it('abre a revisão e segue para o detalhe dela', async () => {
    api.abrir.mockReturnValue(of(ok({ id: 'r2' })));
    const { host } = await abrirLista([CONDUZIR]);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    botao(host, 'Abrir revisão').click();
    await assentar();

    expect(api.abrir).toHaveBeenCalledTimes(1);
    expect(notificacoes.success).toHaveBeenCalledWith('Revisão de acessos aberta');
    expect(navegar).toHaveBeenCalledWith(['/acessos/revisoes', 'r2']);
  });

  it('com revisão já em andamento, explica e não sai da lista', async () => {
    api.abrir.mockReturnValue(
      of(recusaPeloInterceptor('uniplus.autorizacao.revisao.ja_ha_em_andamento', 409, 'x')),
    );
    const { host } = await abrirLista([CONDUZIR]);

    botao(host, 'Abrir revisão').click();
    await assentar();

    expect(host.textContent).toContain('Não foi possível abrir a revisão');
    expect(host.textContent).toContain('Já existe revisão de acessos em andamento.');
  });
});

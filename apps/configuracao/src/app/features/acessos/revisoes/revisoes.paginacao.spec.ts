import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevisaoResumoDto } from '@uniplus/shared-data/autorizacao';
import { ok } from '../testes';
import {
  CONSULTAR,
  assentar,
  botao,
  botoes,
  leituras,
  pessoa,
  provedores,
} from './revisao.testing';
import { RevisoesPage } from './revisoes.page';

const RESUMO: RevisaoResumoDto = {
  id: 'r1',
  abertaEm: '2026-11-09T12:00:00Z',
  abertaPor: pessoa('sub-betina', 'Betina Neves'),
  situacao: 'em_andamento',
  totalDeItens: 4,
  pendentes: 3,
};
const PROXIMA = '<http://api.test/api/autorizacao/revisoes?cursor=c2&direction=next>; rel="next"';

const falhaDoRegistro = () =>
  throwError(
    () =>
      new HttpErrorResponse({
        status: 503,
        error: {
          type: 'x',
          title: 'Registro de acesso indisponível',
          status: 503,
          code: 'uniplus.autorizacao.registro_de_acesso.falha_ao_gravar',
        },
      }),
  );

async function abrirLista() {
  TestBed.configureTestingModule({ providers: provedores([CONSULTAR]) });
  const fixture = TestBed.createComponent(RevisoesPage);
  const host = fixture.nativeElement as HTMLElement;
  document.body.appendChild(host);
  fixture.detectChanges();
  await assentar();
  return host;
}

const linhas = (host: HTMLElement) => host.querySelectorAll('tr[data-revisao-id]');

describe('lista de revisões: nenhum dado antigo à vista', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('com 503 ao avançar de página, mostra a falha sem os itens nem os cursores da página anterior', async () => {
    let vez = 0;
    leituras.mockImplementation(() =>
      vez++ === 0 ? of(ok([RESUMO], PROXIMA)) : falhaDoRegistro(),
    );
    const host = await abrirLista();
    expect(linhas(host)).toHaveLength(1);

    botao(host, 'Próximo').click();
    await assentar();

    expect(host.textContent).toContain('Não foi possível carregar as revisões');
    expect(linhas(host)).toHaveLength(0);
    expect(botoes(host)).not.toContain('Próximo');
    expect(botoes(host)).not.toContain('Anterior');
  });
});

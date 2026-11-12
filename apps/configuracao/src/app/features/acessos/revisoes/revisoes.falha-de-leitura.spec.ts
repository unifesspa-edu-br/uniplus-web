import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevisaoResumoDto } from '@uniplus/shared-data/autorizacao';
import { ok } from '../testes';
import {
  CONDUZIR,
  CONSULTAR,
  ID,
  assentar,
  botao,
  botoes,
  leituras,
  pessoa,
  provedores,
  revisao,
} from './revisao.testing';
import { RevisaoDetalhePage } from './revisao-detalhe.page';
import { RevisoesPage } from './revisoes.page';

/** O registro de acesso não gravou: a API não entrega o dado e a leitura pode ser repetida. */
const REGISTRO_NAO_GRAVOU = 'uniplus.autorizacao.registro_de_acesso.falha_ao_gravar';
const TITULO_DA_FALHA = 'Não foi possível registrar o acesso aos dados.';

function falhaDoRegistro() {
  return throwError(
    () =>
      new HttpErrorResponse({
        status: 503,
        statusText: 'Service Unavailable',
        headers: undefined,
        error: { type: 'x', title: TITULO_DA_FALHA, status: 503, code: REGISTRO_NAO_GRAVOU },
      }),
  );
}

const RESUMO: RevisaoResumoDto = {
  id: 'r1',
  abertaEm: '2026-11-09T12:00:00Z',
  abertaPor: pessoa('sub-betina', 'Betina Neves'),
  situacao: 'em_andamento',
  totalDeItens: 4,
  pendentes: 3,
};

/** As leituras em sequência: a primeira falha e a seguinte entrega o dado. */
function falhaEDepois(resposta: unknown) {
  let vez = 0;
  leituras.mockImplementation(() => (vez++ === 0 ? falhaDoRegistro() : of(resposta)));
}

async function abrirDetalheQueFalha(resposta: unknown, concedidas: readonly string[] = [CONDUZIR]) {
  falhaEDepois(resposta);
  TestBed.configureTestingModule({ providers: provedores(concedidas) });
  const fixture = TestBed.createComponent(RevisaoDetalhePage);
  fixture.componentRef.setInput('id', ID);
  const host = fixture.nativeElement as HTMLElement;
  document.body.appendChild(host);
  fixture.detectChanges();
  await assentar();
  return host;
}

async function abrirLista() {
  TestBed.configureTestingModule({ providers: provedores([CONDUZIR]) });
  const fixture = TestBed.createComponent(RevisoesPage);
  const host = fixture.nativeElement as HTMLElement;
  document.body.appendChild(host);
  fixture.detectChanges();
  await assentar();
  return host;
}

describe('revisão de acessos com o registro de acesso fora do ar (503)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('a lista mostra a falha sem nenhuma revisão e lê de novo em "Tentar novamente"', async () => {
    falhaEDepois(ok([RESUMO]));
    const host = await abrirLista();

    expect(host.textContent).toContain('Não foi possível carregar');
    expect(host.querySelectorAll('tr[data-revisao-id]')).toHaveLength(0);
    expect(botoes(host)).toContain('Tentar novamente');

    botao(host, 'Tentar novamente').click();
    await assentar();

    expect(leituras).toHaveBeenCalledTimes(2);
    expect(host.querySelectorAll('tr[data-revisao-id]')).toHaveLength(1);
    expect(botoes(host)).not.toContain('Tentar novamente');
  });

  it('o detalhe mostra a falha sem item nem ação e lê de novo em "Tentar novamente"', async () => {
    const host = await abrirDetalheQueFalha(ok(revisao()));

    expect(host.textContent).toContain('Não foi possível carregar a revisão');
    expect(host.querySelectorAll('tr[data-item-id]')).toHaveLength(0);
    expect(botoes(host)).toEqual(['Tentar novamente']);

    botao(host, 'Tentar novamente').click();
    await assentar();

    expect(leituras).toHaveBeenCalledTimes(2);
    expect(host.querySelectorAll('tr[data-item-id]')).toHaveLength(4);
    expect(botoes(host)).not.toContain('Tentar novamente');
  });

  it('o Encarregado de dados, só de consulta, vê a falha sem nenhum dado da revisão', async () => {
    const host = await abrirDetalheQueFalha(ok(revisao()), [CONSULTAR]);

    expect(host.textContent).toContain('Não foi possível carregar a revisão');
    expect(host.textContent).not.toContain('Fernanda Drumond');
    expect(host.querySelector('cfg-itens-do-beneficiario')).toBeNull();
    expect(botoes(host)).toEqual(['Tentar novamente']);
  });
});

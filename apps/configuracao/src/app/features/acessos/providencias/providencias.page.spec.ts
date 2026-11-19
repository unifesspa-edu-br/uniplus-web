import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildVendorMimeAccept } from '@uniplus/shared-core/http';
import type { ProvidenciaResumoDto } from '@uniplus/shared-data/autorizacao';
import { ProvidenciasPage } from './providencias.page';
import {
  ADMINISTRAR,
  ROTA,
  assentar,
  montar,
  problema,
  providencia,
  type Montagem,
} from './providencias.testing';

/** O item da fila: a providência sem o fundamento, que só sai no detalhe. */
function resumo(id: string, abertaEm: string): ProvidenciaResumoDto {
  const completa = providencia({ id, abertaEm });
  const campos = Object.entries(completa).filter(([campo]) => campo !== 'fundamento');
  return { ...(Object.fromEntries(campos) as ProvidenciaResumoDto), desfecho: null };
}

const FILA = [resumo('a', '2026-11-01T12:00:00Z'), resumo('b', '2026-11-05T12:00:00Z')];

describe('ProvidenciasPage', () => {
  let tela: Montagem<ProvidenciasPage>;

  beforeEach(async () => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    tela = montar(ProvidenciasPage, [ADMINISTRAR]);
    tela.fixture.detectChanges();
    await assentar();
  });

  afterEach(() => {
    tela.http.verify();
    document.body.innerHTML = '';
  });

  const leitura = () => tela.http.expectOne((r) => r.url === ROTA);
  const linhas = () => [...tela.host.querySelectorAll('tbody tr')];

  it('lê as abertas por padrão, no media type da providência, na ordem da API', async () => {
    const req = leitura();
    expect(req.request.params.get('situacao')).toBe('aberta');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('providencia', 1));
    req.flush(FILA);
    await assentar();

    expect(linhas().map((l) => l.getAttribute('data-providencia-id'))).toEqual(['a', 'b']);
    expect(linhas()[0]?.textContent).toContain('Retirada do acesso');
    expect(linhas()[0]?.querySelector('a, [href]')?.getAttribute('href')).toContain(
      '/acessos/providencias/a',
    );
  });

  it('o filtro de situação relê a fila com a situação escolhida', async () => {
    leitura().flush(FILA);
    await assentar();
    const filtro = tela.host.querySelector('select') as HTMLSelectElement;
    filtro.value = 'todas';
    filtro.dispatchEvent(new Event('change'));
    await assentar();

    expect(leitura().request.params.get('situacao')).toBe('todas');
  });

  it('a página seguinte segue o cursor do header Link', async () => {
    leitura().flush(FILA, {
      headers: { Link: '</api/autorizacao/providencias?cursor=abc&direction=next>; rel="next"' },
    });
    await assentar();
    const proxima = [...tela.host.querySelectorAll('button')].find((b) =>
      /Próxim/.test(b.textContent ?? ''),
    );
    proxima?.click();
    await assentar();

    const req = leitura();
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('direction')).toBe('next');
    req.flush([]);
    await assentar();
  });

  it('o 503 na página seguinte não deixa a página anterior à vista nem os cursores', async () => {
    leitura().flush(FILA, {
      headers: { Link: '</api/autorizacao/providencias?cursor=abc&direction=next>; rel="next"' },
    });
    await assentar();
    [...tela.host.querySelectorAll('button')]
      .find((b) => /Próxim/.test(b.textContent ?? ''))
      ?.click();
    await assentar();

    leitura().flush(...problema(503, 'uniplus.autorizacao.registro_de_acesso.falha_ao_gravar'));
    await assentar();

    expect(tela.host.textContent).toContain('Não foi possível carregar as providências');
    expect(linhas()).toHaveLength(0);
    expect(tela.host.querySelector('ui-pager')).toBeNull();
  });

  it('sem registro da leitura (503) mostra a falha, sem a fila', async () => {
    leitura().flush(...problema(503, 'uniplus.autorizacao.registro_de_acesso.falha_ao_gravar'));
    await assentar();

    expect(tela.host.textContent).toContain('Não foi possível carregar as providências');
    expect(linhas()).toHaveLength(0);
  });
});

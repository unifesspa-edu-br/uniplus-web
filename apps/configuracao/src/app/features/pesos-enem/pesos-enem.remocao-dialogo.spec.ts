import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BASE,
  PaginaDeTeste,
  RES_750,
  RES_805,
  linhas750,
  linhas805,
  problem,
} from './pesos-enem.testing';

describe('PesosEnemPage — remoção', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_ConfirmarRemocao_Remove4LinhasERecarrega', async () => {
    await t.carregarUmaPagina([...linhas805, ...linhas750]);
    t.remocao.pedir(RES_805);
    t.remocao.confirmar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    for (const req of requests) {
      expect(req.request.method).toBe('DELETE');
      expect(req.request.headers.has('Idempotency-Key')).toBe(false);
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    t.expectListagem().flush([...linhas750]);
    await t.propagate();

    expect(t.store.resolucoes()).toEqual([RES_750]);
  });

  it('PesosEnemPage_RemoverResolucaoEmEdicao_LimpaSessaoAntesDoReload', async () => {
    // Regressão: remover a MESMA resolução que está em
    // edição deixa editandoResolucao()/editForm() presos aos ids antigos.
    // Como o identificador pode ser reaproveitado, um novo cadastro
    // com o mesmo texto de resolução faria o panel novo renderizar "já em
    // edição" com o form antigo — e Salvar tentaria PUT em linhas que não
    // existem mais.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    expect(t.edicao.emEdicao()).toBe(RES_805);

    t.remocao.pedir(RES_805);
    t.remocao.confirmar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    for (const req of requests) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    expect(t.edicao.emEdicao()).toBeNull();
    expect(t.edicao.form()).toBeNull();

    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_RemocaoParcial_ExibeAvisoERecarrega', async () => {
    await t.carregarUmaPagina([...linhas805]);
    const remocaoButtonEl = t.fixture.nativeElement.querySelector(
      '.button-actions > .btn--tertiary',
    ) as HTMLButtonElement;
    expect(remocaoButtonEl).toBeTruthy();
    expect(remocaoButtonEl.getAttribute('aria-label')).toBe('Remover resolução ' + RES_805);
    expect(remocaoButtonEl.textContent).toContain('Remover resolução');
    t.remocao.pedir(RES_805);
    t.remocao.confirmar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[1]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[2]?.flush(
      problem(404, 'uniplus.configuracao.peso_area_enem.nao_encontrado', 'Não encontrado'),
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    requests[3]?.flush(
      problem(404, 'uniplus.configuracao.peso_area_enem.nao_encontrado', 'Não encontrado'),
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await t.propagate();

    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_ReuseAposRemocao_NaoBloqueiaNovaResolucao', async () => {
    // Simula que, após a resolução ter sido removida (não está mais entre os
    // vivos retornados pela listagem), o mesmo identificador pode ser
    // reutilizado sem 409 — a página não faz checagem client-side de
    // duplicidade, apenas reflete o que o backend aceitar.
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: RES_805,
      baseLegalGlobal: 'Res. 805/2024 Anexo I',
    });
    t.criacao.criar();
    await t.propagate();

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(requests).toHaveLength(4);
    requests.forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await t.propagate();

    expect(t.criacao.aberto()).toBe(false);
    t.expectListagem().flush([...linhas805]);
    await t.propagate();
    expect(t.store.resolucoes()).toEqual([RES_805]);
  });
});

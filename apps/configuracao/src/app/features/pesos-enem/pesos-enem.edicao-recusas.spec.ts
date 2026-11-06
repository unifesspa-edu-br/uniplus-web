import { TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BASE,
  RES_805,
  areaDo,
  erroDaArea,
  linhas805,
  problem,
  PaginaDeTeste,
} from './pesos-enem.testing';

describe('PesosEnemPage — recusas no envio da edição', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());
  it('PesosEnemPage_Salvar_TravaInputsDuranteEnvioEReabilitaSoALinhaComFalha', async () => {
    // Regressão: sem travar os inputs durante o envio, o
    // usuário podia editar um valor depois do snapshot já ter sido enviado
    // ao backend (mas antes do PUT resolver) — aplicarLinhasAtualizadas()
    // gravaria em registros() esse valor nunca persistido.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    t.edicao.salvar();
    await t.propagate();

    // Somente leitura pelo fieldset da grade: o estado dos controles não muda.
    const formEmVoo = t.edicao.form();
    const inputs = t.raiz.querySelectorAll<HTMLInputElement>('.pe-grid input');
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input.matches(':disabled')).toBe(true);
    }
    for (const grupo of formEmVoo?.controls ?? []) {
      expect(grupo.disabled).toBe(false);
    }

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(
      problem(
        422,
        'uniplus.configuracao.peso_area_enem.peso_excede_maximo',
        'Peso excede o máximo',
      ),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    requests[1]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[2]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[3]?.flush(null, { status: 204, statusText: 'No Content' });
    await t.propagate();

    const form = t.edicao.form();
    expect(form?.controls[0]?.disabled).toBe(false);
    expect(form?.controls[1]?.disabled).toBe(true);
    expect(t.raiz.querySelector<HTMLInputElement>('.pe-grid fieldset')?.disabled).toBe(false);
  });

  it('PesosEnemPage_RecusaSemErrorsNaEdicao_VaiAoBannerSemMarcarCampo', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const naoEncontrado = JSON.parse(
      problem(
        404,
        'uniplus.configuracao.peso_area_enem.nao_encontrado',
        'Linha de pesos não encontrada',
      ),
    ) as Parameters<ProblemI18nService['resolve']>[0];
    requests[0]?.flush(JSON.stringify(naoEncontrado), {
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'application/problem+json' },
    });
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    const titulo = TestBed.inject(ProblemI18nService).resolve(naoEncontrado).title;
    expect(t.edicao.erro()).toContain(titulo);
    const grupo = t.edicao.form()?.controls[0];
    expect(erroDaArea(areaDo(grupo, 'REDACAO'), 'peso')).toBeNull();
    expect(t.edicao.form()?.invalid).toBe(false);
  });

  it('PesosEnemPage_RecusaSemCampoNaEdicao_BannerEhRegiaoViva', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(
      problem(
        404,
        'uniplus.configuracao.peso_area_enem.nao_encontrado',
        'Linha de pesos não encontrada',
      ),
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();
    t.fixture.detectChanges();

    const banner = (t.fixture.nativeElement as HTMLElement).querySelector('#grid-pe-bar .alert');
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(banner?.textContent).toContain(t.edicao.erro() ?? '<sem mensagem>');
  });

  it('PesosEnemPage_EdicaoEmLinha_RecusaDefinitivaSemErrors_ReenvioIgualSaiComChaveNova', async () => {
    // A API guarda a recusa 4xx: reenviar o mesmo corpo com a mesma chave devolveria
    // a mesma recusa, mesmo depois de a causa externa ter sido resolvida.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const chaveOriginal = requests[0]?.request.headers.get('Idempotency-Key');
    requests[0]?.flush(problem(403, 'uniplus.auth.forbidden', 'Sem permissão'), {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'content-type': 'application/problem+json' },
    });
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    t.edicao.salvar();
    await t.propagate();
    const retry = t.controller.expectOne(
      `${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[0]?.id}`,
    );
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    retry.flush(null, { status: 204, statusText: 'No Content' });
    await t.propagate();
  });
});

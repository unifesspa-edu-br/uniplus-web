import { TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BASE, areaDo, erroDaArea, problem, recusa422, PaginaDeTeste } from './pesos-enem.testing';

describe('PesosEnemPage — recusas do servidor no cadastro', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());
  it('PesosEnemPage_Drawer_ErroDoCampoEntraNaDescricaoDoInput', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
    t.criacao.criar();
    await t.propagate();

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    recusa422(requests[0], [
      { field: 'areas[4].peso', code: 'c1', message: 'O peso de Matemática excede o máximo.' },
      { field: 'areas[0].corte', code: 'c2', message: 'O corte de Redação excede o máximo.' },
    ]);
    requests
      .slice(1)
      .forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    const descricao = (input: HTMLInputElement | null): string =>
      (input?.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => raiz.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? '')
        .join(' | ');

    const peso = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Peso de Matemática e suas Tecnologias — Tecnológica"]',
    );
    expect(descricao(peso)).toBe('O peso de Matemática excede o máximo.');

    const corte = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Corte de Redação — Tecnológica"]',
    );
    expect(descricao(corte)).toBe(
      'Opcional — em branco, a área fica sem corte. | O corte de Redação excede o máximo.',
    );

    // Sem erro, só a dica descreve o corte, e o peso não tem descrição.
    const pesoSemErro = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Peso de Redação — Tecnológica"]',
    );
    expect(pesoSemErro?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('PesosEnemPage_Drawer_ErroDeResolucaoVaiAoCampoDaResolucaoEDestravaReenvio', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: 'Res',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
    t.criacao.criar();
    await t.propagate();

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(requests).toHaveLength(4);
    for (const req of requests) {
      recusa422(req, [
        {
          field: 'resolucao',
          code: 'uniplus.configuracao.peso_area_enem.resolucao_tamanho',
          message: 'Resolução deve ter entre 5 e 40 caracteres.',
        },
      ]);
    }
    await t.propagate();

    expect(t.erroDoCampoLote('resolucao')).toBe('Resolução deve ter entre 5 e 40 caracteres.');
    const redacao = areaDo(t.criacao.form.controls.grupos.controls[0], 'REDACAO');
    expect(erroDaArea(redacao, 'peso')).toBeNull();

    // Corrigir a resolução limpa o erro, e o reenvio volta a sair.
    t.criacao.form.controls.resolucao.setValue('Res. 900/2026');
    t.criacao.criar();
    await t.propagate();
    const reenvio = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(reenvio).toHaveLength(4);
    reenvio.forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await t.propagate();
    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_Drawer_ErroDeGrupoQueNaoSeEditaVaiAoBanner', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
    t.criacao.criar();
    await t.propagate();

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    for (const req of requests) {
      recusa422(req, [{ field: 'grupoCurso', code: 'c1', message: 'Grupo fora do domínio.' }]);
    }
    await t.propagate();

    expect(t.criacao.erro()).toContain('Tecnológica: Grupo fora do domínio.');
    const redacao = areaDo(t.criacao.form.controls.grupos.controls[0], 'REDACAO');
    expect(erroDaArea(redacao, 'peso')).toBeNull();
  });

  it('PesosEnemPage_Drawer_DuplicidadeSemGrupoCriado_MostraMensagensSemCampoDosOutros', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
    t.criacao.criar();
    await t.propagate();

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(requests).toHaveLength(4);
    requests[0]?.flush(
      problem(409, 'uniplus.configuracao.peso_area_enem.par_ja_existe', 'Já existe'),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    for (const req of requests.slice(1)) {
      recusa422(req, [{ field: 'grupoCurso', code: 'c1', message: 'Grupo fora do domínio.' }]);
    }
    await t.propagate();

    expect(t.erroDoCampoLote('resolucao')).toBe(
      'Resolução já cadastrada. Informe um identificador diferente.',
    );
    expect(t.criacao.erro()).toContain('Humanística I: Grupo fora do domínio.');
    expect(t.criacao.erro()).toContain('Saúde e Biológicas: Grupo fora do domínio.');
  });

  it('PesosEnemPage_Drawer_CampoDePrimeiroNivelComPrefixoEMaiuscula_VaiAoCampoCerto', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({ resolucao: 'Res', baseLegalGlobal: 'Base' });
    t.criacao.criar();
    await t.propagate();

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    recusa422(requests[0], [
      { field: 'Request.Resolucao', code: 'c1', message: 'Resolução curta demais.' },
      { field: '$.BaseLegal', code: 'c2', message: 'Base legal curta demais.' },
    ]);
    for (const req of requests.slice(1)) {
      recusa422(req, [
        { field: 'Request.Resolucao', code: 'c1', message: 'Resolução curta demais.' },
      ]);
    }
    await t.propagate();

    expect(t.erroDoCampoLote('resolucao')).toBe('Resolução curta demais.');
    expect(t.erroDoCampoGrupo(0, 'baseLegal')).toBe('Base legal curta demais.');
    expect(t.criacao.erro()).not.toContain('curta demais');
  });

  it('PesosEnemPage_RecusaSemErrorsNaCriacao_VaiAoBannerSemMarcarCampo', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
    t.criacao.criar();
    await t.propagate();

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    const conflito = JSON.parse(
      problem(409, 'uniplus.idempotency.processing_conflict', 'Conflito de concorrência'),
    ) as Parameters<ProblemI18nService['resolve']>[0];
    requests[0]?.flush(JSON.stringify(conflito), {
      status: 409,
      statusText: 'Conflict',
      headers: { 'content-type': 'application/problem+json' },
    });
    requests
      .slice(1)
      .forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await t.propagate();

    const titulo = TestBed.inject(ProblemI18nService).resolve(conflito).title;
    expect(t.criacao.erro()).toContain(titulo);
    const redacao = areaDo(t.criacao.form.controls.grupos.controls[0], 'REDACAO');
    expect(erroDaArea(redacao, 'peso')).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BASE,
  RES_805,
  areaDo,
  erroDaArea,
  linhas805,
  problem,
  recusa422,
  PaginaDeTeste,
} from './pesos-enem.testing';

describe('PesosEnemPage — recusas do servidor', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_ErroDoBackendPorArea_VaiAoCampoDaArea', async () => {
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
        422,
        'uniplus.configuracao.peso_area_enem.corte_excede_maximo',
        'Corte acima do máximo',
        [
          {
            field: 'areas[3].corte',
            code: 'uniplus.configuracao.peso_area_enem.corte_excede_maximo',
            message: 'O corte de Linguagens e suas Tecnologias não pode exceder 1.000.',
          },
          {
            field: 'areas[4].peso',
            code: 'uniplus.configuracao.peso_area_enem.peso_excede_maximo',
            message: 'O peso de Matemática e suas Tecnologias não pode exceder 99.99.',
          },
        ],
      ),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    const grupo = t.edicao.form()?.controls[0];
    expect(erroDaArea(areaDo(grupo, 'LINGUAGENS'), 'corte')).toBe(
      'O corte de Linguagens e suas Tecnologias não pode exceder 1.000.',
    );
    expect(erroDaArea(areaDo(grupo, 'MATEMATICA'), 'peso')).toBe(
      'O peso de Matemática e suas Tecnologias não pode exceder 99.99.',
    );
    expect(erroDaArea(areaDo(grupo, 'REDACAO'), 'peso')).toBeNull();
  });

  it('PesosEnemPage_AreaFaltandoNoBackend_VaiAoPrimeiroPeso', async () => {
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
    requests[0]?.flush(
      problem(422, 'uniplus.configuracao.peso_area_enem.area_faltando', 'Área faltando', [
        {
          field: 'areas',
          code: 'uniplus.configuracao.peso_area_enem.area_faltando',
          message: 'Informe o peso das cinco áreas; faltam: MATEMATICA.',
        },
      ]),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    requests
      .slice(1)
      .forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await t.propagate();

    const grupo0 = t.criacao.form.controls.grupos.controls[0];
    expect(erroDaArea(areaDo(grupo0, 'REDACAO'), 'peso')).toBe(
      'Informe o peso das cinco áreas; faltam: MATEMATICA.',
    );
  });

  it('PesosEnemPage_ErroDoBackendComPrefixoOuMaiuscula_VaiAoCampoCerto', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(
      problem(422, 'uniplus.configuracao.peso_area_enem.corte_excede_maximo', 'Recusa', [
        { field: 'request.Areas[3].corte', code: 'c1', message: 'Erro no corte de Linguagens.' },
        { field: '$.areas[2]', code: 'c2', message: 'Erro no item de Ciências Humanas.' },
        { field: 'Areas[4].Peso', code: 'c3', message: 'Erro no peso de Matemática.' },
      ]),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    const grupo = t.edicao.form()?.controls[0];
    expect(erroDaArea(areaDo(grupo, 'LINGUAGENS'), 'corte')).toBe('Erro no corte de Linguagens.');
    expect(erroDaArea(areaDo(grupo, 'CIENCIAS_HUMANAS'), 'peso')).toBe(
      'Erro no item de Ciências Humanas.',
    );
    expect(erroDaArea(areaDo(grupo, 'MATEMATICA'), 'peso')).toBe('Erro no peso de Matemática.');
  });

  it('PesosEnemPage_VariosErrosNoMesmoCampo_MostraTodos', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(
      problem(422, 'uniplus.configuracao.peso_area_enem.area_fora_do_dominio', 'Recusa', [
        { field: 'areas[0].codigo', code: 'c1', message: 'Área fora do Peso por Área.' },
        { field: 'areas[0].peso', code: 'c2', message: 'O peso não pode ser negativo.' },
        { field: 'areas', code: 'c3', message: 'Faltam áreas: MATEMATICA.' },
      ]),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    const erro = erroDaArea(areaDo(t.edicao.form()?.controls[0], 'REDACAO'), 'peso');
    expect(erro).toContain('Área fora do Peso por Área.');
    expect(erro).toContain('O peso não pode ser negativo.');
    expect(erro).toContain('Faltam áreas: MATEMATICA.');
  });

  it('PesosEnemPage_SairDoCampoComTab_NaoApagaOErroDoBackend', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    recusa422(requests[0], [
      {
        field: 'areas[3].corte',
        code: 'uniplus.configuracao.peso_area_enem.corte_excede_maximo',
        message: 'O corte não pode exceder 1.000.',
      },
    ]);
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();
    t.fixture.detectChanges();

    t.inputDaEdicao('corte', 0, 3).dispatchEvent(new FocusEvent('blur'));
    t.fixture.detectChanges();

    const linguagens = areaDo(t.edicao.form()?.controls[0], 'LINGUAGENS');
    expect(erroDaArea(linguagens, 'corte')).toBe('O corte não pode exceder 1.000.');
    expect(t.edicao.form()?.invalid).toBe(true);
  });

  it('PesosEnemPage_ErroDeBaseLegalNaEdicaoEmLinha_VaiAoBannerSemTravarCampo', async () => {
    // A edição em linha não mostra nem edita a base legal: o erro dela não pode ficar
    // num controle escondido (trava o formulário sem mensagem) nem num campo que não é
    // o dele (o operador mexeria no lugar errado e reenviaria o mesmo pedido).
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    recusa422(requests[0], [
      {
        field: 'baseLegal',
        code: 'uniplus.configuracao.peso_area_enem.base_legal_tamanho',
        message: 'Base legal deve ter no máximo 500 caracteres.',
      },
    ]);
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    const grupo = t.edicao.form()?.controls[0];
    if (!grupo) throw new Error('form de edição não inicializado');
    expect(t.edicao.erro()).toContain('Tecnológica: Base legal deve ter no máximo 500 caracteres.');
    expect(grupo.controls.baseLegal.errors).toBeNull();
    expect(erroDaArea(areaDo(grupo, 'REDACAO'), 'peso')).toBeNull();
    expect(t.edicao.form()?.invalid).toBe(false);

    // O operador pode desistir da edição.
    t.edicao.cancelar();
    expect(t.edicao.emEdicao()).toBeNull();
  });
});

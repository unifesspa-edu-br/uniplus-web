import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BASE,
  RES_805,
  areaDo,
  erroDaArea,
  linhas805,
  pesoDe,
  problem,
  PaginaDeTeste,
} from './pesos-enem.testing';

describe('PesosEnemPage — envio da edição em linha', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_Salvar_CoordenaQuatroChamadasComIdempotencyKeyDistintas', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    const form = t.edicao.form();
    areaDo(form?.controls[0], 'MATEMATICA').controls.peso.setValue(3.0);
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const chaves = new Set<string | null>();
    for (const req of requests) {
      expect(req.request.method).toBe('PUT');
      chaves.add(req.request.headers.get('Idempotency-Key'));
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    expect(chaves.size).toBe(4);
    await t.propagate();

    expect(t.edicao.emEdicao()).toBeNull();
    expect(
      pesoDe(
        t.store.registros().find((l) => l.id === linhas805[0]?.id),
        'MATEMATICA',
      ),
    ).toBe(3.0);
  });

  it('PesosEnemPage_Salvar_CorteForaDaRedacaoVaiNoItemDaArea', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    areaDo(t.edicao.form()?.controls[0], 'MATEMATICA').controls.corte.setValue(450);
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const corpo = requests[0]?.request.body as {
      areas: { codigo: string; peso: number; corte: number | null }[];
    };
    expect(corpo.areas.find((a) => a.codigo === 'MATEMATICA')).toEqual({
      codigo: 'MATEMATICA',
      peso: 2.5,
      corte: 450,
    });
    // Área em branco segue sem corte.
    expect(corpo.areas.find((a) => a.codigo === 'CIENCIAS_HUMANAS')?.corte).toBeNull();
    for (const req of requests) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();
  });

  it('PesosEnemPage_CorteVazioNaEdicao_ViajaComoSemCorte', async () => {
    // O corte é opcional: limpar o campo é "sem corte", não erro de campo
    // obrigatório — o PUT leva corte null para a área.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    const redacao = areaDo(t.edicao.form()?.controls[0], 'REDACAO');
    redacao.controls.corte.setValue(null);
    redacao.controls.corte.markAsTouched();
    expect(redacao.controls.corte.valid).toBe(true);
    expect(erroDaArea(redacao, 'corte')).toBeNull();

    t.edicao.salvar();
    await t.propagate();
    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const corpo = requests[0]?.request.body as {
      areas: { codigo: string; corte: number | null }[];
    };
    expect(corpo.areas.find((a) => a.codigo === 'REDACAO')?.corte).toBeNull();
    for (const req of requests) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();
  });

  it('PesosEnemPage_IdempotencyKey_PreservadaEmRetryComMesmoCorpo', async () => {
    // Um retry idêntico (corpo inalterado) reusa a mesma key — cobre o
    // caso de falha transitória (rede/5xx) e de retry sem correção alguma.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    areaDo(t.edicao.form()?.controls[0], 'MATEMATICA').controls.peso.setValue(3.0);
    t.edicao.salvar();
    await t.propagate();

    const requests1 = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const chaveOriginal = requests1[0]?.request.headers.get('Idempotency-Key');
    requests1[0]?.flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    for (const req of requests1.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    expect(t.edicao.erro()).toContain('1 de 4');

    // Retry sem alterar nada — mesmo corpo, mesma key.
    t.edicao.salvar();
    await t.propagate();
    const retry = t.controller.expectOne(
      `${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[0]?.id}`,
    );
    expect(retry.request.headers.get('Idempotency-Key')).toBe(chaveOriginal);
    retry.flush(null, { status: 204, statusText: 'No Content' });
    await t.propagate();

    expect(t.edicao.emEdicao()).toBeNull();
  });

  it('PesosEnemPage_IdempotencyKey_RenovadaQuandoCorpoMudaApos422', async () => {
    // Regressão: a maioria dos 422 de peso/corte é rejeitada por exceção do
    // FluentValidation, que descarta a reserva de idempotência — reenviar
    // com a mesma key funciona. Mas há um caminho de erro de domínio
    // (retornado como Result, não lançado) que é cacheado pelo idempotency
    // store; reenviar corpo diferente sob a mesma key nesse caso
    // conflitaria como corpo divergente. Comparar o payload evita depender
    // de saber qual caminho ocorreu: corrigir o valor renova a key.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    t.edicao.salvar();
    await t.propagate();

    const requests1 = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const chaveOriginal = requests1[0]?.request.headers.get('Idempotency-Key');
    requests1[0]?.flush(
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
    for (const req of requests1.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    // Usuário muda um valor antes de reenviar (a recusa sem `errors[]` vai ao banner,
    // sem apontar campo).
    areaDo(t.edicao.form()?.controls[0], 'REDACAO').controls.peso.setValue(2.0);
    t.edicao.salvar();
    await t.propagate();
    const retry = t.controller.expectOne(
      `${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[0]?.id}`,
    );
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    retry.flush(null, { status: 204, statusText: 'No Content' });
    await t.propagate();

    expect(t.edicao.emEdicao()).toBeNull();
  });

  it('PesosEnemPage_FalhaTransitoria_NaoTravaFormNemImpedeRetryImediato', async () => {
    // Regressão: status 0/5xx é transitório — não pode pinar um erro sintético em
    // campo nenhum, que invalidaria o form e bloquearia o retry até o usuário editar
    // algum campo só para limpá-lo.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    requests[1]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[2]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[3]?.flush(null, { status: 204, statusText: 'No Content' });
    await t.propagate();

    const grupoFalho = t.edicao.form()?.controls[0];
    expect(areaDo(grupoFalho, 'REDACAO').controls.peso.errors).toBeNull();
    expect(t.edicao.form()?.invalid).toBe(false);

    // Retry imediato, sem editar nada — deve disparar o PUT de novo.
    t.edicao.salvar();
    await t.propagate();
    const retry = t.controller.expectOne(
      `${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[0]?.id}`,
    );
    retry.flush(null, { status: 204, statusText: 'No Content' });
    await t.propagate();
    expect(t.edicao.emEdicao()).toBeNull();
  });

  it('PesosEnemPage_LinhaSalvaEmRodadaParcial_FicaTravadaENaoSofreDriftLocal', async () => {
    // Regressão: numa falha parcial, a linha que já teve sucesso não pode
    // continuar editável — senão uma edição local não reenviada seria
    // gravada em `registros` como se estivesse persistida.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[1]?.flush(
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
    requests[2]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[3]?.flush(null, { status: 204, statusText: 'No Content' });
    await t.propagate();

    const grupoSalvo = t.edicao.form()?.controls[0];
    expect(grupoSalvo?.disabled).toBe(true);
    expect(t.edicao.estadoLinhas().get(linhas805[0]?.id ?? '')).toBe('ok');
  });
});

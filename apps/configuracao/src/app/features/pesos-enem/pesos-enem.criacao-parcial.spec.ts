import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BASE,
  LIST_URL,
  PaginaDeTeste,
  RES_805,
  areaDo,
  linhas805,
  problem,
} from './pesos-enem.testing';

describe('PesosEnemPage — cadastro com sucesso parcial', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_CancelarDrawerAposSucessoParcial_RecarregaLista', async () => {
    // Regressão: se 1+ grupos já foram criados antes de o
    // usuário desistir do restante, cancelar sem recarregar deixaria esses
    // grupos invisíveis em registros() até um reload manual.
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
    requests[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
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
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await t.propagate();

    // Simula o fechamento real: o botão Cancelar (ou X/Esc do próprio
    // ui-drawer) muda `drawerAberto`, e o drawer emite `(closed)` ao
    // terminar de fechar — aoFecharDrawerCriacao() é o handler desse evento.
    t.criacao.aberto.set(false);
    t.criacao.aoFechar();
    await t.propagate();

    expect(t.criacao.aberto()).toBe(false);
    // A recarga da lista é disparada — sem ela, este GET não seria esperado.
    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_CancelarDrawerSemSucessoParcial_NaoRecarrega', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.aberto.set(false);
    t.criacao.aoFechar();
    await t.propagate();

    expect(t.criacao.aberto()).toBe(false);
    t.controller.expectNone((r) => r.url === LIST_URL);
  });

  it('PesosEnemPage_DrawerFechadoComPostsEmVoo_RecarregaAoChegarSucessoParcial', async () => {
    // Regressão: se o drawer fecha (X/Esc) ENQUANTO os 4
    // POSTs ainda estão em voo, aoFecharDrawerCriacao() roda antes de
    // qualquer resultado chegar e não vê sucesso para recarregar. Quando o
    // forkJoin resolve depois (parcial), o branch de falha precisa detectar
    // que o drawer já está fechado e recarregar ali mesmo.
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

    // Usuário fecha o drawer (X/Esc) antes de qualquer POST responder.
    t.criacao.aberto.set(false);
    t.criacao.aoFechar();
    await t.propagate();
    t.controller.expectNone((r) => r.url === LIST_URL);

    // Só agora as respostas chegam — 1 falha, 3 sucesso.
    requests[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
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
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await t.propagate();

    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_ReabrirDrawerDuranteSubmit_NaoResetaSessaoEmVoo', async () => {
    // Regressão: pesoLoteForm é uma única instância
    // reaproveitada entre sessões — reabrir enquanto submitting() é true
    // resetaria/reabilitaria os MESMOS FormGroups que o forkJoin da sessão
    // anterior ainda referencia, deixando a resposta tardia mexer nos
    // campos da sessão nova que o usuário já está preenchendo.
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

    // Tenta reabrir/reset enquanto o envio está em voo — deve ser no-op.
    t.criacao.abrir();
    expect(t.criacao.form.controls.resolucao.value).toBe('Res. 900/2026');

    for (const req of requests) {
      req.flush(`novo-id`, { status: 201, statusText: 'Created' });
    }
    await t.propagate();
    t.expectListagem().flush([]);
    await t.propagate();

    // Só agora, com o envio concluído, abrir reseta normalmente.
    t.criacao.abrir();
    expect(t.criacao.form.controls.resolucao.value).toBe('');
  });

  it('PesosEnemPage_FecharDrawerDuranteRetrySubmitting_NaoRecarregaPrematuramente', async () => {
    // Regressão: fechar o drawer ENQUANTO um retry de
    // grupo pendente está em voo não pode disparar um carregar() prematuro
    // — isso "venceria" a corrida contra o reload legítimo que
    // criarResolucao() dispara ao concluir, e esse seria descartado pelo
    // guard de isLoading() em carregar(), publicando a lista sem o grupo
    // recém-criado no retry.
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
    t.criacao.criar();
    await t.propagate();

    const primeiraRodada = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(primeiraRodada).toHaveLength(4);
    primeiraRodada[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
    primeiraRodada[1]?.flush(
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
    primeiraRodada[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    primeiraRodada[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await t.propagate();

    // Muda um valor do grupo que falhou (a recusa sem `errors[]` vai ao banner) e
    // reenvia (retry só do pendente).
    areaDo(t.criacao.form.controls.grupos.controls[1], 'REDACAO').controls.peso.setValue(2.0);
    t.criacao.criar();
    await t.propagate();
    const retry = t.controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );

    // Fecha o drawer ENQUANTO o retry ainda está em voo — não deve disparar GET.
    t.criacao.aberto.set(false);
    t.criacao.aoFechar();
    await t.propagate();
    t.controller.expectNone((r) => r.url === LIST_URL);

    // Só quando o retry resolve com sucesso o reload de fato acontece.
    retry.flush('novo-id-1', { status: 201, statusText: 'Created' });
    await t.propagate();
    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_ResolucaoDuplicada_MapeiaErroNoCampo', async () => {
    await t.carregarUmaPagina([...linhas805]);
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
    for (const req of requests) {
      req.flush(problem(409, 'uniplus.configuracao.peso_area_enem.par_ja_existe', 'Já existe'), {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      });
    }
    await t.propagate();

    expect(t.erroDoCampoLote('resolucao')).toBe(
      'Resolução já cadastrada. Informe um identificador diferente.',
    );
    expect(t.criacao.aberto()).toBe(true);
  });

  it('PesosEnemPage_DuplicidadeComSucessoParcial_NaoInstruiTrocarCampoTravado', async () => {
    // Regressão: quando 3 de 4 grupos são criados e o 4º retorna
    // par_ja_existe (ex.: uma tentativa anterior criou aquele grupo
    // silenciosamente e a resposta se perdeu), resolucao já está travada
    // pelo sucesso dos outros — pedir "informe um identificador diferente"
    // num campo desabilitado é uma instrução impossível de seguir. Nesse
    // caso o aviso vai só para o banner geral, sem pinar erro no campo.
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
    requests[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
    requests[1]?.flush(
      problem(409, 'uniplus.configuracao.peso_area_enem.par_ja_existe', 'Já existe'),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await t.propagate();

    expect(t.criacao.form.controls.resolucao.disabled).toBe(true);
    expect(t.erroDoCampoLote('resolucao')).toBeNull();
    expect(t.criacao.erro()).toContain('já criados foram salvos');
    expect(t.criacao.aberto()).toBe(true);
  });

  it('PesosEnemPage_SucessoParcialNaCriacao_TravaResolucaoContraMistura', async () => {
    // Regressão: se o usuário mudasse `resolucao` após um sucesso parcial, o
    // reenvio dos grupos pendentes criaria uma resolução distinta da dos
    // grupos já persistidos — misturando duas resoluções na mesma sessão.
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
    requests[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
    requests[1]?.flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await t.propagate();

    expect(t.criacao.form.controls.resolucao.disabled).toBe(true);

    t.criacao.abrir();
    expect(t.criacao.form.controls.resolucao.disabled).toBe(false);
  });

  it('PesosEnemPage_BaseLegalGlobal_PrePreencheGruposPristine', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.controls.baseLegalGlobal.setValue('Res. 900/2026 Anexo I');
    await t.propagate();

    for (const grupo of t.criacao.form.controls.grupos.controls) {
      expect(grupo.controls.baseLegal.value).toBe('Res. 900/2026 Anexo I');
    }
  });

  it('PesosEnemPage_BaseLegalGlobal_NaoPropagaParaGrupoJaCriado', async () => {
    // Regressão: grupo 'ok'/desabilitado não entra mais no
    // próximo POST — propagar o valor global faria o card "Criado" mostrar
    // uma base legal nunca enviada ao backend (a linha real fica com a
    // antiga).
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Base original',
    });
    t.criacao.criar();
    await t.propagate();

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(requests).toHaveLength(4);
    requests[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
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
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await t.propagate();

    t.criacao.form.controls.baseLegalGlobal.setValue('Base corrigida');
    await t.propagate();

    expect(t.criacao.form.controls.grupos.controls[0]?.controls.baseLegal.value).toBe(
      'Base original',
    );
    expect(t.criacao.form.controls.grupos.controls[1]?.controls.baseLegal.value).toBe(
      'Base corrigida',
    );
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AREAS,
  BASE,
  GRUPOS,
  PaginaDeTeste,
  areaDo,
  grupo,
  linhas805,
  problem,
} from './pesos-enem.testing';

describe('PesosEnemPage — cadastro de resolução', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_Drawer_Cria4GruposFixosComGrupoCursoReadonly', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    await t.propagate();

    const grupos = t.criacao.form.controls.grupos.controls;
    expect(grupos).toHaveLength(4);
    expect(grupos.map((g) => g.controls.grupoCurso.value)).toEqual(GRUPOS);

    const legendas = t.fixture.nativeElement.querySelectorAll('.field-group legend');
    expect(legendas).toHaveLength(4);

    // As áreas de cada grupo são as da API, na ordem dela, e funcionam com o cadastro vazio.
    for (const grupo of grupos) {
      expect(grupo.controls.areas.controls.map((a) => a.controls.codigo.value)).toEqual(
        AREAS.map((a) => a.codigo),
      );
    }
  });

  it('PesosEnemPage_ResolucaoVazia_InvalidaFormDeCriacao', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.criar();
    await t.propagate();

    t.controller.expectNone((r) => r.url.includes('/admin/pesos-area-enem'));
    expect(t.erroDoCampoLote('resolucao')).toBe('Campo obrigatório.');
  });

  it('PesosEnemPage_Criar_CoordenaQuatroChamadasComIdempotencyKeyPropria', async () => {
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
    const chaves = new Set<string | null>();
    requests.forEach((req, i) => {
      expect(req.request.method).toBe('POST');
      chaves.add(req.request.headers.get('Idempotency-Key'));
      req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' });
    });
    expect(chaves.size).toBe(4);
    await t.propagate();

    expect(t.criacao.aberto()).toBe(false);
    t.expectListagem().flush(linhas805.map((l) => ({ ...l, resolucao: 'Res. 900/2026' })));
    await t.propagate();
  });

  it('PesosEnemPage_Criar_CamposDeTextoEmBrancoViajamComoNull', async () => {
    // `Validators.required` aceita espaços em branco: sem normalizar, o payload
    // levaria '' e o backend responderia sobre formato, não sobre ausência.
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({ resolucao: '   ', baseLegalGlobal: '  ' });
    t.criacao.criar();
    await t.propagate();

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(requests).toHaveLength(4);
    requests.forEach((req, i) => {
      expect(req.request.body).toMatchObject({ resolucao: null, baseLegal: null });
      req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' });
    });
    await t.propagate();
    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_Criar_CodigosComEspacosViajamAparadosNoPayload', async () => {
    const areas = AREAS.map((a, i) => (i === 0 ? { ...a, codigo: ` ${a.codigo} ` } : a));
    const grupos = GRUPOS.map((g, i) => (i === 0 ? { ...g, codigo: ` ${g.codigo} ` } : g));
    await t.carregarUmaPagina([], areas, grupos);
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
    expect(requests).toHaveLength(GRUPOS.length);
    expect(requests.map((req) => req.request.body.grupoCurso)).toEqual(GRUPOS.map((g) => g.codigo));
    requests.forEach((req, i) => {
      expect(req.request.body.areas.map((a: { codigo: string }) => a.codigo)).toEqual(
        AREAS.map((a) => a.codigo),
      );
      req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' });
    });
    await t.propagate();
    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_FalhaTransitoriaNaCriacao_PreservaIdempotencyKey', async () => {
    // Regressão: renovar a key numa falha transitória
    // (rede/5xx) trocaria um retry idempotente seguro por uma criação
    // duplicada — o POST original pode ter sido processado no servidor
    // mesmo com a resposta perdida.
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
    t.criacao.criar();
    await t.propagate();

    const requests1 = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(requests1).toHaveLength(4);
    const chaveOriginal = requests1[0]?.request.headers.get('Idempotency-Key');
    requests1[0]?.flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    requests1
      .slice(1)
      .forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await t.propagate();

    expect(
      areaDo(t.criacao.form.controls.grupos.controls[0], 'REDACAO').controls.peso.errors,
    ).toBeNull();

    t.criacao.criar();
    await t.propagate();
    const retry = t.controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(retry.request.headers.get('Idempotency-Key')).toBe(chaveOriginal);
    retry.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await t.propagate();
    expect(t.criacao.aberto()).toBe(false);
    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_Criar_TravaGruposPendentesDuranteEnvio', async () => {
    // Regressão: sem travar os grupos pendentes durante o envio, o usuário
    // podia editar um valor depois do snapshot já ter sido enviado ao POST,
    // mas antes da resposta chegar — o sucesso posterior desabilitaria o
    // MESMO FormGroup marcando "Criado" com um valor diferente do que o
    // backend recebeu.
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
    t.criacao.criar();
    await t.propagate();

    // Somente leitura pelo fieldset do formulário: o estado dos controles não muda.
    const campos = t.raiz.querySelectorAll<HTMLInputElement>('ui-drawer input');
    expect(campos.length).toBeGreaterThan(0);
    for (const campo of campos) {
      expect(campo.matches(':disabled')).toBe(true);
    }
    for (const grupo of t.criacao.form.controls.grupos.controls) {
      expect(grupo.disabled).toBe(false);
    }

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(requests).toHaveLength(4);
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
    requests[1]?.flush('novo-id-1', { status: 201, statusText: 'Created' });
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await t.propagate();

    expect(t.criacao.form.controls.grupos.controls[0]?.disabled).toBe(false);
    expect(t.criacao.form.controls.grupos.controls[1]?.disabled).toBe(false);
    // Os grupos criados continuam somente leitura (o fieldset do grupo); o que falhou, não.
    const blocos = t.raiz.querySelectorAll<HTMLFieldSetElement>('ui-drawer fieldset.field-group');
    expect(blocos[0]?.disabled).toBe(false);
    expect(blocos[1]?.disabled).toBe(true);
  });

  it('PesosEnemPage_RetryComCorpoAlterado_RenovaIdempotencyKey', async () => {
    // Regressão: preservar a key de uma falha transitória só é seguro
    // enquanto o corpo reenviado for idêntico ao original. Se o usuário
    // altera o grupo que falhou antes de reenviar, o corpo muda — reusar a
    // mesma key arriscaria um conflito de idempotência (corpo divergente)
    // no backend.
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
    t.criacao.criar();
    await t.propagate();

    const requests1 = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(requests1).toHaveLength(4);
    const chaveOriginal = requests1[0]?.request.headers.get('Idempotency-Key');
    requests1[0]?.flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    requests1
      .slice(1)
      .forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await t.propagate();

    // Usuário altera o grupo que falhou antes de reenviar.
    areaDo(t.criacao.form.controls.grupos.controls[0], 'LINGUAGENS').controls.peso.setValue(3.5);
    t.criacao.criar();
    await t.propagate();
    const retry = t.controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    retry.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await t.propagate();
    expect(t.criacao.aberto()).toBe(false);
    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_Criar_EnviaAreasComCodigoPesoECorteSemRotulo', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
    const grupo0 = t.criacao.form.controls.grupos.controls[0];
    // O corte não é exclusivo da Redação: vai no item da própria área.
    areaDo(grupo0, 'MATEMATICA').controls.corte.setValue(450);
    areaDo(grupo0, 'MATEMATICA').controls.peso.setValue(2.5);
    t.criacao.criar();
    await t.propagate();

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(requests).toHaveLength(4);
    expect(requests[0]?.request.body).toEqual({
      resolucao: 'Res. 900/2026',
      grupoCurso: 'TECNOLOGICA',
      areas: [
        { codigo: 'REDACAO', peso: 0, corte: null },
        { codigo: 'CIENCIAS_DA_NATUREZA', peso: 0, corte: null },
        { codigo: 'CIENCIAS_HUMANAS', peso: 0, corte: null },
        { codigo: 'LINGUAGENS', peso: 0, corte: null },
        { codigo: 'MATEMATICA', peso: 2.5, corte: 450 },
      ],
      baseLegal: 'Res. 900/2026 Anexo I',
    });
    requests.forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await t.propagate();
    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_Drawer_GruposVemDaApiNaOrdemDelaEGravamPeloCodigo', async () => {
    // Outra lista e outra ordem: o cadastro acompanha a API, não uma lista do cliente.
    await t.carregarUmaPagina([], AREAS, [grupo('SAUDE_E_BIOLOGICAS'), grupo('TECNOLOGICA')]);
    t.criacao.abrir();
    await t.propagate();
    t.fixture.detectChanges();

    const legendas = Array.from(
      (t.fixture.nativeElement as HTMLElement).querySelectorAll('.field-group legend'),
      (legenda) => legenda.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(legendas).toEqual(['Saúde e Biológicas', 'Tecnológica']);
    expect(
      (t.fixture.nativeElement as HTMLElement).querySelector(
        'input[aria-label="Peso de Redação — Saúde e Biológicas"]',
      ),
    ).not.toBeNull();

    t.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
    t.criacao.criar();
    await t.propagate();

    const requests = t.controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(requests.map((req) => req.request.body.grupoCurso)).toEqual([
      'SAUDE_E_BIOLOGICAS',
      'TECNOLOGICA',
    ]);
    requests.forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await t.propagate();
    t.expectListagem().flush([]);
    await t.propagate();
  });

  it('PesosEnemPage_Criacao_RecusaDefinitivaSemErrors_ReenvioIgualSaiComChaveNova', async () => {
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
    const chaveOriginal = requests[0]?.request.headers.get('Idempotency-Key');
    requests[0]?.flush(
      problem(422, 'uniplus.configuracao.peso_area_enem.regra_qualquer', 'Recusa'),
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

    t.criacao.criar();
    await t.propagate();
    const retry = t.controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    retry.flush('novo-id-0', { status: 201, statusText: 'Created' });
    await t.propagate();
    t.expectListagem().flush([]);
    await t.propagate();
  });
});

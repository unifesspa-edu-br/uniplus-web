import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AREAS, GRUPOS, grupo, linhas805 } from './pesos-enem-exemplos.testing';
import {
  NAO_PROCESSAVEL,
  PROBLEMA_PESO_EXCEDE_MAXIMO,
  flushProblema,
  problem,
  responderCriacoes,
} from './pesos-enem-respostas.testing';
import { PaginaDeTeste, areaDo } from './pesos-enem.testing';

const CODIGO_DA_RECUSA = 'uniplus.configuracao.peso_area_enem.regra_qualquer';

const CORPO_DO_PRIMEIRO_GRUPO = {
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
};

describe('PesosEnemPage — cadastro de resolução', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_Drawer_Cria4GruposFixosComGrupoCursoReadonly', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    await t.atualizarAplicacao();
    const grupos = t.criacao.form.controls.grupos.controls;
    expect(grupos).toHaveLength(4);
    expect(grupos.map((g) => g.controls.grupoCurso.value)).toEqual(GRUPOS);
    expect(t.fixture.nativeElement.querySelectorAll('.field-group legend')).toHaveLength(4);
    // As áreas de cada grupo são as da API, na ordem dela, e funcionam com o cadastro vazio.
    const codigos = grupos.map((g) =>
      g.controls.areas.controls.map((a) => a.controls.codigo.value),
    );
    expect(codigos).toEqual(grupos.map(() => AREAS.map((a) => a.codigo)));
  });

  it('PesosEnemPage_ResolucaoVazia_InvalidaFormDeCriacao', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.criar();
    await t.atualizarAplicacao();
    t.controller.expectNone((r) => r.url.includes('/admin/pesos-area-enem'));
    expect(t.erroDoCampoLote('resolucao')).toBe('Campo obrigatório.');
  });

  it('PesosEnemPage_Criar_CoordenaQuatroChamadasComIdempotencyKeyPropria', async () => {
    await t.carregarUmaPagina([]);
    await t.abrirCadastroPreenchido();
    const requests = await t.enviarCriacaoPeloModelo();
    expect(requests).toHaveLength(4);
    expect(requests.map((req) => req.request.method)).toEqual(['POST', 'POST', 'POST', 'POST']);
    const chaves = new Set(requests.map((req) => req.request.headers.get('Idempotency-Key')));
    responderCriacoes(requests);
    expect(chaves.size).toBe(4);
    await t.atualizarAplicacao();
    expect(t.criacao.aberto()).toBe(false);
    t.expectListagem().flush(linhas805.map((l) => ({ ...l, resolucao: 'Res. 900/2026' })));
    await t.atualizarAplicacao();
  });

  // `Validators.required` aceita espaços em branco: sem normalizar, o payload levaria '' e o
  // backend responderia sobre formato, não sobre ausência.
  it('PesosEnemPage_Criar_CamposDeTextoEmBrancoViajamComoNull', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    t.criacao.form.patchValue({ resolucao: '   ', baseLegalGlobal: '  ' });
    const requests = await t.enviarCriacaoPeloModelo();
    expect(requests).toHaveLength(4);
    requests.forEach((req) => {
      expect(req.request.body).toMatchObject({ resolucao: null, baseLegal: null });
    });
    responderCriacoes(requests);
    await t.recarregarCom([]);
  });

  it('PesosEnemPage_Criar_CodigosComEspacosViajamAparadosNoPayload', async () => {
    const areas = AREAS.map((a, i) => (i === 0 ? { ...a, codigo: ` ${a.codigo} ` } : a));
    const grupos = GRUPOS.map((g, i) => (i === 0 ? { ...g, codigo: ` ${g.codigo} ` } : g));
    await t.carregarUmaPagina([], areas, grupos);
    await t.abrirCadastroPreenchido();
    const requests = await t.enviarCriacaoPeloModelo();
    expect(requests).toHaveLength(GRUPOS.length);
    expect(requests.map((req) => req.request.body.grupoCurso)).toEqual(GRUPOS.map((g) => g.codigo));
    const codigosDasAreas = requests.map((req) =>
      req.request.body.areas.map((a: { codigo: string }) => a.codigo),
    );
    expect(codigosDasAreas).toEqual(requests.map(() => AREAS.map((a) => a.codigo)));
    responderCriacoes(requests);
    await t.recarregarCom([]);
  });

  // Regressão: renovar a key numa falha transitória (rede/5xx) trocaria um retry idempotente
  // seguro por uma criação duplicada — o POST original pode ter sido processado no servidor
  // mesmo com a resposta perdida.
  it('PesosEnemPage_FalhaTransitoriaNaCriacao_PreservaIdempotencyKey', async () => {
    await t.carregarUmaPagina([]);
    const chaveOriginal = await t.criarComFalhaTransitoriaNoPrimeiro();
    expect(
      areaDo(t.criacao.form.controls.grupos.controls[0], 'REDACAO').controls.peso.errors,
    ).toBeNull();
    const retry = await t.reenviarCriacaoPeloModelo();
    expect(retry.request.headers.get('Idempotency-Key')).toBe(chaveOriginal);
    responderCriacoes([retry]);
    await t.atualizarAplicacao();
    expect(t.criacao.aberto()).toBe(false);
    await t.recarregarCom([]);
  });

  // Durante o envio os grupos pendentes ficam desabilitados: uma edição feita depois de o corpo partir
  // faria o card "Criado" exibir um valor diferente do que o servidor recebeu. O estado dos
  // controles não muda; o fieldset os desabilita.
  it('PesosEnemPage_Criar_DesabilitaGruposPendentesDuranteEnvio', async () => {
    await t.carregarUmaPagina([]);
    await t.abrirCadastroPreenchido();
    const requests = await t.enviarCriacaoPeloModelo();
    t.conferirCamposDoFormularioDesabilitados();
    expect(t.gruposDoCadastroDesabilitados()).toEqual([false, false, false, false]);
    expect(requests).toHaveLength(4);
    flushProblema(requests[0], NAO_PROCESSAVEL, PROBLEMA_PESO_EXCEDE_MAXIMO);
    responderCriacoes(requests.slice(1));
    await t.atualizarAplicacao();
    // Os grupos criados continuam somente leitura (o fieldset do grupo); o que falhou, não.
    expect(t.blocosDoDrawerDesabilitados().slice(0, 2)).toEqual([false, true]);
    expect(t.gruposDoCadastroDesabilitados().slice(0, 2)).toEqual([false, false]);
  });

  // Regressão: preservar a key de uma falha transitória só é seguro enquanto o corpo reenviado
  // for idêntico ao original. Se o usuário altera o grupo que falhou antes de reenviar, o corpo
  // muda — reusar a mesma key arriscaria um conflito de idempotência (corpo divergente) no
  // backend.
  it('PesosEnemPage_RetryComCorpoAlterado_RenovaIdempotencyKey', async () => {
    await t.carregarUmaPagina([]);
    const chaveOriginal = await t.criarComFalhaTransitoriaNoPrimeiro();
    areaDo(t.criacao.form.controls.grupos.controls[0], 'LINGUAGENS').controls.peso.setValue(3.5);
    const retry = await t.reenviarCriacaoPeloModelo();
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    responderCriacoes([retry]);
    await t.atualizarAplicacao();
    expect(t.criacao.aberto()).toBe(false);
    await t.recarregarCom([]);
  });

  it('PesosEnemPage_Criar_EnviaAreasComCodigoPesoECorteSemRotulo', async () => {
    await t.carregarUmaPagina([]);
    await t.abrirCadastroPreenchido();
    const grupo0 = t.criacao.form.controls.grupos.controls[0];
    // O corte não é exclusivo da Redação: vai no item da própria área.
    areaDo(grupo0, 'MATEMATICA').controls.corte.setValue(450);
    areaDo(grupo0, 'MATEMATICA').controls.peso.setValue(2.5);
    const requests = await t.enviarCriacaoPeloModelo();
    expect(requests).toHaveLength(4);
    expect(requests[0]?.request.body).toEqual(CORPO_DO_PRIMEIRO_GRUPO);
    responderCriacoes(requests);
    await t.recarregarCom([]);
  });

  // Outra lista e outra ordem: o cadastro acompanha a API, não uma lista do cliente.
  it('PesosEnemPage_Drawer_GruposVemDaApiNaOrdemDelaEGravamPeloCodigo', async () => {
    await t.carregarUmaPagina([], AREAS, [grupo('SAUDE_E_BIOLOGICAS'), grupo('TECNOLOGICA')]);
    t.criacao.abrir();
    t.preencherResolucaoDoCadastro();
    await t.propagar();
    expect(t.legendasDosGrupos()).toEqual(['Saúde e Biológicas', 'Tecnológica']);
    t.elemento('input[aria-label="Peso de Redação — Saúde e Biológicas"]');
    const requests = await t.enviarCriacaoPeloModelo();
    const codigos = requests.map((req) => req.request.body.grupoCurso);
    expect(codigos).toEqual(['SAUDE_E_BIOLOGICAS', 'TECNOLOGICA']);
    responderCriacoes(requests);
    await t.recarregarCom([]);
  });

  it('PesosEnemPage_Criacao_RecusaDefinitivaSemErrors_ReenvioIgualSaiComChaveNova', async () => {
    await t.carregarUmaPagina([]);
    await t.abrirCadastroPreenchido();
    const [primeira, ...demais] = await t.enviarCriacaoPeloModelo();
    const chaveOriginal = primeira?.request.headers.get('Idempotency-Key');
    flushProblema(primeira, NAO_PROCESSAVEL, problem(422, CODIGO_DA_RECUSA, 'Recusa'));
    responderCriacoes(demais);
    await t.atualizarAplicacao();
    const retry = await t.reenviarCriacaoPeloModelo();
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    responderCriacoes([retry]);
    await t.recarregarCom([]);
  });
});

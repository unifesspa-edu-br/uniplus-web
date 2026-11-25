import { tick } from './identificacao-identificador.testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  OrigemCandidatosCodigo,
  type ProcessoSeletivoDto,
  SituacaoDoProcessoSeletivoCodigo,
} from '@uniplus/shared-data/selecao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { IdentificacaoPassoComponent } from './identificacao.component';
import { GravacaoDaIdentificacao } from './servicos/gravacao-da-identificacao.service';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const TIPO_ID = '01960000-0000-7000-0000-0000000005bb';
const UNIDADE_ID = '01960000-0000-7000-0000-0000000005cc';
const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' } as const;

const unidadeSeed = {
  id: UNIDADE_ID,
  nome: 'Instituto de Ciências Exatas',
  alias: 'ICE',
  slug: 'ice',
  sigla: 'ICE',
  codigo: 'ICE',
  unidadeSuperiorId: null,
  tipo: 'Instituto',
  unidadeAcademica: true,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

/**
 * Recusa no formato que a API realmente emite. O `apiResultInterceptor` só
 * parseia o `code` quando o content type é `application/problem+json` — sem o
 * header, tudo vira `unexpected_response` e a regra de rotação de chave não
 * chega a ser exercida.
 */
function problema(status: number, code: string, title: string) {
  return {
    body: { type: 'about:blank', title, status, code, traceId: 'trace-1' },
    opts: {
      status,
      statusText: title,
      headers: { 'Content-Type': 'application/problem+json' },
    },
  };
}

describe('IdentificacaoPassoComponent', () => {
  let componente: IdentificacaoPassoComponent;
  let gravacao: GravacaoDaIdentificacao;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let host: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentificacaoPassoComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(IdentificacaoPassoComponent);
    componente = fixture.componentInstance;
    gravacao = fixture.debugElement.injector.get(GravacaoDaIdentificacao);
    host = fixture.nativeElement as HTMLElement;
    detectar = () => fixture.detectChanges();
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    // O componente carrega as unidades no construtor.
    controller.expectOne(`${BASE}/api/organizacao/unidades?limit=100`).flush([unidadeSeed]);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function preencherCamposDoComando(): void {
    store.patchObjectSection('tipoProcesso', { selected: TIPO_ID, rotulo: 'Vestibular' });
    store.patchObjectSection('identificacao', {
      nome: 'Processo Seletivo 2027',
      unidadeAdministradoraId: UNIDADE_ID,
      origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
      localidade: MARABA,
      identificadorLegivel: 'ps-2027',
    });
  }

  /** O valor que a consulta mostra sob o rótulo, ou `null` se o rótulo não está na tela. */
  function valorEmConsulta(rotulo: string): string | null {
    const par = Array.from(host.querySelectorAll('dl')).find(
      (dl) => dl.querySelector('dt')?.textContent?.trim() === rotulo,
    );
    return par?.querySelector('dd')?.textContent?.trim() ?? null;
  }

  /** O processo já criado, com o detalhe lido do servidor só no que o passo consulta. */
  function lerDetalhe(
    status: SituacaoDoProcessoSeletivoCodigo,
    identificadorLegivel: string | null,
  ): void {
    store.processoSeletivoId.set(PROCESSO_ID);
    store.remoteSnapshot.set({
      id: PROCESSO_ID,
      situacao: { codigo: status, rotulo: status },
      identificadorLegivel,
    } as unknown as ProcessoSeletivoDto);
    store.patchObjectSection('identificacao', { identificadorLegivel: identificadorLegivel ?? '' });
  }

  describe('identificador legível', () => {
    const URL_DO_IDENTIFICADOR = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/identificador-legivel`;
    const EM_USO = 'uniplus.selecao.processo_seletivo.identificador_legivel_em_uso';

    it('recusa o formato antes do envio e mostra o erro junto ao campo', () => {
      preencherCamposDoComando();
      store.patchObjectSection('identificacao', { identificadorLegivel: 'PSIQ 2026' });

      const resultado = componente.validar();
      detectar();

      expect(resultado.valid).toBe(false);
      const campo = host.querySelector('#f-identificador');
      const erro = host.querySelector('#f-identificador-erro');
      expect(campo?.getAttribute('aria-invalid')).toBe('true');
      expect(campo?.getAttribute('aria-describedby')).toBe(
        'f-identificador-erro f-identificador-hint',
      );
      expect(erro?.getAttribute('role')).toBe('alert');
      expect(erro?.textContent).toMatch(/^O identificador legível deve começar/);
    });

    it('exige o identificador para avançar', () => {
      preencherCamposDoComando();
      store.patchObjectSection('identificacao', { identificadorLegivel: '' });

      expect(componente.validar().messages).toContain(
        'Informe o identificador legível do processo seletivo.',
      );
    });

    it('recusa valor com a forma de um Guid', () => {
      preencherCamposDoComando();
      store.patchObjectSection('identificacao', {
        identificadorLegivel: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });

      expect(componente.validar().messages).toContain(
        'O identificador legível não pode ter a forma de um identificador técnico (Guid).',
      );
    });

    it('envia o identificador, sem os espaços das pontas, na criação', async () => {
      preencherCamposDoComando();
      store.patchObjectSection('identificacao', { identificadorLegivel: '  medicina-2027 ' });

      const criado = componente.persistir();
      const criacao = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
      expect(criacao.request.body).toMatchObject({ identificadorLegivel: 'medicina-2027' });
      criacao.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
      await tick();
      await criado;

      // O servidor tem o que foi enviado: avançar de novo não regrava.
      expect(componente.rotuloDeAvanco()).toBe('Próximo');
      controller.expectNone(
        `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/identificador-legivel`,
      );
    });

    it('mostra junto ao campo o identificador já usado por outro processo', async () => {
      preencherCamposDoComando();

      const criado = componente.persistir();
      const recusa = problema(
        409,
        EM_USO,
        'O identificador legível já é usado por outro processo seletivo',
      );
      controller
        .expectOne(`${BASE}/api/selecao/processos-seletivos`)
        .flush(recusa.body, recusa.opts);
      await tick();
      expect((await criado).valid).toBe(false);
      detectar();

      expect(gravacao.erroDoIdentificador()).toBe(
        'O identificador legível já é usado por outro processo seletivo',
      );
      expect(host.querySelector('#f-identificador')?.getAttribute('aria-invalid')).toBe('true');
      expect(host.querySelector('#f-identificador-erro')?.textContent).toContain('já é usado');
    });

    it('grava pelo PUT do campo o identificador trocado depois da criação', async () => {
      preencherCamposDoComando();
      lerDetalhe(SituacaoDoProcessoSeletivoCodigo.RASCUNHO, 'ps-2027');
      detectar();
      store.patchObjectSection('identificacao', { identificadorLegivel: 'ps-2027-medicina' });

      expect(componente.rotuloDeAvanco()).toBe('Gravar e avançar');
      const gravado = componente.persistir();
      const req = controller.expectOne(URL_DO_IDENTIFICADOR);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ identificadorLegivel: 'ps-2027-medicina' });
      req.flush(null, { status: 204, statusText: 'No Content' });
      await tick();

      expect((await gravado).valid).toBe(true);
      expect(componente.rotuloDeAvanco()).toBe('Próximo');
    });

    it('não regrava o identificador que o servidor já tem', async () => {
      preencherCamposDoComando();
      lerDetalhe(SituacaoDoProcessoSeletivoCodigo.RASCUNHO, 'ps-2027');
      detectar();

      expect((await componente.persistir()).valid).toBe(true);
      controller.expectNone(URL_DO_IDENTIFICADOR);
    });

    it('mostra junto ao campo a recusa do PUT', async () => {
      preencherCamposDoComando();
      lerDetalhe(SituacaoDoProcessoSeletivoCodigo.RASCUNHO, 'ps-2027');
      detectar();
      store.patchObjectSection('identificacao', { identificadorLegivel: 'medicina-2027' });

      const gravado = componente.persistir();
      const recusa = problema(
        409,
        EM_USO,
        'O identificador legível já é usado por outro processo seletivo',
      );
      controller.expectOne(URL_DO_IDENTIFICADOR).flush(recusa.body, recusa.opts);
      await tick();

      expect((await gravado).valid).toBe(false);
      expect(gravacao.erroDoIdentificador()).toContain('já é usado');
    });

    /**
     * A publicação liga a trava de orquestração antes de conferir e regravar os passos anteriores,
     * sem passar pelo "Próximo" da identificação. O identificador editado precisa ser conferido e
     * gravado nessa varredura — senão o processo publica com o valor antigo, que não muda mais.
     */
    it('confere e grava o identificador editado durante a varredura da publicação', async () => {
      preencherCamposDoComando();
      lerDetalhe(SituacaoDoProcessoSeletivoCodigo.RASCUNHO, 'ps-2027');
      detectar();
      store.patchObjectSection('identificacao', { identificadorLegivel: 'medicina-2027' });
      store.travamentoDeOrquestracao.set(true);

      expect(componente.validar().valid).toBe(true);
      const gravado = componente.persistir();
      const req = controller.expectOne(URL_DO_IDENTIFICADOR);
      expect(req.request.body).toEqual({ identificadorLegivel: 'medicina-2027' });
      req.flush(null, { status: 204, statusText: 'No Content' });
      await tick();

      expect((await gravado).valid).toBe(true);
    });

    it('barra a publicação com o identificador inválido e mostra o erro no campo', () => {
      preencherCamposDoComando();
      lerDetalhe(SituacaoDoProcessoSeletivoCodigo.RASCUNHO, 'ps-2027');
      store.patchObjectSection('identificacao', { identificadorLegivel: 'Medicina 2027' });
      store.travamentoDeOrquestracao.set(true);

      const resultado = componente.validar();
      detectar();

      expect(resultado.valid).toBe(false);
      expect(host.querySelector('#f-identificador-erro')?.textContent).toMatch(
        /^O identificador legível deve começar/,
      );
    });

    /**
     * Sem resposta conclusiva, o servidor pode ter gravado o valor novo. Voltar ao valor anterior
     * precisa reenviar — senão o processo publicaria com o que o servidor gravou, não com o da tela.
     */
    it('reenvia depois de uma gravação inconclusiva, mesmo de volta ao valor anterior', async () => {
      preencherCamposDoComando();
      lerDetalhe(SituacaoDoProcessoSeletivoCodigo.RASCUNHO, 'ps-2027');
      detectar();
      store.patchObjectSection('identificacao', { identificadorLegivel: 'medicina-2027' });

      const primeira = componente.persistir();
      const falha = problema(503, 'uniplus.internal.unexpected', 'Serviço indisponível');
      controller.expectOne(URL_DO_IDENTIFICADOR).flush(falha.body, falha.opts);
      await tick();
      expect((await primeira).valid).toBe(false);

      store.patchObjectSection('identificacao', { identificadorLegivel: 'ps-2027' });
      expect(componente.rotuloDeAvanco()).toBe('Gravar e avançar');
      const segunda = componente.persistir();
      const req = controller.expectOne(URL_DO_IDENTIFICADOR);
      expect(req.request.body).toEqual({ identificadorLegivel: 'ps-2027' });
      req.flush(null, { status: 204, statusText: 'No Content' });
      await tick();

      expect((await segunda).valid).toBe(true);
      expect(componente.rotuloDeAvanco()).toBe('Próximo');
    });

    it('não reenvia o valor anterior depois de uma recusa definitiva', async () => {
      preencherCamposDoComando();
      lerDetalhe(SituacaoDoProcessoSeletivoCodigo.RASCUNHO, 'ps-2027');
      detectar();
      store.patchObjectSection('identificacao', { identificadorLegivel: 'medicina-2027' });

      const primeira = componente.persistir();
      const recusa = problema(
        409,
        EM_USO,
        'O identificador legível já é usado por outro processo seletivo',
      );
      controller.expectOne(URL_DO_IDENTIFICADOR).flush(recusa.body, recusa.opts);
      await tick();
      await primeira;

      store.patchObjectSection('identificacao', { identificadorLegivel: 'ps-2027' });
      expect((await componente.persistir()).valid).toBe(true);
      controller.expectNone(URL_DO_IDENTIFICADOR);
    });

    /** Publicado, o campo não muda por aqui — nem exige o que o operador não pode corrigir. */
    it('lê o identificador como texto e não o confere com o processo publicado', () => {
      // Publicado sem identificador: a leitura diz que falta, e a validação não o exige.
      lerDetalhe(SituacaoDoProcessoSeletivoCodigo.PUBLICADO, null);
      detectar();

      expect(host.querySelector('#f-identificador')).toBeNull();
      expect(valorEmConsulta('Identificador legível')).toBe('Não informado');
      expect(componente.validar().messages ?? []).not.toContain(
        'Informe o identificador legível do processo seletivo.',
      );
      expect(componente.rotuloDeAvanco()).toBe('Próximo');
    });

    it('descreve o campo como endereço público que não muda depois de publicado', () => {
      const hint = host.querySelector('#f-identificador-hint');

      expect(host.querySelector('#f-identificador')?.getAttribute('aria-describedby')).toBe(
        'f-identificador-hint',
      );
      expect(hint?.textContent).toMatch(/endereço público do certame/i);
      expect(hint?.textContent).toMatch(/depois de publicado, não muda mais/i);
    });
  });

  it('em consulta, lê o cadastro como texto, com o rótulo de cada escolha', () => {
    preencherCamposDoComando();
    lerDetalhe(SituacaoDoProcessoSeletivoCodigo.PUBLICADO, 'ps-2027');
    detectar();

    expect(host.querySelector('input, select, textarea, button')).toBeNull();
    expect(valorEmConsulta('Nome do processo seletivo')).toBe('Processo Seletivo 2027');
    expect(valorEmConsulta('Identificador legível')).toBe('ps-2027');
    expect(valorEmConsulta('Unidade administradora')).toBe(
      unidadeSeed.sigla + ' — ' + unidadeSeed.nome,
    );
    expect(valorEmConsulta('Município que rege os prazos')).toBe(MARABA.nome + ' — ' + MARABA.uf);
    expect(valorEmConsulta('Origem dos candidatos')).toBe('Inscrição neste sistema');
    // O aviso de campos congelados fala a quem edita; em consulta não há o que congelar.
    expect(host.querySelector('.alert')).toBeNull();
  });

  it('orienta o passo sem citar PDF, requisito interno ou LGPD', () => {
    const subtitulo = host.querySelector('.step-subtitle')?.textContent?.trim();

    expect(subtitulo).toBe('Informe os dados de identificação do Processo Seletivo.');
    // O documento oficial passou a ser tratado na publicação; o passo não o exige.
    expect(subtitulo).not.toMatch(/PDF|edital|LGPD|RN[o]?\d+|UNI-REQ-\d{4}/i);
  });
});

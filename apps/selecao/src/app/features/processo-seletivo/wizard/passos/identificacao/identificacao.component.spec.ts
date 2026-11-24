import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { IdentificacaoPassoComponent } from './identificacao.component';
import { CatalogoDeUnidades } from './servicos/catalogo-de-unidades.service';
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
 * Cede o event loop para que a cadeia de `await` do componente avance até a
 * próxima requisição. `Promise.resolve()` sozinho não basta: cada fase do
 * fluxo passa por `firstValueFrom` e por mais de um microtask.
 */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

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
  let unidades: CatalogoDeUnidades;
  let gravacao: GravacaoDaIdentificacao;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

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
    unidades = fixture.debugElement.injector.get(CatalogoDeUnidades);
    gravacao = fixture.debugElement.injector.get(GravacaoDaIdentificacao);
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

  it('carrega as unidades administradoras da API de Organização', () => {
    expect(unidades.opcoes()).toEqual([
      { id: UNIDADE_ID, rotulo: 'ICE — Instituto de Ciências Exatas' },
    ]);
    expect(unidades.carregando()).toBe(false);
  });

  it('exige unidade administradora e origem dos candidatos para avançar', () => {
    store.patchObjectSection('identificacao', {
      nome: 'Processo Seletivo 2027',
    });

    const resultado = componente.validar();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain('Selecione a unidade administradora.');
    expect(resultado.messages).toContain('Informe a origem dos candidatos.');
  });

  it('nomeia os campos que faltam antes de criar o cadastro', async () => {
    await componente.persistir();

    expect(gravacao.erroDeCriacao()).toContain('tipo do processo (passo 1)');
    expect(gravacao.erroDeCriacao()).toContain('unidade administradora');
    expect(gravacao.erroDeCriacao()).toContain('origem dos candidatos');
    expect(store.processoSeletivoId()).toBeNull();
  });

  it('não cria o cadastro sem o identificador legível, e não chama a API', async () => {
    preencherCamposDoComando();
    store.patchObjectSection('identificacao', { identificadorLegivel: '   ' });

    await componente.persistir();

    expect(gravacao.erroDeCriacao()).toContain('identificador legível');
    expect(store.processoSeletivoId()).toBeNull();
    controller.expectNone(`${BASE}/api/selecao/processos-seletivos`);
  });

  it('congela os campos do comando depois de criar o processo', async () => {
    preencherCamposDoComando();
    const criado = componente.persistir();

    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos`)
      .flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    await tick();
    await criado;
    expect(componente.camposDoComandoBloqueados()).toBe(true);
  });

  /**
   * O filtro de idempotência guarda a resposta de qualquer status abaixo de 500:
   * reenviar o comando corrigido com a mesma chave devolveria `body_mismatch`
   * em vez de criar o processo.
   */
  it('renova a Idempotency-Key após 422 de validação', async () => {
    preencherCamposDoComando();
    const primeira = componente.persistir();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const recusa = problema(422, 'ProcessoSeletivo.NomeDuplicado', 'Nome já utilizado');
    req1.flush(recusa.body, recusa.opts);
    expect((await primeira).valid).toBe(false);

    store.patchObjectSection('identificacao', { nome: 'Processo Seletivo 2027 — retificado' });
    const segunda = componente.persistir();

    const req2 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave2 = req2.request.headers.get('Idempotency-Key');
    expect(chave2).not.toBe(chave1);
    req2.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    expect((await segunda).valid).toBe(true);
  });

  /**
   * `processing_conflict` é o único 409 em que o backend pede retry com a mesma
   * chave — a execução anterior ainda pode concluir.
   */
  it('preserva a Idempotency-Key em processing_conflict', async () => {
    preencherCamposDoComando();
    const primeira = componente.persistir();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const conflito = problema(
      409,
      'uniplus.idempotency.processing_conflict',
      'Requisição concorrente em processamento',
    );
    req1.flush(conflito.body, conflito.opts);
    await primeira;

    const segunda = componente.persistir();
    const req2 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    expect(req2.request.headers.get('Idempotency-Key')).toBe(chave1);
    req2.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    await segunda;
  });

  /**
   * Falha de rede na criação não diz se o servidor executou o comando. Repetir
   * com o mesmo corpo e a mesma chave devolve o replay; repetir com o rascunho
   * editado devolveria `body_mismatch` e a correção seguinte criaria um
   * segundo processo.
   */
  it('repete a criação inconclusiva com o mesmo corpo, ignorando edição posterior', async () => {
    preencherCamposDoComando();
    const primeira = componente.persistir();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const corpoOriginal = req1.request.body;
    req1.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await primeira;

    expect(componente.criacaoIndefinida()).toBe(true);
    store.patchObjectSection('identificacao', { nome: 'Nome editado depois da falha' });

    const segunda = componente.persistir();
    const req2 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    expect(req2.request.headers.get('Idempotency-Key')).toBe(chave1);
    expect(req2.request.body).toEqual(corpoOriginal);
    req2.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    await segunda;

    expect(componente.criacaoIndefinida()).toBe(false);
  });

  /**
   * O tipo é escolhido no passo 1 e entra no comando retido. Deixá-lo editável
   * durante a espera faria o rascunho exibir um tipo diferente do processo que
   * a retentativa vai confirmar no servidor.
   */
  it('congela também o passo 1 enquanto a criação está indefinida', async () => {
    preencherCamposDoComando();
    const primeira = componente.persistir();

    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await primeira;

    expect(store.cadastroInicialCongelado()).toBe(true);
  });

  /**
   * 413 é recusa definitiva do filtro de idempotência: manter a chave prenderia
   * a tela repetindo para sempre um comando que o servidor não aceita.
   */
  it('rotaciona a chave e libera os campos após 413', async () => {
    preencherCamposDoComando();
    const primeira = componente.persistir();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const grande = problema(413, 'uniplus.idempotency.body_muito_grande', 'Corpo muito grande');
    req1.flush(grande.body, grande.opts);
    await primeira;

    expect(componente.criacaoIndefinida()).toBe(false);

    const segunda = componente.persistir();
    const req2 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    expect(req2.request.headers.get('Idempotency-Key')).not.toBe(chave1);
    req2.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    await segunda;
  });
});

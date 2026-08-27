import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { OrigemCandidatos } from '@uniplus/shared-data/selecao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { Step02IdentificacaoComponent } from './step-02-identificacao.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';

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

describe('Step02IdentificacaoComponent', () => {
  let componente: Step02IdentificacaoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let host: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step02IdentificacaoComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Step02IdentificacaoComponent);
    componente = fixture.componentInstance;
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
      origemCandidatos: OrigemCandidatos.inscricaoPropria,
      localidade: MARABA,
    });
  }

  /** Tudo que `validate()` exige, menos o anexo do edital. */
  function preencherPassoInteiro(): void {
    preencherCamposDoComando();
    store.patchObjectSection('identificacao', {
      numero: '12/2026',
      ano: 2026,
      data: '2026-09-01',
      orgao: 'CEPS',
      periodo: '1º semestre',
    });
  }

  it('carrega as unidades administradoras da API de Organização', () => {
    expect(componente.unidades()).toEqual([
      { id: UNIDADE_ID, rotulo: 'ICE — Instituto de Ciências Exatas' },
    ]);
    expect(componente.unidadesCarregando()).toBe(false);
  });

  it('exige unidade administradora e origem dos candidatos para avançar', () => {
    store.patchObjectSection('identificacao', {
      numero: '12/2026',
      ano: 2026,
      data: '2026-09-01',
      orgao: 'CEPS',
      periodo: '1º semestre',
      nome: 'Processo Seletivo 2027',
    });

    const resultado = componente.validate();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain('Selecione a unidade administradora.');
    expect(resultado.messages).toContain('Informe a origem dos candidatos.');
  });

  it('nomeia os campos que faltam antes de criar o cadastro', async () => {
    await componente.persistir();

    expect(componente.erroDeCriacao()).toContain('tipo do processo (passo 1)');
    expect(componente.erroDeCriacao()).toContain('unidade administradora');
    expect(componente.erroDeCriacao()).toContain('origem dos candidatos');
    expect(store.processoSeletivoId()).toBeNull();
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
    const primeira = componente['persistir']();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const recusa = problema(422, 'ProcessoSeletivo.NomeDuplicado', 'Nome já utilizado');
    req1.flush(recusa.body, recusa.opts);
    expect((await primeira).valid).toBe(false);

    store.patchObjectSection('identificacao', { nome: 'Processo Seletivo 2027 — retificado' });
    const segunda = componente['persistir']();

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
    const primeira = componente['persistir']();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const conflito = problema(
      409,
      'uniplus.idempotency.processing_conflict',
      'Requisição concorrente em processamento',
    );
    req1.flush(conflito.body, conflito.opts);
    await primeira;

    const segunda = componente['persistir']();
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
    preencherPassoInteiro();
    const primeira = componente['persistir']();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const corpoOriginal = req1.request.body;
    req1.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await primeira;

    expect(componente.criacaoIndefinida()).toBe(true);
    store.patchObjectSection('identificacao', { nome: 'Nome editado depois da falha' });

    const segunda = componente['persistir']();
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
    preencherPassoInteiro();
    const primeira = componente['persistir']();

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
    preencherPassoInteiro();
    const primeira = componente['persistir']();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const grande = problema(413, 'uniplus.idempotency.body_muito_grande', 'Corpo muito grande');
    req1.flush(grande.body, grande.opts);
    await primeira;

    expect(componente.criacaoIndefinida()).toBe(false);

    const segunda = componente['persistir']();
    const req2 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    expect(req2.request.headers.get('Idempotency-Key')).not.toBe(chave1);
    req2.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    await segunda;
  });

  it('exige a localidade para avançar', () => {
    store.patchObjectSection('identificacao', {
      numero: '12/2026',
      ano: 2026,
      data: '2026-09-01',
      orgao: 'CEPS',
      periodo: '1º semestre',
      nome: 'Processo Seletivo 2027',
      unidadeAdministradoraId: UNIDADE_ID,
      origemCandidatos: OrigemCandidatos.inscricaoPropria,
    });

    const resultado = componente.validate();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain(
      'Informe o município cujo calendário rege os prazos do processo.',
    );
  });

  it('envia o trio da localidade escolhida no cadastro inicial', async () => {
    preencherCamposDoComando();

    const criado = componente.persistir();
    await tick();

    const criacao = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    expect(criacao.request.body).toMatchObject({
      localidadeCodigoIbge: '1504208',
      localidadeNome: 'Marabá',
      localidadeUf: 'PA',
    });
    criacao.flush(PROCESSO_ID);
    await tick();
    await criado;
  });

  it('busca municípios na Geo a partir de três letras e grava o trio da opção', async () => {
    componente.buscarMunicipios('ma');
    controller.expectNone(() => true);

    componente.buscarMunicipios('mar');
    const busca = controller.expectOne((r) => r.url.includes('/api/cidades'));
    expect(busca.request.params.get('q')).toBe('mar');
    busca.flush([{ id: 'x', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' }]);
    await tick();

    expect(componente.municipios()).toHaveLength(1);

    componente.selecionarLocalidade({ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' });

    expect(store.draft().identificacao.localidade).toEqual(MARABA);
    expect(componente.municipios()).toEqual([]);
  });

  it('limpar a localidade devolve o campo à busca', () => {
    store.patchObjectSection('identificacao', { localidade: MARABA });

    componente.limparLocalidade();

    expect(store.draft().identificacao.localidade).toBeNull();
  });
  it('libera o estado de consulta quando o termo encolhe abaixo de três letras', async () => {
    componente.buscarMunicipios('mar');
    const busca = controller.expectOne((r) => r.url.includes('/api/cidades'));

    // O operador apaga antes de a resposta chegar: a guarda de termo obsoleto
    // descarta o resultado, então quem precisa devolver o campo ao normal é o
    // caminho curto — senão o aria-busy fica preso.
    componente.buscarMunicipios('ma');
    busca.flush([{ id: 'x', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' }]);
    await tick();

    expect(componente.municipiosCarregando()).toBe(false);
    expect(componente.municipios()).toEqual([]);
  });
  it('descarta o resultado anterior ao iniciar uma busca nova', async () => {
    componente.buscarMunicipios('mar');
    controller
      .expectOne((r) => r.url.includes('/api/cidades'))
      .flush([{ id: 'x', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' }]);
    await tick();
    expect(componente.municipios()).toHaveLength(1);

    // Enquanto a busca nova corre, a opção antiga não pode seguir clicável: numa
    // conexão lenta o operador gravaria o município que já não procurava.
    componente.buscarMunicipios('bel');
    expect(componente.municipios()).toEqual([]);

    controller
      .expectOne((r) => r.url.includes('/api/cidades'))
      .flush([{ id: 'y', codigoIbge: '1501402', nome: 'Belém', uf: 'PA', ddd: '91' }]);
    await tick();

    expect(componente.municipios()).toHaveLength(1);
    expect(componente.municipios()[0].nome).toBe('Belém');
  });

  /**
   * Um aviso por campo repetia a mesma informação ao longo do formulário. O
   * aviso do topo é o único, e por isso precisa nomear todos os campos que
   * cobre — inclusive o município, que perdeu o próprio.
   */
  it('anuncia o congelamento uma única vez, nomeando o município', () => {
    preencherCamposDoComando();
    // O congelamento é derivado: o processo já existir é o que o dispara.
    store.processoSeletivoId.set('01960000-0000-7000-0000-0000000009aa');
    detectar();

    const avisos = Array.from(host.querySelectorAll('.alert'));
    expect(avisos.length).toBe(1);
    expect(avisos[0]?.textContent).toContain('município');
  });

  /**
   * O resumo existe para ser conferido: id de unidade ou código de enum no
   * lugar do rótulo transformaria a conferência em adivinhação.
   */
  it('resume os dados a gravar com os rótulos que o operador viu', () => {
    preencherCamposDoComando();

    const confirmacao = componente.confirmacaoDeGravacao();

    expect(confirmacao).not.toBeNull();
    expect(confirmacao?.itens).toEqual([
      { rotulo: 'Nome do processo seletivo', valor: 'Processo Seletivo 2027' },
      { rotulo: 'Tipo do processo', valor: 'Vestibular' },
      { rotulo: 'Unidade administradora', valor: 'ICE — Instituto de Ciências Exatas' },
      { rotulo: 'Município que rege os prazos', valor: 'Marabá — PA' },
      { rotulo: 'Origem dos candidatos', valor: 'Inscrição neste sistema' },
    ]);
  });

  it('avisa no resumo que os dados não poderão ser alterados', () => {
    preencherCamposDoComando();

    expect(componente.confirmacaoDeGravacao()?.aviso).toContain('não poderão ser alterados');
  });

  /** Com o processo criado não há o que gravar: o passo volta a ser navegação. */
  it('dispensa a confirmação quando o processo já existe', () => {
    preencherCamposDoComando();
    store.processoSeletivoId.set(PROCESSO_ID);

    expect(componente.confirmacaoDeGravacao()).toBeNull();
    expect(componente.rotuloDeAvanco()).toBe('Próximo');
  });

  /** O botão que grava não pode descrever apenas a navegação. */
  it('anuncia no botão que o avanço grava', () => {
    preencherCamposDoComando();

    expect(componente.rotuloDeAvanco()).toBe('Gravar e avançar');
  });
});

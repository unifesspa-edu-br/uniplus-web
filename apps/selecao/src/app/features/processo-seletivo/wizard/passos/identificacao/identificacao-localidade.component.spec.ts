import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  OrigemCandidatosCodigo,
  type ProcessoSeletivoDto,
  StatusProcessoCodigo,
} from '@uniplus/shared-data/selecao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { IdentificacaoPassoComponent } from './identificacao.component';
import { BuscaDeMunicipio } from './servicos/busca-de-municipio.service';
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

describe('IdentificacaoPassoComponent', () => {
  let componente: IdentificacaoPassoComponent;
  let municipio: BuscaDeMunicipio;
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
    municipio = fixture.debugElement.injector.get(BuscaDeMunicipio);
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

  /** O processo já criado, com o detalhe lido do servidor só no que o passo consulta. */
  function lerDetalhe(status: StatusProcessoCodigo, identificadorLegivel: string | null): void {
    store.processoSeletivoId.set(PROCESSO_ID);
    store.remoteSnapshot.set({
      id: PROCESSO_ID,
      status: { codigo: status, rotulo: status },
      identificadorLegivel,
    } as unknown as ProcessoSeletivoDto);
    store.patchObjectSection('identificacao', { identificadorLegivel: identificadorLegivel ?? '' });
  }

  it('exige a localidade para avançar', () => {
    store.patchObjectSection('identificacao', {
      nome: 'Processo Seletivo 2027',
      unidadeAdministradoraId: UNIDADE_ID,
      origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
    });

    const resultado = componente.validar();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain(
      'Informe o município cujo calendário rege os prazos do processo.',
    );
  });

  /**
   * O texto de ajuda já foi corrigido para não sugerir que a unidade define a
   * localidade/prazos, mas nada travava essa explicação: bastava uma
   * revisão editorial descuidada para a dedução automática voltar em
   * silêncio. As asserções checam o papel de cada campo pelo id do hint em
   * `aria-describedby` — não por posição no DOM — e a negação explícita da
   * dedução, sem fixar o parágrafo inteiro.
   */
  it('descreve a unidade como responsável administrativa, sem definir a localidade', () => {
    const campo = host.querySelector('#f-unidade');
    const hint = host.querySelector('#f-unidade-hint');

    expect(campo?.getAttribute('aria-describedby')).toBe('f-unidade-hint');
    expect(hint?.textContent).toMatch(/responsável pela administração do certame/i);
    expect(hint?.textContent).toMatch(/não decorre dela/i);
  });

  it('descreve o município como fonte dos feriados aplicáveis, sem decorrer da unidade', () => {
    const campo = host.querySelector('input[role="combobox"]');
    const hint = host.querySelector('#f-localidade-hint');

    expect(campo?.getAttribute('aria-describedby')).toContain('f-localidade-hint');
    expect(hint?.textContent).toMatch(/feriados municipais e estaduais/i);
    expect(hint?.textContent).toMatch(/não decorre dela/i);
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
    municipio.buscar('ma');
    controller.expectNone(() => true);

    municipio.buscar('mar');
    const busca = controller.expectOne((r) => r.url.includes('/api/cidades'));
    expect(busca.request.params.get('q')).toBe('mar');
    busca.flush([{ id: 'x', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' }]);
    await tick();

    expect(municipio.municipios()).toHaveLength(1);

    municipio.selecionar({ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' });

    expect(store.draft().identificacao.localidade).toEqual(MARABA);
    expect(municipio.municipios()).toEqual([]);
  });

  it('oferece os municípios achados como opções de um listbox e grava a escolhida', async () => {
    const campo = host.querySelector<HTMLInputElement>('input[role="combobox"]');
    campo?.focus();
    municipio.buscar('mar');
    controller
      .expectOne((r) => r.url.includes('/api/cidades'))
      .flush([{ id: 'x', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' }]);
    await tick();
    detectar();

    const opcao = host.querySelector<HTMLElement>('[role="listbox"] [role="option"]');
    expect(opcao?.textContent?.trim()).toBe('Marabá — PA');

    opcao?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(store.draft().identificacao.localidade).toEqual(MARABA);
  });

  it('limpar a localidade devolve o campo à busca', () => {
    store.patchObjectSection('identificacao', { localidade: MARABA });

    municipio.limpar();

    expect(store.draft().identificacao.localidade).toBeNull();
  });
  it('libera o estado de consulta quando o termo encolhe abaixo de três letras', async () => {
    municipio.buscar('mar');
    const busca = controller.expectOne((r) => r.url.includes('/api/cidades'));

    // O operador apaga antes de a resposta chegar: a guarda de termo obsoleto
    // descarta o resultado, então quem precisa devolver o campo ao normal é o
    // caminho curto — senão o aria-busy fica preso.
    municipio.buscar('ma');
    busca.flush([{ id: 'x', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' }]);
    await tick();

    expect(municipio.carregando()).toBe(false);
    expect(municipio.municipios()).toEqual([]);
  });
  it('descarta o resultado anterior ao iniciar uma busca nova', async () => {
    municipio.buscar('mar');
    controller
      .expectOne((r) => r.url.includes('/api/cidades'))
      .flush([{ id: 'x', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' }]);
    await tick();
    expect(municipio.municipios()).toHaveLength(1);

    // Enquanto a busca nova corre, a opção antiga não pode seguir clicável: numa
    // conexão lenta o operador gravaria o município que já não procurava.
    municipio.buscar('bel');
    expect(municipio.municipios()).toEqual([]);

    controller
      .expectOne((r) => r.url.includes('/api/cidades'))
      .flush([{ id: 'y', codigoIbge: '1501402', nome: 'Belém', uf: 'PA', ddd: '91' }]);
    await tick();

    expect(municipio.municipios()).toHaveLength(1);
    expect(municipio.municipios()[0].nome).toBe('Belém');
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
    lerDetalhe(StatusProcessoCodigo.RASCUNHO, 'ps-2027');
    detectar();

    expect(componente.confirmacaoDeGravacao()).toBeNull();
    expect(componente.rotuloDeAvanco()).toBe('Próximo');
  });

  /** O botão que grava não pode descrever apenas a navegação. */
  it('anuncia no botão que o avanço grava', () => {
    preencherCamposDoComando();

    expect(componente.rotuloDeAvanco()).toBe('Gravar e avançar');
  });

  /**
   * A navegação pelo stepper é livre: dá para chegar ao passo 2 sem ter
   * escolhido o tipo, que é do passo 1. O resumo listaria "Tipo do processo"
   * em branco e anunciaria um comando pronto que a criação recusaria em
   * seguida.
   */
  it('não abre o resumo com campo do comando ainda por preencher', () => {
    preencherCamposDoComando();
    store.patchObjectSection('tipoProcesso', { selected: '', rotulo: '' });

    expect(componente.confirmacaoDeGravacao()).toBeNull();
  });

  /**
   * Sem resposta da criação não há id, mas acionar o botão reenvia o comando
   * retido. "Próximo" descreveria navegação onde há reenvio, e contradiria o
   * aviso na tela, que pede para tentar de novo.
   */
  it('anuncia repetição, não avanço, com a criação em estado indefinido', () => {
    preencherCamposDoComando();
    store.criacaoIndefinida.set(true);

    expect(store.processoSeletivoId()).toBeNull();
    expect(componente.rotuloDeAvanco()).toBe('Repetir a gravação');
  });
});

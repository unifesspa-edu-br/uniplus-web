import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { PUBLICACOES_BASE_PATH, TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposAtoPage } from './tipos-ato.page';

const BASE = 'http://localhost:5000';
const LISTA_URL = `${BASE}/api/publicacoes/tipos-ato`;
const ADMIN_URL = `${BASE}/api/publicacoes/admin/tipos-ato`;
const PROBLEM_JSON = { 'Content-Type': 'application/problem+json' };

const preliminar: TipoAtoPublicadoDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'RESULTADO_PRELIMINAR_INSCRICAO',
  nome: 'Resultado preliminar da inscrição',
  congelaConfiguracao: true,
  unicoPorObjeto: false,
  efeitoIrreversivel: false,
  ehResultado: true,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2026-08-30T12:00:00Z',
};

const aviso: TipoAtoPublicadoDto = {
  ...preliminar,
  id: '01960000-0000-7000-0000-0000000000a2',
  codigo: 'AVISO',
  nome: 'Aviso',
  congelaConfiguracao: false,
  ehResultado: false,
  vigenciaFim: '2026-06-30',
};

describe('TiposAtoPage', () => {
  let fixture: ComponentFixture<TiposAtoPage>;
  let component: TiposAtoPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposAtoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposAtoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(itens: readonly TipoAtoPublicadoDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === LISTA_URL);
    req.flush(itens);
    await propagate();
  }

  function preencherFormulario(): void {
    component['form'].setValue({
      codigo: 'resultado_preliminar_inscricao',
      nome: 'Resultado preliminar da inscrição',
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '',
      congelaConfiguracao: true,
      unicoPorObjeto: false,
      efeitoIrreversivel: false,
      ehResultado: true,
      baseLegal: '',
    });
  }

  /**
   * O padrão do servidor é só o que vale hoje, e numa tela de administração isso
   * esconde tanto o que terminou quanto o que ainda vai começar — inclusive a
   * vigência futura que o operador acabou de criar.
   */
  it('a listagem de administração pede a série completa por padrão', async () => {
    const req = controller.expectOne((r) => r.url === LISTA_URL);
    expect(req.request.params.get('limit')).toBe('100');
    expect(req.request.params.get('vigentes')).toBe('false');
    req.flush([preliminar]);
    await propagate();
  });

  it('a listagem mostra, por linha, se o ato determina a situação do candidato', async () => {
    await flushLista([preliminar, aviso]);
    fixture.detectChanges();

    const linhas = Array.from(
      fixture.nativeElement.querySelectorAll('tbody tr'),
    ) as HTMLTableRowElement[];
    const celulaResultado = (linha: HTMLTableRowElement): string =>
      (linha.querySelector('[data-label="Resultado"]')?.textContent ?? '').trim();

    expect(celulaResultado(linhas[0])).toBe('Sim');
    expect(celulaResultado(linhas[1])).toBe('Não');
  });

  it('a vigência é apresentada em pt-BR, aberta ou encerrada', async () => {
    await flushLista([preliminar, aviso]);
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Desde 01/01/2026');
    expect(texto).toContain('De 01/01/2026 até antes de 30/06/2026');
  });

  it('restringir às vigências em vigor declara vigentes=true', async () => {
    await flushLista([preliminar, aviso]);

    component['alternarSomenteEmVigor']();
    await propagate();

    const req = controller.expectOne((r) => r.url === LISTA_URL);
    expect(req.request.params.get('vigentes')).toBe('true');
    req.flush([preliminar]);
    await propagate();
  });

  it('cadastrar emite POST com Idempotency-Key, código em maiúsculas e o sinalizador de resultado', async () => {
    await flushLista([]);

    component['abrirCriacao']();
    preencherFormulario();
    component['salvar']();

    const post = controller.expectOne(ADMIN_URL);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toMatchObject({
      codigo: 'RESULTADO_PRELIMINAR_INSCRICAO',
      ehResultado: true,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: null,
      baseLegal: null,
    });

    post.flush(preliminar.id, { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([preliminar]);
  });

  it('na edição o código é readonly e o PUT reapresenta id e código sem Idempotency-Key', async () => {
    await flushLista([preliminar]);

    component['abrirEdicao'](preliminar);
    fixture.detectChanges();
    const codigoInput = fixture.nativeElement.querySelector(
      '[formcontrolname="codigo"]',
    ) as HTMLInputElement;
    expect(codigoInput.readOnly).toBe(true);

    component['form'].controls.nome.setValue('Resultado preliminar das inscrições');
    component['salvar']();

    const put = controller.expectOne(`${ADMIN_URL}/${preliminar.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.has('Idempotency-Key')).toBe(false);
    expect(put.request.body).toMatchObject({
      id: preliminar.id,
      codigo: preliminar.codigo,
      nome: 'Resultado preliminar das inscrições',
    });

    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([preliminar]);
  });

  it('a sobreposição de vigência explica a saída e renova a chave de idempotência', async () => {
    await flushLista([]);

    component['abrirCriacao']();
    const chaveInicial = component['idempotencyKeyAtual']();
    preencherFormulario();
    component['salvar']();

    controller.expectOne(ADMIN_URL).flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.publicacoes.tipo_ato.vigencia_sobreposta',
        title: 'Vigência sobreposta',
        status: 409,
        code: 'uniplus.publicacoes.tipo_ato.vigencia_sobreposta',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
      { status: 409, statusText: 'Conflict', headers: PROBLEM_JSON },
    );
    await propagate();

    expect(component['formError']()).toContain('Encerre a anterior ou escolha outro início');
    expect(component['idempotencyKeyAtual']()).not.toBe(chaveInicial);
    expect(component['formOpen']()).toBe(true);
  });

  it('a recusa de validação marca o campo correspondente em vez do erro geral', async () => {
    await flushLista([]);

    component['abrirCriacao']();
    preencherFormulario();
    component['salvar']();

    controller.expectOne(ADMIN_URL).flush(
      {
        title: 'Requisição inválida',
        status: 422,
        code: 'uniplus.validacao.requisicao_invalida',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        errors: [
          { field: 'Codigo', code: 'formato_invalido', message: 'Use apenas letras e underscore.' },
        ],
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    await propagate();

    expect(component['formError']()).toBeNull();
    expect(component['erroDoCampo']('codigo')).toBe('Use apenas letras e underscore.');
  });

  it('remover emite DELETE após a confirmação', async () => {
    await flushLista([preliminar]);

    component['pedirRemocao'](preliminar);
    expect(component['confirmMessage']()).toContain('RESULTADO_PRELIMINAR_INSCRICAO');
    component['removerConfirmado']();

    const req = controller.expectOne(`${ADMIN_URL}/${preliminar.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
  });

  it('a busca filtra por código ou nome sobre a página carregada', async () => {
    await flushLista([preliminar, aviso]);

    component['termoBusca'].set('aviso');
    expect(component['atosFiltrados']()).toEqual([aviso]);
  });

  it('o estado vazio explica a consequência de não haver tipo de ato', async () => {
    await flushLista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'nem o resultado contra o qual cabe recurso',
    );
  });

  /**
   * Sem isto o formulário recusa em silêncio: `salvar()` marca os controles como
   * tocados e volta, e o campo sem mensagem deixa o botão parecendo morto.
   */
  it('o excesso de tamanho da base legal aparece no campo que o causou', async () => {
    await flushLista([]);

    component['abrirCriacao']();
    preencherFormulario();
    component['form'].controls.baseLegal.setValue('x'.repeat(501));
    component['salvar']();

    expect(component['erroDoCampo']('baseLegal')).toBe('Valor acima do tamanho permitido.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Valor acima do tamanho permitido.');
  });

  /**
   * Com as vigências encerradas à mostra o mesmo código ocupa várias linhas, e
   * o nome da ação precisa dizer QUAL período ela remove.
   */
  it('as ações de linha têm nome acessível distinto por vigência do mesmo código', async () => {
    const outraVigencia: TipoAtoPublicadoDto = {
      ...aviso,
      id: '01960000-0000-7000-0000-0000000000a3',
      vigenciaInicio: '2026-07-01',
      vigenciaFim: null,
    };
    await flushLista([aviso, outraVigencia]);
    fixture.detectChanges();

    const nomes = Array.from(
      fixture.nativeElement.querySelectorAll('button[aria-label^="Remover vigência"]'),
    ).map((b) => (b as HTMLButtonElement).getAttribute('aria-label'));

    expect(nomes).toEqual([
      'Remover vigência do tipo de ato AVISO, vigência iniciada em 01/01/2026',
      'Remover vigência do tipo de ato AVISO, vigência iniciada em 01/07/2026',
    ]);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  /**
   * Cancelar durante uma gravação em voo e abrir outro formulário faria a
   * resposta antiga agir sobre o registro novo — fechando a gaveta recém-aberta
   * ou marcando nela os erros do anterior.
   */
  it('não deixa abrir nem cancelar formulário enquanto há gravação em voo', async () => {
    await flushLista([]);

    component['abrirCriacao']();
    preencherFormulario();
    component['salvar']();
    fixture.detectChanges();

    expect(component['saving']()).toBe(true);
    const cadastrar = fixture.nativeElement.querySelector(
      '.page-header__actions button',
    ) as HTMLButtonElement;
    const cancelar = Array.from(
      fixture.nativeElement.querySelectorAll('.cfg-form-footer button'),
    ).find((b) => (b as HTMLButtonElement).textContent?.trim() === 'Cancelar') as HTMLButtonElement;

    expect(cadastrar.disabled).toBe(true);
    expect(cancelar.disabled).toBe(true);

    controller.expectOne(ADMIN_URL).flush(preliminar.id, { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([preliminar]);
  });

  /**
   * Desabilitar botão fecha a entrada que existe hoje. A guarda no método fecha
   * também o X da gaveta, o Escape e qualquer entrada que venha depois.
   */
  it('a guarda contra troca de formulário está no método, não só nos botões', async () => {
    await flushLista([]);

    component['abrirCriacao']();
    preencherFormulario();
    component['salvar']();
    expect(component['saving']()).toBe(true);

    // Simula fechar pela gaveta e tentar reabrir: sem a guarda, o formulário
    // seria zerado no meio da gravação em voo.
    component['formOpen'].set(false);
    component['form'].controls.nome.setValue('Outro nome qualquer');
    component['abrirCriacao']();

    expect(component['formOpen']()).toBe(false);
    expect(component['form'].controls.nome.value).toBe('Outro nome qualquer');

    controller.expectOne(ADMIN_URL).flush(preliminar.id, { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([preliminar]);
  });

  /**
   * A janela é semiaberta no domínio — `[início, fim)`. A tela precisa dizer
   * isso, senão quem quer validade até 30/06 informa 30/06 e encurta a vigência
   * em um dia sem perceber.
   */
  it('a tela diz que a data de fim é o primeiro dia sem validade', async () => {
    await flushLista([preliminar]);
    component['abrirCriacao']();
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('primeiro dia sem validade');
    expect(texto).toContain('a data informada já fica fora da vigência');
  });

  /**
   * Submeter pelo rodapé com o campo recusado acima da dobra deixava o foco no
   * botão, e a mensagem não é região viva: ninguém era avisado do que travou.
   */
  it('o foco vai para o primeiro campo recusado ao submeter', async () => {
    await flushLista([]);

    component['abrirCriacao']();
    fixture.detectChanges();
    component['form'].controls.nome.setValue('Só o nome');
    component['salvar']();
    fixture.detectChanges();

    const codigo = fixture.nativeElement.querySelector('[formcontrolname="codigo"]');
    expect(document.activeElement).toBe(codigo);
  });

  it('o formulário fica indisponível enquanto a gravação está em voo', async () => {
    await flushLista([]);

    component['abrirCriacao']();
    preencherFormulario();
    component['salvar']();

    expect(component['form'].disabled).toBe(true);

    controller.expectOne(ADMIN_URL).flush(preliminar.id, { status: 201, statusText: 'Created' });
    await propagate();
    expect(component['form'].disabled).toBe(false);
    await flushLista([preliminar]);
  });

  /**
   * Recorte vazio não é catálogo vazio: oferecer cadastro quando o filtro é que
   * escondeu tudo convida o operador a criar uma duplicata.
   */
  it('restringir às em vigor conta como filtro no estado vazio', async () => {
    await flushLista([preliminar]);

    component['alternarSomenteEmVigor']();
    await propagate();
    controller.expectOne((r) => r.url === LISTA_URL).flush([]);
    await propagate();
    fixture.detectChanges();

    expect(component['temFiltro']()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Nenhum tipo de ato encontrado');
    expect(fixture.nativeElement.textContent).not.toContain('Nenhum tipo de ato cadastrado');

    component['limparFiltros']();
    await propagate();
    expect(component['somenteEmVigor']()).toBe(false);
    controller.expectOne((r) => r.url === LISTA_URL).flush([preliminar]);
    await propagate();
  });

  /**
   * O contrato da listagem não tem parâmetro de busca, então o recorte é local.
   * Enquanto tudo cabe numa página isso responde pelo catálogo; havendo outra
   * página, a tela precisa dizer que a busca não a alcança.
   */
  it('avisa quando a busca não alcança o catálogo inteiro', async () => {
    const req = controller.expectOne((r) => r.url === LISTA_URL);
    req.flush([preliminar, aviso], {
      headers: { Link: `<${LISTA_URL}?cursor=PROXIMA&direction=next>; rel="next"` },
    });
    await propagate();

    expect(component['buscaLimitadaAPagina']()).toBe(false);

    component['termoBusca'].set('inexistente');
    fixture.detectChanges();

    expect(component['buscaLimitadaAPagina']()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('a busca alcança só a que está carregada');
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([preliminar]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/gu, ' ').trim()).toBe(
      'Tipos de ato publicáveis, com vigência e o que cada um determina',
    );
  });
});

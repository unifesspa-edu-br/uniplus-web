import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FatosCandidatoPage } from './fatos-candidato.page';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/admin/fatos-candidato`;
const FASES = `${BASE}/api/configuracao/fases-canonicas`;
const CATALOGO = `${BASE}/api/configuracao/fatos-candidato`;
const PROTECAO = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
const PROBLEMA = (status: number) => ({ status, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } });

const concedidas = signal<readonly string[]>(['configuracao:fatos-candidato:manter']);

describe('FatosCandidatoPage', () => {
  let fixture: ComponentFixture<FatosCandidatoPage>;
  let component: FatosCandidatoPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    concedidas.set(['configuracao:fatos-candidato:manter']);
    TestBed.configureTestingModule({
      imports: [FatosCandidatoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: PermissoesService,
          useValue: { tem: (codigo: string) => concedidas().includes(codigo) },
        },
      ],
    });
    fixture = TestBed.createComponent(FatosCandidatoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  /** Atende a lista do que aguarda a proteção de dados; os testes que não a inspecionam a deixam vazia. */
  function atenderPendencias(itens: readonly unknown[] = []): void {
    for (const req of controller.match((r) => r.url === PROTECAO).filter((pedido) => !pedido.cancelled)) req.flush(itens);
  }

  afterEach(() => {
    atenderPendencias();
    controller.verify();
  });

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  function atenderFases(): void {
    for (const req of controller.match((r) => r.url === FASES)) {
      req.flush([{ id: 'f1', codigo: 'INSCRICAO', nome: 'Inscrição', descricao: null }]);
    }
  }

  it('CA-01: a situação e a origem escolhidas chegam à consulta da API', async () => {
    atenderFases();
    const primeira = controller.expectOne((r) => r.url === LISTA);
    expect(primeira.request.params.get('ativo')).toBe('true');
    expect(primeira.request.params.has('origem')).toBe(false);
    primeira.flush([]);
    await propagar();

    component['filtroOrigem'].set('DERIVADO');
    component['filtroSituacao'].set('');
    fixture.detectChanges();
    await propagar();

    const filtrada = controller.expectOne((r) => r.url === LISTA);
    expect(filtrada.request.params.get('origem')).toBe('DERIVADO');
    expect(filtrada.request.params.has('ativo')).toBe(false);
    filtrada.flush([]);
  });

  it('sem a permissão de manter, não oferece criar nem editar, e deixa abrir o detalhe', async () => {
    concedidas.set(['configuracao:fatos-candidato:consultar']);
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([
      {
        ...fatoDoAdministrador,
        id: 'f1', codigo: 'RENDA', nome: 'Renda',
        aprovacao: { situacao: 'NEGADA', solicitadaEm: null, decididaEm: null, classificacaoRecomendada: 'SENSIVEL', aceitaEm: null },
      },
    ]);
    await propagar();
    fixture.detectChanges();
    await propagar();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const botoes = Array.from(host.querySelectorAll('button')).map((b) => b.textContent ?? '');
    expect(botoes.some((texto) => texto.includes('Novo fato'))).toBe(false);
    expect(host.querySelectorAll('td.table-responsive__actions button')).toHaveLength(0);

    (host.querySelector('.table-responsive__alvo') as HTMLButtonElement).click();
    fixture.detectChanges();
    const rodape = Array.from(host.querySelectorAll('.cfg-form-footer button')).map((b) => b.textContent?.trim());
    expect(rodape).toEqual(['Fechar']);
  });

  describe('detalhe do fato', () => {
    const fatoCategorico = {
      ...fatoDoAdministrador,
      id: '01960000-0000-7000-0000-0000000000b1',
      codigo: 'IDENTIDADE_GENERO',
      nome: 'Identidade de gênero',
      descricao: 'Como o candidato se identifica.',
      dominio: 'CATEGORICO',
      fonteValores: 'GLOBAL',
      valores: [
        { codigo: 'MULHER_CIS', descricao: 'Mulher cis', ordem: 1, ativo: true, orientacao: 'Marque se a identidade coincide com o sexo de nascimento.' },
        { codigo: 'ANTIGO', descricao: 'Valor antigo', ordem: 2, ativo: false, orientacao: null },
      ],
    };

    async function abrir(): Promise<HTMLElement> {
      atenderFases();
      controller.expectOne((r) => r.url === LISTA).flush([fatoCategorico]);
      await propagar();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('o nome da linha é um botão nativo, alcançável por Tab, com nome acessível', async () => {
      const host = await abrir();

      const alvo = host.querySelector('tbody .table-responsive__alvo') as HTMLButtonElement;
      expect(alvo.tagName).toBe('BUTTON');
      expect(alvo.type).toBe('button');
      expect(alvo.disabled).toBe(false);
      expect(alvo.tabIndex).toBeGreaterThanOrEqual(0);
      expect(alvo.getAttribute('aria-label')).toBe('Ver o detalhe de Identidade de gênero');
      expect(host.querySelector('tbody tr')?.hasAttribute('onclick')).toBe(false);
    });

    it('abre o drawer só de leitura com os campos, os valores possíveis e a orientação', async () => {
      const host = await abrir();

      (host.querySelector('.table-responsive__alvo') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(component['detalheAberto']()).toBe(true);
      const titulo = host.querySelector('dialog[aria-label="Detalhe do fato do candidato"] .uni-drawer__title');
      expect(titulo?.textContent?.trim()).toBe('Identidade de gênero');
      const texto = host.querySelector('dialog[aria-label="Detalhe do fato do candidato"]')?.textContent?.replace(/\s+/gu, ' ') ?? '';
      expect(texto).toContain('IDENTIDADE_GENERO');
      expect(texto).toContain('Como o candidato se identifica.');
      expect(texto).toContain('Declarado pelo candidato');
      expect(texto).toContain('Lista de valores');
      expect(texto).toContain('MULHER_CIS');
      expect(texto).toContain('Marque se a identidade coincide com o sexo de nascimento.');
      expect(texto).toContain('Valor antigo');
      expect(texto).toContain('Desativado');
      expect(texto).toContain('Pessoal');
      expect(texto).toContain('Execução de políticas públicas');
      expect(texto).toContain('Aprovada');
      expect(host.querySelector('dialog[aria-label="Detalhe do fato do candidato"] input, dialog[aria-label="Detalhe do fato do candidato"] textarea')).toBeNull();
    });

    it('"Editar" fecha o detalhe e abre a edição do mesmo fato', async () => {
      const host = await abrir();
      (host.querySelector('.table-responsive__alvo') as HTMLButtonElement).click();
      fixture.detectChanges();

      const editar = Array.from<HTMLButtonElement>(host.querySelectorAll('.cfg-form-footer button')).find((b) => b.textContent?.trim() === 'Editar');
      editar?.click();
      fixture.detectChanges();
      controller.match(() => true).forEach((req) => req.flush(null));

      expect(component['detalheAberto']()).toBe(false);
      expect(component['drawerAberto']()).toBe(true);
      expect(component['fatoEmEdicao']()).toBe(fatoCategorico.id);
    });
  });

  it('as três opções de "O que o fato é" formam um grupo de rádio nativo', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();

    component['abrirCriacao']();
    fixture.detectChanges();

    const radios = Array.from(
      (fixture.nativeElement as HTMLElement).ownerDocument.querySelectorAll('input[type="radio"][formcontrolname="tipo"]'),
    ) as HTMLInputElement[];
    expect(radios.map((radio) => radio.value)).toEqual(['DECLARADO', 'DERIVADO', 'AGREGADO']);
    expect(radios.map((radio) => radio.name)).toEqual(['tipo', 'tipo', 'tipo']);
  });

  it('sem a lista de fases, a criação avisa e oferece tentar de novo em vez de um campo vazio', async () => {
    for (const req of controller.match((r) => r.url === FASES)) {
      req.flush(JSON.stringify({ status: 503, title: 'Indisponível', code: 'uniplus.indisponivel' }), PROBLEMA(503));
    }
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();

    component['abrirCriacao']();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).ownerDocument.body.textContent).toContain('Fases não carregadas');
  });

  it('a falha na primeira página do filtro novo não deixa no paginador o cursor do filtro anterior', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([], { headers: { Link: `<${LISTA}?cursor=pagina-2&direction=next>; rel="next"` } });
    await propagar();
    expect(component['nextCursor']()).not.toBeNull();

    component['filtroOrigem'].set('DERIVADO');
    fixture.detectChanges();
    await propagar();
    controller
      .expectOne((r) => r.url === LISTA)
      .flush(JSON.stringify({ status: 503, title: 'Indisponível', code: 'uniplus.indisponivel' }), PROBLEMA(503));
    await propagar();

    expect(component['nextCursor']()).toBeNull();
  });

  it('trocar o filtro volta à primeira página, e a escolha que saiu das opções se esvazia', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    component['pagina'].set({ cursor: { afterId: 'x' } as never, direction: 'next' });
    fixture.detectChanges();
    await propagar();
    controller.expectOne((r) => r.url === LISTA && r.params.has('cursor')).flush([]);
    await propagar();

    component['filtroOrigem'].set('DECLARADO');
    fixture.detectChanges();
    await propagar();
    const filtrada = controller.expectOne((r) => r.url === LISTA);
    expect(filtrada.request.params.has('cursor'), 'o cursor era do filtro anterior').toBe(false);
    filtrada.flush([]);

    component['form'].patchValue({ tipo: 'DECLARADO', dominio: 'TEXTO' });
    fixture.detectChanges();
    component['form'].patchValue({ tipo: 'DERIVADO' });
    fixture.detectChanges();
    expect(component['form'].controls.dominio.value, 'o derivado não é texto').toBe('');
  });

  it('a recusa da API chega ao campo: a de validação no campo dela, o código repetido no código', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    component['abrirCriacao']();
    fixture.detectChanges();
    component['form'].patchValue({
      tipo: 'DERIVADO',
      nome: 'Perfil socioeconômico',
      descricao: 'Perfil que define a reserva de vagas.',
      codigo: 'PERFIL',
      dominio: 'BOOLEANO',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Classificar a reserva de vagas.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });

    component['criar']();
    const derivado = controller.expectOne(`${LISTA}/derivados`);
    expect(derivado.request.body).not.toHaveProperty('cardinalidade');
    derivado.flush(
      JSON.stringify({
        status: 422,
        code: 'uniplus.validation_failed',
        title: 'Requisição inválida',
        errors: [{ field: 'PontoResolucao', code: 'uniplus.configuracao.fato_candidato.ponto_resolucao_invalido', message: 'Fase fora do catálogo.' }],
      }),
      PROBLEMA(422),
    );
    await propagar();
    expect(component['erro']('pontoResolucao')).toBe('Fase fora do catálogo.');
    const chaveDaPrimeira = derivado.request.headers.get('Idempotency-Key');

    component['form'].controls.pontoResolucao.setValue('INSCRICAO');
    component['criar']();
    const repetido = controller.expectOne(`${LISTA}/derivados`);
    expect(repetido.request.headers.get('Idempotency-Key'), 'depois de uma recusa, o próximo envio é outro comando').not.toBe(chaveDaPrimeira);
    repetido.flush(
      JSON.stringify({ status: 409, code: 'uniplus.configuracao.fato_candidato.codigo_ja_existe', title: 'O código já existe.' }),
      PROBLEMA(409),
    );
    await propagar();
    expect(component['erro']('codigo')).not.toBeNull();
  });

  const fatoDoAdministrador = {
    id: '01960000-0000-7000-0000-0000000000a1',
    codigo: 'TRABALHA',
    nome: 'Trabalha',
    descricao: 'Se o candidato trabalha.',
    componenteExibicao: null,
    dominio: 'BOOLEANO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    fonteValores: null,
    formato: null,
    pontoResolucao: 'INSCRICAO',
    binding: 'CAMPO_INSCRICAO:TRABALHA',
    escopo: 'CANDIDATO',
    classificacaoProtecao: 'PESSOAL',
    finalidadeTratamento: 'Classificar a reserva de vagas.',
    hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    sistema: false,
    ativo: true,
    valores: [],
    regrasPadrao: [],
    aprovacao: { situacao: 'APROVADA', solicitadaEm: null, decididaEm: null, classificacaoRecomendada: null, aceitaEm: null },
  };

  it('a descrição é obrigatória no cadastro: em branco o fato não é enviado e o campo é anunciado como obrigatório', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    component['abrirCriacao']();
    fixture.detectChanges();
    component['form'].patchValue({ tipo: 'DERIVADO', nome: 'Perfil socioeconômico', codigo: 'PERFIL', descricao: '  ' });

    component['criar']();
    fixture.detectChanges();

    controller.expectNone(`${LISTA}/derivados`);
    expect(component['erro']('descricao')).not.toBeNull();
    const campo = fixture.nativeElement.ownerDocument.querySelector('textarea[formcontrolname="descricao"]') as HTMLTextAreaElement;
    expect(campo.getAttribute('aria-required')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toBe('cfg-fato-descricao-erro');
  });

  it('o componente de exibição vai no cadastro, e a recusa dele chega ao campo', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    component['abrirCriacao']();
    fixture.detectChanges();
    component['form'].patchValue({
      tipo: 'DERIVADO',
      nome: 'Renda familiar bruta',
      descricao: 'Renda bruta mensal da família.',
      componenteExibicao: 'MOEDA',
      codigo: 'RENDA_FAMILIAR',
      dominio: 'BOOLEANO',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Classificar a reserva de vagas.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });

    component['criar']();
    const pedido = controller.expectOne(`${LISTA}/derivados`);
    expect(pedido.request.body).toMatchObject({ descricao: 'Renda bruta mensal da família.', componenteExibicao: 'MOEDA' });
    pedido.flush(
      JSON.stringify({
        status: 422,
        code: 'uniplus.validation_failed',
        title: 'Requisição inválida',
        errors: [{ field: 'ComponenteExibicao', code: 'uniplus.configuracao.fato_candidato.componente_exibicao_invalido', message: 'Componente de exibição inválido.' }],
      }),
      PROBLEMA(422),
    );
    await propagar();

    expect(component['erro']('componenteExibicao')).toBe('Componente de exibição inválido.');
  });

  it('CA-01: o agregado vai à API com o fato de membro, sem tipo de dado nem escopo, e a recusa do membro chega ao campo', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    component['abrirCriacao']();
    fixture.detectChanges();
    await propagar();
    expect(controller.match(CATALOGO), 'o catálogo só é pedido para o agregado').toHaveLength(0);

    component['form'].patchValue({ tipo: 'AGREGADO' });
    fixture.detectChanges();
    await propagar();
    controller.expectOne(CATALOGO).flush([
      { id: 'm', codigo: 'MEMBRO_TRABALHA', nome: 'Membro trabalha', descricao: null, dominio: 'BOOLEANO', origem: 'DECLARADO',
        cardinalidade: 'ESCALAR', valoresDominio: null, pontoResolucao: 'INSCRICAO', binding: 'CAMPO_FORMULARIO:MEMBRO_TRABALHA',
        valoresDominioDeclarados: null, fonteValores: null, ativo: true, escopo: 'MEMBRO_GRUPO' },
    ]);
    await propagar();
    component['form'].patchValue({
      nome: 'Família com quem trabalha',
      descricao: 'Há alguém da família que trabalha.',
      codigo: 'FAMILIA_TRABALHA',
      fatoDeMembro: 'MEMBRO_TRABALHA',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Avaliar a renda familiar.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });

    component['criar']();
    const agregado = controller.expectOne(`${LISTA}/agregados`);
    expect(agregado.request.body).toEqual({
      codigo: 'FAMILIA_TRABALHA',
      nome: 'Família com quem trabalha',
      descricao: 'Há alguém da família que trabalha.',
      componenteExibicao: null,
      fatoDeMembro: 'MEMBRO_TRABALHA',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Avaliar a renda familiar.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });
    expect(agregado.request.headers.has('Idempotency-Key')).toBe(true);
    agregado.flush(
      JSON.stringify({
        status: 422,
        code: 'uniplus.validation_failed',
        title: 'Requisição inválida',
        errors: [{ field: 'fatoDeMembro', code: 'uniplus.vinculo_catalogo.fato_desativado', message: 'O fato está desativado.' }],
      }),
      PROBLEMA(422),
    );
    await propagar();
    expect(component['erro']('fatoDeMembro')).toBe('O fato está desativado.');
  });

  it('CA-02: o fato de sistema mostra o desativar desabilitado, com o porquê, e não oferece reativar', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([{ ...fatoDoAdministrador, sistema: true }]);
    await propagar();
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;
    const desativar = tela.querySelector('[aria-label^="Desativar"]') as HTMLButtonElement;
    expect(desativar.disabled).toBe(true);
    expect(tela.querySelector(`#${desativar.getAttribute('aria-describedby')}`)?.textContent).toContain('Fato de sistema');
    expect(tela.querySelector('[aria-label^="Reativar"]')).toBeNull();
  });

  it('editar pela linha abre a edição do fato', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([fatoDoAdministrador]);
    await propagar();
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;

    (tela.querySelector('[aria-label^="Editar"]') as HTMLButtonElement).click();
    expect(component['drawerAberto']()).toBe(true);
    expect(component['fatoEmEdicao']()).toBe(fatoDoAdministrador.id);
    controller.match(() => true).forEach((req) => req.flush(null));
  });

  it('CA-02: desativar confirmado vai à API e recarrega a lista; o foco passa ao título dela', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([fatoDoAdministrador]);
    await propagar();

    component['pedirAtivacao'](fatoDoAdministrador, 'DESATIVAR');
    // O diálogo fecha ao confirmar.
    component['confirmacaoAberta'].set(false);
    component['confirmarAtivacao']();
    controller
      .expectOne((r) => r.method === 'DELETE' && r.url === `${LISTA}/${fatoDoAdministrador.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();

    controller.expectOne((r) => r.url === LISTA).flush([]);
    expect(document.activeElement?.id).toBe('cfg-fatos-list-title');
  });

  it('CA-02: reativar leva a chave de idempotência, e a recusa reabre a confirmação com a mensagem da API', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([{ ...fatoDoAdministrador, ativo: false }]);
    await propagar();

    component['pedirAtivacao']({ ...fatoDoAdministrador, ativo: false }, 'REATIVAR');
    // O diálogo fecha ao confirmar.
    component['confirmacaoAberta'].set(false);
    component['confirmarAtivacao']();
    const ativacao = controller.expectOne(`${LISTA}/${fatoDoAdministrador.id}/ativacao`);
    expect(ativacao.request.headers.has('Idempotency-Key')).toBe(true);
    ativacao.flush(
      JSON.stringify({ status: 422, code: 'uniplus.configuracao.fato_candidato.ja_ativo', title: 'O fato já está ativo.' }),
      PROBLEMA(422),
    );
    await propagar();

    expect(component['confirmacaoAberta']()).toBe(true);
    expect(component['mensagemDaConfirmacao']()).not.toContain('Deseja reativar');
  });

  describe('aprovação da proteção de dados', () => {
    const fatoCom = (situacao: string, classificacaoRecomendada: string | null = null) => ({
      ...fatoDoAdministrador,
      aprovacao: { situacao, solicitadaEm: null, decididaEm: null, classificacaoRecomendada, aceitaEm: null },
    });
    const pendencia = (id: string) => ({
      tipo: 'FATO',
      id,
      codigo: 'TRABALHA',
      nome: 'Trabalha',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Classificar a reserva de vagas.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      aprovacao: { situacao: 'PENDENTE', solicitadaEm: null, decididaEm: null, classificacaoRecomendada: null, aceitaEm: null },
    });
    const botaoDaPagina = (host: HTMLElement, rotulo: string) =>
      Array.from<HTMLButtonElement>(host.querySelectorAll('.panel-head__actions button, .cfg-form-footer button')).find((b) =>
        b.textContent?.includes(rotulo),
      );

    const abrirDetalhe = (host: HTMLElement): void => {
      (host.querySelector('.table-responsive__alvo') as HTMLButtonElement).click();
      fixture.detectChanges();
    };

    async function carregarCom(fatos: readonly unknown[], pendencias: readonly unknown[] = []): Promise<HTMLElement> {
      atenderFases();
      controller.expectOne((r) => r.url === LISTA).flush(fatos);
      atenderPendencias(pendencias);
      await propagar();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('diz a situação como texto e, na negativa, a classificação recomendada, inclusive no fato de sistema', async () => {
      const host = await carregarCom([{ ...fatoCom('NEGADA', 'SENSIVEL'), sistema: true }]);

      expect(host.querySelector('tbody')?.textContent).toContain('Negada');
      expect(host.querySelector('tbody')?.textContent).not.toContain('Classificação recomendada');
      abrirDetalhe(host);
      const texto = host.textContent?.replace(/\s+/gu, ' ') ?? '';
      expect(texto).toContain('Classificação recomendada: Pessoal sensível');
      expect(botaoDaPagina(host, 'Aceitar recomendação')).toBeDefined();
    });

    it('a recusa do aceite relê a lista e a situação, e reabre o diálogo com a mensagem da API', async () => {
      const host = await carregarCom([fatoCom('NEGADA', 'SENSIVEL')]);
      abrirDetalhe(host);
      botaoDaPagina(host, 'Aceitar recomendação')?.click();
      component['confirmarAceite']();
      controller.expectOne(`${LISTA}/${fatoDoAdministrador.id}/aceite-da-recomendacao`).flush(
        JSON.stringify({ status: 409, code: 'uniplus.configuracao.protecao_do_catalogo.conflito_de_concorrencia', title: 'O fato foi alterado ao mesmo tempo' }),
        { status: 409, statusText: 'Conflito', headers: { 'content-type': 'application/problem+json' } },
      );
      await propagar();

      controller.expectOne((r) => r.url === LISTA).flush([fatoCom('PENDENTE')]);
      atenderPendencias();
      await propagar();
      expect(component['confirmAceiteAberto']()).toBe(true);
      expect(component['mensagemDoAceite']()).toBe('O fato foi alterado ao mesmo tempo');
    });

    it('aceita a recomendação do fato negado e recarrega a lista', async () => {
      const host = await carregarCom([fatoCom('NEGADA', 'SENSIVEL')]);
      abrirDetalhe(host);
      botaoDaPagina(host, 'Aceitar recomendação')?.click();
      fixture.detectChanges();
      expect(component['mensagemDoAceite']()).toContain('Pessoal sensível');

      component['confirmarAceite']();
      const post = controller.expectOne(`${LISTA}/${fatoDoAdministrador.id}/aceite-da-recomendacao`);
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      post.flush(null, { status: 204, statusText: 'No Content' });
      await propagar();

      controller.expectOne((r) => r.url === LISTA).flush([fatoCom('APROVADA')]);
      atenderPendencias();
      await propagar();
      fixture.detectChanges();
      expect(botaoDaPagina(host, 'Aceitar recomendação')).toBeUndefined();
    });

    it('sem a permissão de manter não oferece "Aceitar recomendação" nem "Enviar solicitação"', async () => {
      concedidas.set(['configuracao:fatos-candidato:consultar']);
      const host = await carregarCom([fatoCom('NEGADA', 'SENSIVEL')], [pendencia(fatoDoAdministrador.id)]);
      abrirDetalhe(host);

      expect(botaoDaPagina(host, 'Aceitar recomendação')).toBeUndefined();
      expect(botaoDaPagina(host, 'Enviar solicitação')).toBeUndefined();
    });

    it('oferece "Enviar solicitação" com fato pendente e a envia de uma vez', async () => {
      const host = await carregarCom([fatoCom('PENDENTE')], [pendencia(fatoDoAdministrador.id)]);
      botaoDaPagina(host, 'Enviar solicitação')?.click();
      fixture.detectChanges();

      expect(host.querySelector('cfg-solicitacao-da-protecao-dialog')?.textContent).toContain('Trabalha');
      Array.from<HTMLButtonElement>(host.querySelectorAll('cfg-solicitacao-da-protecao-dialog button'))
        .find((b) => b.textContent?.includes('Enviar solicitação'))
        ?.click();

      const post = controller.expectOne(`${PROTECAO}/solicitacoes`);
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      post.flush({ tiposDeDocumento: 0, fatos: 1 });
      await propagar();

      controller.expectOne((r) => r.url === LISTA).flush([fatoCom('SOLICITADA')]);
      atenderPendencias();
      await propagar();
      fixture.detectChanges();
      expect(botaoDaPagina(host, 'Enviar solicitação')).toBeUndefined();
    });

    it('quem só consulta não pede a lista de pendências, que a API recusa e levaria ao acesso negado', async () => {
      concedidas.set(['configuracao:fatos-candidato:consultar']);
      await carregarCom([fatoCom('APROVADA')]);

      controller.expectNone((r) => r.url === PROTECAO);
    });

    it('criar ou editar um fato relê as pendências, e "Enviar solicitação" aparece com o fato novo', async () => {
      const host = await carregarCom([]);
      expect(botaoDaPagina(host, 'Enviar solicitação')).toBeUndefined();

      component['recarregar']();
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush([fatoCom('PENDENTE')]);
      atenderPendencias([pendencia(fatoDoAdministrador.id)]);
      await propagar();
      fixture.detectChanges();

      expect(botaoDaPagina(host, 'Enviar solicitação')).toBeDefined();
    });

    it('depois do envio, o foco vai ao título da lista, e não ao botão que some com a releitura', async () => {
      const host = await carregarCom([fatoCom('PENDENTE')], [pendencia(fatoDoAdministrador.id)]);
      botaoDaPagina(host, 'Enviar solicitação')?.click();
      fixture.detectChanges();
      Array.from<HTMLButtonElement>(host.querySelectorAll('cfg-solicitacao-da-protecao-dialog button'))
        .find((b) => b.textContent?.includes('Enviar solicitação'))
        ?.click();
      controller.expectOne(`${PROTECAO}/solicitacoes`).flush({ tiposDeDocumento: 0, fatos: 1 });
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush([fatoCom('SOLICITADA')]);
      atenderPendencias();
      await propagar();
      fixture.detectChanges();
      await propagar();

      expect(document.activeElement?.id).toBe('cfg-fatos-list-title');
    });

    it('não oferece "Enviar solicitação" sem fato pendente', async () => {
      const host = await carregarCom([fatoCom('SOLICITADA')]);

      expect(botaoDaPagina(host, 'Enviar solicitação')).toBeUndefined();
    });
  });
});

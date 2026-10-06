import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FatosCandidatoPage } from './fatos-candidato.page';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/admin/fatos-candidato`;
const FASES = `${BASE}/api/configuracao/fases-canonicas`;
const CATALOGO = `${BASE}/api/configuracao/fatos-candidato`;
const PROBLEMA = (status: number) => ({ status, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } });

describe('FatosCandidatoPage', () => {
  let fixture: ComponentFixture<FatosCandidatoPage>;
  let component: FatosCandidatoPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FatosCandidatoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(FatosCandidatoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

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
    descricao: null,
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
  };

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
      descricao: null,
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

  it('visualizar abre o fato só para consultar; editar, para alterar', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([fatoDoAdministrador]);
    await propagar();
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;

    (tela.querySelector('[aria-label^="Visualizar"]') as HTMLButtonElement).click();
    expect(component['drawerAberto']()).toBe(true);
    expect(component['somenteLeitura']()).toBe(true);
    fixture.detectChanges();
    const fechar = [...tela.querySelectorAll<HTMLButtonElement>('.cfg-form-footer button')].find((b) => b.textContent?.trim() === 'Fechar');
    fechar?.click();
    expect(component['drawerAberto']()).toBe(false);
    controller.match(() => true).forEach((req) => req.flush(null));

    component['drawerAberto'].set(false);
    (tela.querySelector('[aria-label^="Editar"]') as HTMLButtonElement).click();
    expect(component['somenteLeitura']()).toBe(false);
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
});

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CampusDto, CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampiStore } from './campi.store';
import { EdicaoDosCampi } from './edicao-dos-campi';

const ESCRITA_URL = 'http://localhost:5000/api/configuracao/admin/campi';

const campus: CampusDto = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: '12345',
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('EdicaoDosCampi', () => {
  let edicao: EdicaoDosCampi;
  let controller: HttpTestingController;
  const recarregar = vi.fn();

  beforeEach(() => {
    recarregar.mockClear();
    TestBed.configureTestingModule({
      providers: [
        EdicaoDosCampi,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: 'http://localhost:5000' },
        { provide: CampiStore, useValue: { recarregar } },
        {
          provide: NotificationService,
          useValue: { success: vi.fn(), errorFromProblem: vi.fn() },
        },
      ],
    });
    edicao = TestBed.inject(EdicaoDosCampi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  const recusar = (url: string, status: number, corpo: object): void => {
    controller.expectOne(url).flush(JSON.stringify({ type: 'about:blank', status, ...corpo }), {
      status,
      statusText: 'Erro',
      headers: { 'content-type': 'application/problem+json' },
    });
  };

  it('a edição abre com os valores do campus e salva por PUT no id dele', () => {
    edicao.abrirEdicao(campus);
    edicao.salvar();

    expect(edicao.modo()).toBe('editar');
    expect(edicao.titulo()).toBe('Editar campus');
    expect(edicao.form.controls.sigla.value).toBe('MARABA');
    const envio = controller.expectOne(`${ESCRITA_URL}/${campus.id}`);
    expect(envio.request.method).toBe('PUT');
    envio.flush(null, { status: 204, statusText: 'No Content' });
    expect(edicao.aberto()).toBe(false);
    expect(recarregar).toHaveBeenCalledOnce();
  });

  it('remover sem campus escolhido não envia nada', () => {
    edicao.removerConfirmado();

    controller.expectNone(() => true);
    expect(edicao.gravando()).toBe(false);
  });

  it('um código de endereço recusado fora do 422 vai ao bloco do endereço', () => {
    edicao.abrirEdicao(campus);
    edicao.salvar();
    recusar(`${ESCRITA_URL}/${campus.id}`, 400, {
      title: 'CEP em formato inválido',
      code: 'uniplus.endereco_referencia.cep_formato_invalido',
    });

    expect(edicao.erroDoEndereco()).toBe('CEP em formato inválido');
    expect(edicao.erro()).toBeNull();
  });

  it('uma recusa de campo que o formulário não tem avisa que não pôde ser mapeada', () => {
    edicao.abrirEdicao(campus);
    edicao.salvar();
    recusar(`${ESCRITA_URL}/${campus.id}`, 422, {
      title: 'Dados inválidos',
      code: 'uniplus.validacao',
      errors: [{ field: 'Desconhecido', code: 'uniplus.x', message: 'Recusado.' }],
    });

    expect(edicao.erro()).toBe('Não foi possível mapear os erros de validação. Revise os campos.');
  });

  it('a falha 5xx no salvamento mostra o título e mantém o formulário aberto', () => {
    edicao.abrirEdicao(campus);
    edicao.salvar();
    recusar(`${ESCRITA_URL}/${campus.id}`, 500, {
      title: 'Falha ao gravar',
      code: 'uniplus.erro_interno',
    });

    expect(edicao.erro()).toBe('Falha ao gravar');
    expect(edicao.aberto()).toBe(true);
  });
});

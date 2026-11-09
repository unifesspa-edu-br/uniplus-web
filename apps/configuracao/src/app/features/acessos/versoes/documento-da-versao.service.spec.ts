import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignedUploadClient } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  VersoesDoPerfilApi,
  type EnvioDoDocumentoDto,
  type VersaoPendenteDto,
} from '@uniplus/shared-data/autorizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok, recusa } from '../testes';
import { DocumentoDaVersaoService } from './documento-da-versao.service';

const AMANHA = new Date(Date.now() + 86_400_000).toISOString();
const ENVIO: EnvioDoDocumentoDto = {
  perfilId: 'p1',
  versaoId: 'v1',
  documentoId: 'd1',
  urlDeEnvio: 'https://armazenamento.test/envio',
  tipoDeMidia: 'application/pdf',
  expiraEm: AMANHA,
} as EnvioDoDocumentoDto;
const PDF = new File(['%PDF'], 'portaria.pdf', { type: 'application/pdf' });

function pendente(situacaoDoDocumento: string): VersaoPendenteDto {
  return { versaoId: 'v1', situacaoDoDocumento } as VersaoPendenteDto;
}

describe('DocumentoDaVersaoService', () => {
  const api = {
    confirmarDocumento: vi.fn(),
    novoDocumento: vi.fn(),
    reemitirEnvio: vi.fn(),
    lerDocumento: vi.fn(),
  };
  const armazenamento = { enviar: vi.fn() };
  const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
  const aoAndar = vi.fn();
  let servico: DocumentoDaVersaoService;

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideMensagensDeAcesso(),
        { provide: VersoesDoPerfilApi, useValue: api },
        { provide: SignedUploadClient, useValue: armazenamento },
        { provide: NotificationService, useValue: notificacoes },
      ],
    });
    servico = TestBed.inject(DocumentoDaVersaoService);
    armazenamento.enviar.mockReturnValue(
      of(new HttpResponse({ headers: new HttpHeaders({ ETag: '"abc"' }) })),
    );
    api.confirmarDocumento.mockReturnValue(of(ok({})));
  });

  it('leva o PDF ao armazenamento e confirma com o ETag recebido', async () => {
    const desfecho = await servico.enviar(ENVIO, PDF, aoAndar);

    expect(desfecho).toEqual({ ok: true });
    expect(armazenamento.enviar).toHaveBeenCalledWith(ENVIO.urlDeEnvio, PDF, 'application/pdf');
    expect(api.confirmarDocumento).toHaveBeenCalledWith('p1', 'v1', '"abc"');
    expect(aoAndar).toHaveBeenCalledWith('confirmando', 100);
  });

  it('diz que a falha de rede no armazenamento é do envio e não confirma', async () => {
    armazenamento.enviar.mockReturnValue(throwError(() => new Error('rede')));

    const desfecho = await servico.enviar(ENVIO, PDF, aoAndar);

    expect(desfecho).toEqual({
      ok: false,
      mensagem: 'Falha ao enviar o arquivo. Verifique a conexão e tente novamente.',
    });
    expect(api.confirmarDocumento).not.toHaveBeenCalled();
  });

  it('mostra a recusa da confirmação junto ao envio', async () => {
    api.confirmarDocumento.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.documento_invalido')));

    const desfecho = await servico.enviar(ENVIO, PDF, aoAndar);

    expect(desfecho.ok).toBe(false);
    expect((desfecho as { mensagem: string }).mensagem).toContain('O documento instituidor é inválido.');
  });

  it('reemite o envio do documento que aguarda o arquivo', async () => {
    api.reemitirEnvio.mockReturnValue(of(ok(ENVIO)));

    const desfecho = await servico.reenviar('p1', pendente('aguardando_envio'), PDF, aoAndar);

    expect(desfecho).toEqual({ ok: true });
    expect(api.reemitirEnvio).toHaveBeenCalledWith('p1', 'v1', expect.anything());
    expect(api.novoDocumento).not.toHaveBeenCalled();
  });

  it('pede outro documento, com o tamanho do arquivo, quando a verificação recusou o anterior', async () => {
    api.novoDocumento.mockReturnValue(of(ok(ENVIO)));

    await servico.reenviar('p1', pendente('recusado'), PDF, aoAndar);

    expect(api.novoDocumento).toHaveBeenCalledWith('p1', 'v1', PDF.size, expect.anything());
  });

  it('não envia nada quando o documento da versão não aguarda arquivo', async () => {
    const desfecho = await servico.reenviar('p1', pendente('verificado'), PDF, aoAndar);

    expect(desfecho).toEqual({ ok: false, mensagem: 'A versão não aguarda um documento.' });
    expect(armazenamento.enviar).not.toHaveBeenCalled();
  });

  it('abre o documento verificado numa aba nova e a deixa à vista', async () => {
    const aba = { location: { href: '' }, opener: {} as unknown, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);
    api.lerDocumento.mockReturnValue(of(ok({ url: 'https://armazenamento.test/doc', expiraEm: AMANHA })));

    const desfecho = await servico.abrir('p1', 'v1', () => true);

    expect(desfecho).toBe('aberta');
    expect(aba.location.href).toBe('https://armazenamento.test/doc');
  });

  it('diz que o navegador bloqueou a aba sem pedir a URL do documento', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    expect(await servico.abrir('p1', 'v1', () => true)).toBe('bloqueada');
    expect(api.lerDocumento).not.toHaveBeenCalled();
  });

  it('devolve o texto da recusa da leitura do documento', async () => {
    const aba = { close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);
    api.lerDocumento.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.documento_nao_verificado')));

    const desfecho = await servico.abrir('p1', 'v1', () => true);

    expect(desfecho).toEqual({
      recusa: expect.stringContaining('O documento instituidor ainda não foi verificado.'),
    });
    expect(aba.close).toHaveBeenCalled();
  });
});

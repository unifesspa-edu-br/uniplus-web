import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildVendorMimeAccept } from '@uniplus/shared-core/http';
import type { ProvidenciaDto } from '@uniplus/shared-data/autorizacao';
import { ProvidenciaDetalhePage } from './providencia-detalhe.page';
import {
  ADMINISTRAR,
  ID,
  ROTA,
  SOLICITAR,
  assentar,
  botao,
  digitar,
  montar,
  notificacoes,
  pessoa,
  problema,
  providencia,
  type Montagem,
} from './providencias.testing';

const DETALHE = `${ROTA}/${ID}`;

describe('ProvidenciaDetalhePage', () => {
  let tela: Montagem<ProvidenciaDetalhePage>;

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    tela.http.verify();
    document.body.innerHTML = '';
  });

  async function abrir(
    dados: ProvidenciaDto = providencia(),
    concedidas: readonly string[] = [ADMINISTRAR],
  ) {
    tela = montar(ProvidenciaDetalhePage, concedidas);
    tela.fixture.componentRef.setInput('id', ID);
    tela.fixture.detectChanges();
    const leitura = tela.http.expectOne(DETALHE);
    expect(leitura.request.headers.get('Accept')).toBe(buildVendorMimeAccept('providencia', 1));
    leitura.flush(dados);
    await assentar();
  }

  const texto = () => tela.host.textContent?.replace(/\s+/g, ' ') ?? '';
  const campo = <T extends HTMLElement>(seletor: string) =>
    document.querySelector(`cfg-motivo-dialog ${seletor}`) as T;
  const daRevogacao = <T extends HTMLElement>(seletor: string) =>
    document.querySelector(`cfg-revogar-concessao-dialog ${seletor}`) as T;

  it('mostra o tipo, a situação, o fundamento, quem solicitou e a concessão', async () => {
    await abrir();

    expect(texto()).toContain('Retirada do acesso');
    expect(texto()).toContain('Aberta');
    expect(texto()).toContain('Deixou a banca');
    expect(texto()).toContain('Kevin Carvalho');
    expect(texto()).toContain('Leandro Viana');
    expect(texto()).toContain('Banca de documentos');
  });

  it('na prejudicada mostra o que encerrou a concessão e não oferece ação', async () => {
    await abrir(
      providencia({
        situacao: 'prejudicada',
        encerramentoDaConcessao: { causa: 'vencida', em: '2026-11-11T03:00:00Z' },
      }),
    );

    expect(texto()).toContain('Prejudicada');
    expect(texto()).toContain('Concessão vencida em 11/11/2026');
    expect(botao('Responder')).toBeUndefined();
  });

  it('no desfecho mostra quando, quem e o motivo', async () => {
    await abrir(
      providencia({
        situacao: 'respondida',
        desfecho: {
          em: '2026-11-12T14:00:00Z',
          por: pessoa('sub-diogo', 'Diogo Souza'),
          motivo: 'Segue na banca até o fim do certame.',
        },
      }),
    );

    expect(texto()).toContain('Diogo Souza');
    expect(texto()).toContain('Segue na banca até o fim do certame.');
    expect(botao('Responder')).toBeUndefined();
  });

  it('com impedidoDeResponder esconde os botões e explica por quê', async () => {
    await abrir(providencia({ impedidoDeResponder: true }));

    expect(botao('Responder')).toBeUndefined();
    expect(botao('Atender e revogar a concessão')).toBeUndefined();
    expect(texto()).toContain('não a respondem');
  });

  it('quem só solicita acompanha, sem os botões de responder', async () => {
    await abrir(providencia(), [SOLICITAR]);

    expect(botao('Responder')).toBeUndefined();
  });

  it('responde com o motivo aparado e relê a providência', async () => {
    await abrir();
    botao('Responder')?.click();
    await assentar();
    digitar(campo<HTMLTextAreaElement>('textarea'), '  Segue na banca.  ');
    botao('Registrar resposta')?.click();
    await assentar();

    const envio = tela.http.expectOne(`${DETALHE}/resposta`);
    expect(envio.request.body).toEqual({ motivo: 'Segue na banca.' });
    expect(envio.request.headers.get('Idempotency-Key')).toBeTruthy();
    envio.flush(providencia({ situacao: 'respondida' }));
    await assentar();

    expect(notificacoes.success).toHaveBeenCalledWith('Providência respondida');
    tela.http.expectOne(DETALHE).flush(providencia({ situacao: 'respondida' }));
    await assentar();
  });

  it('a resposta sem motivo não é enviada', async () => {
    await abrir();
    botao('Responder')?.click();
    await assentar();
    botao('Registrar resposta')?.click();
    await assentar();

    tela.http.expectNone(`${DETALHE}/resposta`);
    expect(campo('textarea').getAttribute('aria-invalid')).toBe('true');
  });

  it('o conflito retentável se repete uma vez, com a mesma chave', async () => {
    await abrir();
    botao('Responder')?.click();
    await assentar();
    digitar(campo<HTMLTextAreaElement>('textarea'), 'Segue na banca.');
    botao('Registrar resposta')?.click();
    await assentar();

    const primeira = tela.http.expectOne(`${DETALHE}/resposta`);
    const chave = primeira.request.headers.get('Idempotency-Key');
    primeira.flush(...problema(409, 'uniplus.concorrencia.conflito', { retryable: true }));
    await assentar();
    const segunda = tela.http.expectOne(`${DETALHE}/resposta`);
    expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
    segunda.flush(providencia({ situacao: 'respondida' }));
    await assentar();
    tela.http.expectOne(DETALHE).flush(providencia({ situacao: 'respondida' }));
    await assentar();
  });

  it('a providência já respondida por outra pessoa mostra a recusa e relê', async () => {
    await abrir();
    botao('Responder')?.click();
    await assentar();
    digitar(campo<HTMLTextAreaElement>('textarea'), 'Segue na banca.');
    botao('Registrar resposta')?.click();
    await assentar();

    tela.http
      .expectOne(`${DETALHE}/resposta`)
      .flush(...problema(409, 'uniplus.autorizacao.providencia.ja_respondida'));
    await assentar();

    expect(document.body.textContent).toContain('A providência já foi respondida.');
    tela.http.expectOne(DETALHE).flush(providencia({ situacao: 'respondida' }));
    await assentar();
  });

  it('o atendimento pede o e-mail do beneficiário e o leva com o motivo', async () => {
    await abrir();
    botao('Atender e revogar a concessão')?.click();
    await assentar();
    digitar(daRevogacao<HTMLTextAreaElement>('textarea'), 'Deixou a banca.');
    digitar(daRevogacao<HTMLInputElement>('input[type="email"]'), 'leandro-viana84@agenciadbd.com');
    await assentar();
    botao('Revogar concessão')?.click();
    await assentar();

    const envio = tela.http.expectOne(`${DETALHE}/atendimento`);
    expect(envio.request.body).toEqual({
      motivo: 'Deixou a banca.',
      confirmacaoEmail: 'leandro-viana84@agenciadbd.com',
    });
    envio.flush(providencia({ situacao: 'atendida' }));
    await assentar();
    expect(notificacoes.success).toHaveBeenCalledWith('Providência atendida e concessão revogada');
    tela.http.expectOne(DETALHE).flush(providencia({ situacao: 'atendida' }));
    await assentar();
  });

  it('o e-mail que não confere fica no campo do e-mail', async () => {
    await abrir();
    botao('Atender e revogar a concessão')?.click();
    await assentar();
    digitar(daRevogacao<HTMLTextAreaElement>('textarea'), 'Deixou a banca.');
    digitar(daRevogacao<HTMLInputElement>('input[type="email"]'), 'outra@agenciadbd.com');
    await assentar();
    botao('Revogar concessão')?.click();
    await assentar();

    const code = 'uniplus.autorizacao.concessao.confirmacao_divergente';
    tela.http.expectOne(`${DETALHE}/atendimento`).flush(
      ...problema(422, code, {
        errors: [{ field: 'confirmacaoEmail', code, message: 'O e-mail não confere.' }],
      }),
    );
    await assentar();

    expect(daRevogacao('input[type="email"]').getAttribute('aria-invalid')).toBe('true');
    expect(document.body.textContent).toContain('O e-mail não confere.');
  });

  it('a leitura sem registro (503) mostra a falha sem nenhum dado', async () => {
    tela = montar(ProvidenciaDetalhePage, [ADMINISTRAR]);
    tela.fixture.componentRef.setInput('id', ID);
    tela.fixture.detectChanges();
    tela.http
      .expectOne(DETALHE)
      .flush(...problema(503, 'uniplus.autorizacao.registro_de_acesso.falha_ao_gravar'));
    await assentar();

    expect(texto()).toContain('Não foi possível carregar a providência');
    expect(texto()).not.toContain('Leandro Viana');
  });
});

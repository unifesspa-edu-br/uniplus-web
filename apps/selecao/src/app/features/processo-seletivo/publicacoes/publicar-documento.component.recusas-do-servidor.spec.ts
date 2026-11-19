import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  TelaDePublicarDocumento,
  ROTA_ATOS,
  DOCUMENTO_PRINCIPAL,
  ATO_AVISO,
  PRINCIPAL,
  tick,
  problema,
} from './publicar-documento.component.testing';

describe('PublicarDocumentoComponent — recusas do servidor ao publicar', () => {
  let tela: TelaDePublicarDocumento;

  beforeEach(async () => {
    tela = new TelaDePublicarDocumento();
    await tela.abrir({ tipo: 'avulso' });
  });

  afterEach(() => tela.controller.verify());

  it('mostra a recusa do servidor sem perder o que foi preenchido nem os arquivos enviados', async () => {
    tela.preencher({
      tipoAtoCodigo: 'ERRATA',
      assinante: 'Pró-reitoria de Ensino',
      atoCorrigidoId: ATO_AVISO,
      motivoDaCorrecao: 'Corrige a data de abertura.',
    });
    await tela.enviar(PRINCIPAL, 'errata.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
    tela.clicar('button[type="submit"]');
    tela.clicar('[data-testid="confirm-dialog-confirm"]');

    const requisicao = tela.controller.expectOne(ROTA_ATOS);
    const recusa = problema(
      422,
      'uniplus.selecao.ato_do_processo.ato_corrigido_ja_corrigido',
      'O ato corrigido já foi corrigido; a cadeia de correção é linear',
    );
    requisicao.flush(recusa.body, recusa.opts);
    await tick();
    tela.fixture.detectChanges();

    expect(tela.textoDoResumo()).toContain('O ato corrigido já foi corrigido');
    expect(tela.aberto()).toBe(true);
    expect(tela.publicados).toBe(0);
    expect(tela.valorDe('#pub-tipo')).toBe('ERRATA');
    expect(tela.valorDe('#pub-assinante')).toBe('Pró-reitoria de Ensino');
    expect(tela.valorDe('#pub-motivo')).toBe('Corrige a data de abertura.');
    expect(tela.confirmadosNo('pub-principal-titulo')).toBe(1);
    expect((tela.host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it.each([
    [
      'uniplus.publicacoes.ato_normativo.objeto_ja_tem_ato_vivo_do_tipo',
      'O objeto já tem ato vivo do tipo',
    ],
    ['uniplus.publicacoes.ato_normativo.ato_ja_retificado', 'O ato já foi retificado'],
  ])(
    'mostra o 409 %s com a mensagem da API e mantém o que foi preenchido',
    async (code, titulo) => {
      tela.preencher({
        tipoAtoCodigo: 'AVISO',
        assinante: 'Pró-reitoria de Ensino',
        numero: '02/2026',
      });
      await tela.enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
      await tela.publicarERecusar(problema(409, code, titulo));

      expect(tela.textoDoResumo()).toContain(titulo);
      expect(tela.aberto()).toBe(true);
      expect(tela.valorDe('#pub-numero')).toBe('02/2026');
      expect(tela.valorDe('#pub-assinante')).toBe('Pró-reitoria de Ensino');
      expect(tela.confirmadosNo('pub-principal-titulo')).toBe(1);
    },
  );

  it('marca o campo que o servidor recusou com a mensagem dele', async () => {
    tela.preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
    await tela.enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
    tela.clicar('button[type="submit"]');
    tela.clicar('[data-testid="confirm-dialog-confirm"]');

    const requisicao = tela.controller.expectOne(ROTA_ATOS);
    requisicao.flush(
      {
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validation.failed',
        traceId: 'trace-1',
        errors: [
          {
            field: 'Assinante',
            code: 'maxlength',
            message: 'Assinante deve ter no máximo 200 caracteres.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await tick();
    tela.fixture.detectChanges();

    expect(tela.host.querySelector('#pub-assinante')?.closest('.field')?.textContent).toContain(
      'Assinante deve ter no máximo 200 caracteres.',
    );
  });

  it('repete o mesmo pedido sob a mesma chave quando a resposta se perde', async () => {
    tela.preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
    await tela.enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
    tela.clicar('button[type="submit"]');
    tela.clicar('[data-testid="confirm-dialog-confirm"]');

    const primeira = tela.controller.expectOne(ROTA_ATOS);
    const chave = primeira.request.headers.get('Idempotency-Key');
    expect(chave).not.toBeNull();
    primeira.error(new ProgressEvent('error'));
    await tick();
    tela.fixture.detectChanges();
    expect(tela.textoDoResumo()).toContain('Não foi possível saber se o documento foi publicado');

    tela.clicar('button[type="submit"]');
    tela.clicar('[data-testid="confirm-dialog-confirm"]');
    const segunda = tela.controller.expectOne(ROTA_ATOS);

    expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
    segunda.flush({ atoId: ATO_AVISO }, { status: 201, statusText: 'Created' });
    await tick();
  });
});

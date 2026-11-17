import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  TelaDePublicarDocumento,
  ROTA_ATOS,
  DOCUMENTO_PRINCIPAL,
  PRINCIPAL,
  tick,
} from './publicar-documento.component.testing';

const CABECALHOS = { 'Content-Type': 'application/problem+json' };

describe('PublicarDocumentoComponent — causas gerais da recusa', () => {
  let tela: TelaDePublicarDocumento;

  beforeEach(async () => {
    tela = new TelaDePublicarDocumento();
    await tela.abrir({ tipo: 'avulso' });
  });

  afterEach(() => tela.controller.verify());

  it('mostra no resumo a causa sem campo e a do campo vazio, sem marcar controle', async () => {
    tela.preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
    await tela.enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
    tela.clicar('button[type="submit"]');
    tela.clicar('[data-testid="confirm-dialog-confirm"]');

    tela.controller.expectOne(ROTA_ATOS).flush(
      {
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validation.failed',
        traceId: 'trace-1',
        errors: [
          { code: 'Ato.Bloqueado', message: 'O processo não aceita novos atos.' },
          { field: '', code: 'Pedido.Invalido', message: 'O pedido está incompleto.' },
        ],
      },
      { status: 422, statusText: 'Unprocessable', headers: CABECALHOS },
    );
    await tick();
    tela.fixture.detectChanges();

    expect(tela.textoDoResumo()).toContain('O processo não aceita novos atos.');
    expect(tela.textoDoResumo()).toContain('O pedido está incompleto.');
    expect(tela.host.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  });
});

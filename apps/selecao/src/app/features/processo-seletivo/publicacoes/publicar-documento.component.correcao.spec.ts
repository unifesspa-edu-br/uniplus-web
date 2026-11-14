import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  TelaDePublicarDocumento,
  ROTA_ATOS,
  DOCUMENTO_PRINCIPAL,
  ATO_AVISO,
  PRINCIPAL,
  aviso,
  tick,
} from './publicar-documento.component.testing';

describe('PublicarDocumentoComponent — correção de um ato', () => {
  let tela: TelaDePublicarDocumento;

  beforeEach(async () => {
    tela = new TelaDePublicarDocumento();
    await tela.abrir({ tipo: 'correcao', ato: aviso });
  });

  afterEach(() => tela.controller.verify());

  it('fixa o ato corrigido e oferece todos os tipos de documento avulso, não só a errata', () => {
    expect(tela.host.querySelector('#pub-corrigido')).toBeNull();
    expect(tela.host.textContent).toContain('Aviso nº 01/2026');
    expect(
      Array.from(tela.host.querySelectorAll('#pub-tipo option')).map((o) => o.textContent?.trim()),
    ).toEqual(['Selecione o tipo', 'Aviso', 'Errata']);
  });

  it('corrige o ato com um aviso, que não exige ato corrigido', async () => {
    tela.preencher({
      tipoAtoCodigo: 'AVISO',
      assinante: 'Pró-reitoria de Ensino',
      motivoDaCorrecao: 'Corrige a data.',
    });
    await tela.enviar(PRINCIPAL, 'aviso2.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

    tela.clicar('button[type="submit"]');
    tela.clicar('[data-testid="confirm-dialog-confirm"]');

    const requisicao = tela.controller.expectOne(ROTA_ATOS);
    expect(requisicao.request.body).toMatchObject({
      tipoAtoCodigo: 'AVISO',
      atoCorrigidoId: ATO_AVISO,
      motivoDaCorrecao: 'Corrige a data.',
    });
    requisicao.flush({ atoId: ATO_AVISO }, { status: 202, statusText: 'Accepted' });
    await tick();
  });

  it('exige o motivo da correção', async () => {
    tela.preencher({ tipoAtoCodigo: 'ERRATA', assinante: 'Pró-reitoria de Ensino' });
    await tela.enviar(PRINCIPAL, 'errata.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

    tela.clicar('button[type="submit"]');

    expect(tela.confirmando()).toBe(false);
    expect(tela.host.querySelector('#pub-motivo')?.closest('.field')?.textContent).toContain(
      'Campo obrigatório.',
    );
  });

  it('envia o ato clicado como o corrigido', async () => {
    tela.preencher({
      tipoAtoCodigo: 'ERRATA',
      assinante: 'Pró-reitoria de Ensino',
      motivoDaCorrecao: 'Corrige a data.',
    });
    await tela.enviar(PRINCIPAL, 'errata.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

    tela.clicar('button[type="submit"]');
    tela.clicar('[data-testid="confirm-dialog-confirm"]');

    const requisicao = tela.controller.expectOne(ROTA_ATOS);
    expect(requisicao.request.body).toMatchObject({
      tipoAtoCodigo: 'ERRATA',
      atoCorrigidoId: ATO_AVISO,
      motivoDaCorrecao: 'Corrige a data.',
    });
    requisicao.flush({ atoId: ATO_AVISO }, { status: 202, statusText: 'Accepted' });
    await tick();
  });
});

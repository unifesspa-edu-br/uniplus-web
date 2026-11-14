import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  TelaDePublicarDocumento,
  ROTA_ATOS,
  DOCUMENTO_PRINCIPAL,
  DOCUMENTO_ANEXO,
  ATO_AVISO,
  DOCX,
  PRINCIPAL,
  ANEXOS,
  tick,
} from './publicar-documento.component.testing';

describe('PublicarDocumentoComponent — documento avulso', () => {
  let tela: TelaDePublicarDocumento;

  beforeEach(async () => {
    tela = new TelaDePublicarDocumento();
    await tela.abrir({ tipo: 'avulso' });
  });

  afterEach(() => tela.controller.verify());

  it('liga a mensagem de erro de cada campo ao campo, para o leitor de tela', () => {
    tela.preencher({ tipoAtoCodigo: 'ERRATA', numero: 'N'.repeat(61) });
    tela.clicar('button[type="submit"]');

    for (const campo of ['pub-numero', 'pub-corrigido', 'pub-assinante', 'pub-motivo']) {
      const controle = tela.host.querySelector(`#${campo}`) as HTMLElement;
      const erro = tela.host.querySelector(`#${campo}-erro`);
      expect(erro, campo).not.toBeNull();
      expect(controle.getAttribute('aria-describedby') ?? '', campo).toContain(`${campo}-erro`);
    }
  });

  it('pede o ato corrigido só quando o tipo escolhido corrige outro', () => {
    tela.preencher({ tipoAtoCodigo: 'AVISO' });
    expect(tela.host.querySelector('#pub-corrigido')).toBeNull();

    tela.preencher({ tipoAtoCodigo: 'ERRATA' });
    expect(tela.host.querySelector('#pub-corrigido')).not.toBeNull();
    expect(tela.host.querySelector('#pub-motivo')).not.toBeNull();
  });

  it('avisa que a publicação é irreversível e só envia depois da confirmação', async () => {
    tela.preencher({
      tipoAtoCodigo: 'AVISO',
      assinante: 'Pró-reitoria de Ensino',
      numero: '02/2026',
    });
    await tela.enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
    await tela.enviar(ANEXOS, 'planilha.docx', DOCUMENTO_ANEXO, DOCX);

    tela.clicar('button[type="submit"]');

    tela.controller.expectNone(ROTA_ATOS);
    expect(tela.confirmando()).toBe(true);
    expect(tela.host.querySelector('.uni-dialog__body')?.textContent).toContain(
      'não pode ser desfeita',
    );

    tela.clicar('[data-testid="confirm-dialog-confirm"]');
    const requisicao = tela.controller.expectOne(ROTA_ATOS);
    expect(requisicao.request.body).toMatchObject({
      tipoAtoCodigo: 'AVISO',
      numero: '02/2026',
      assinante: 'Pró-reitoria de Ensino',
      documentoPrincipalId: DOCUMENTO_PRINCIPAL,
      anexos: [{ documentoId: DOCUMENTO_ANEXO, nome: 'planilha' }],
    });
    expect(requisicao.request.body).not.toHaveProperty('atoCorrigidoId');
    requisicao.flush({ atoId: ATO_AVISO }, { status: 201, statusText: 'Created' });
    await tick();

    expect(tela.publicados).toBe(1);
    expect(tela.aberto()).toBe(false);
  });

  it('não envia sem o documento principal, diz o que falta e leva o foco ao aviso', async () => {
    tela.preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });

    tela.clicar('button[type="submit"]');
    await tick();
    tela.fixture.detectChanges();

    expect(tela.confirmando()).toBe(false);
    expect(tela.textoDoResumo()).toContain('Envie o documento principal');
    expect(document.activeElement).toBe(tela.host.querySelector('.pub__resumo'));
  });

  it('não envia com o nome de anexo que o servidor recusaria e diz de qual anexo é', async () => {
    tela.preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
    await tela.enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
    await tela.enviar(ANEXOS, 'planilha.docx', DOCUMENTO_ANEXO, DOCX);
    const nome = tela.host.querySelector<HTMLInputElement>(
      'input[id^="pub-anexo-nome-"]',
    ) as HTMLInputElement;
    nome.value = 'pasta/planilha';
    nome.dispatchEvent(new Event('input'));
    tela.fixture.detectChanges();

    tela.clicar('button[type="submit"]');

    expect(tela.confirmando()).toBe(false);
    expect(tela.textoDoResumo()).toContain('Anexo planilha.docx: O nome do anexo não pode ter');
  });

  it('tira o aviso da tela quando a pessoa resolve o que faltava', async () => {
    tela.preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
    tela.clicar('button[type="submit"]');
    expect(tela.textoDoResumo()).toContain('Envie o documento principal');

    await tela.enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
    tela.fixture.detectChanges();

    expect(tela.host.querySelector('.pub__resumo')).toBeNull();
  });

  it('não leva o ato corrigido escolhido antes de trocar para um tipo que não corrige', async () => {
    tela.preencher({
      tipoAtoCodigo: 'ERRATA',
      atoCorrigidoId: ATO_AVISO,
      motivoDaCorrecao: 'Corrige a data.',
    });
    tela.preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
    await tela.enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

    tela.clicar('button[type="submit"]');
    tela.clicar('[data-testid="confirm-dialog-confirm"]');

    const requisicao = tela.controller.expectOne(ROTA_ATOS);
    expect(requisicao.request.body).not.toHaveProperty('atoCorrigidoId');
    expect(requisicao.request.body).not.toHaveProperty('motivoDaCorrecao');
    requisicao.flush({ atoId: ATO_AVISO }, { status: 201, statusText: 'Created' });
    await tick();
  });

  it('envia o ato corrigido e o motivo quando o tipo é errata', async () => {
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
    expect(requisicao.request.body).toMatchObject({
      tipoAtoCodigo: 'ERRATA',
      atoCorrigidoId: ATO_AVISO,
      motivoDaCorrecao: 'Corrige a data de abertura.',
    });
    requisicao.flush({ atoId: ATO_AVISO }, { status: 201, statusText: 'Created' });
    await tick();
  });
});

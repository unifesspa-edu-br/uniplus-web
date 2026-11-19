import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ModoDaPublicacao } from './modo-da-publicacao';
import {
  TelaDePublicarDocumento,
  DOCUMENTO_PRINCIPAL,
  ATO_AVISO,
  ROTA_PRODUTO,
  PRINCIPAL,
  POLITICA,
  aviso,
  item,
  tick,
  problema,
} from './publicar-documento.component.testing';

describe('PublicarDocumentoComponent — item do edital', () => {
  let tela: TelaDePublicarDocumento;

  beforeEach(() => {
    tela = new TelaDePublicarDocumento();
  });

  afterEach(() => tela.controller.verify());

  const confirmar = (): void => {
    tela.clicar('button[type="submit"]');
    if (tela.confirmando()) tela.clicar('[data-testid="confirm-dialog-confirm"]');
  };

  async function preparar(modo: ModoDaPublicacao): Promise<void> {
    await tela.abrir(modo);
    tela.preencher({ assinante: 'Pró-reitoria de Ensino', numero: '01/2026' });
    await tela.enviar(PRINCIPAL, 'lista.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
  }

  const publicarResultado: ModoDaPublicacao = {
    tipo: 'previsto',
    item: item(),
    politica: POLITICA,
    corrigido: null,
  };

  it('não pede o tipo, que vem do item, e mostra a política do certame com os campos pelo nome', async () => {
    await tela.abrir({
      ...publicarResultado,
      politica: {
        campos: ['Número de inscrição', 'Nome'],
        justificativa: 'Lista nominal prevista no edital.',
      },
    });

    expect(tela.host.querySelector('#pub-tipo')).toBeNull();
    expect(tela.host.textContent).toContain('Resultado da homologação');
    const politica =
      tela.host.querySelector('[aria-labelledby="pub-politica-titulo"]')?.textContent ?? '';
    expect(politica).toContain('Número de inscrição');
    expect(politica).toContain('Nome');
    expect(politica).toContain('Lista nominal prevista no edital.');
  });

  it('não publica o resultado sem a confirmação da política, e leva o foco à confirmação', async () => {
    await preparar(publicarResultado);

    confirmar();
    await tick();
    tela.fixture.detectChanges();

    tela.controller.expectNone(ROTA_PRODUTO);
    expect(tela.confirmando()).toBe(false);
    const caixa = tela.host.querySelector('#pub-politica') as HTMLInputElement;
    expect(caixa.getAttribute('aria-invalid')).toBe('true');
    expect(caixa.getAttribute('aria-describedby')).toContain('pub-politica-erro');
    expect(tela.host.querySelector('#pub-politica-erro')?.textContent).toContain(
      'Confirme que o documento segue a política de divulgação do certame.',
    );
    expect(document.activeElement).toBe(caixa);
  });

  it('publica o resultado no item, sem o tipo, com a confirmação da política', async () => {
    await preparar(publicarResultado);
    (tela.host.querySelector('#pub-politica') as HTMLInputElement).click();
    tela.fixture.detectChanges();

    confirmar();

    const requisicao = tela.controller.expectOne(ROTA_PRODUTO);
    expect(requisicao.request.body).toMatchObject({
      numero: '01/2026',
      assinante: 'Pró-reitoria de Ensino',
      documentoPrincipalId: DOCUMENTO_PRINCIPAL,
      politicaDeDivulgacaoConfirmada: true,
    });
    expect(requisicao.request.body).not.toHaveProperty('tipoAtoCodigo');
    expect(requisicao.request.body).not.toHaveProperty('atoCorrigidoId');
    requisicao.flush({ atoId: ATO_AVISO }, { status: 201, statusText: 'Created' });
    await tick();

    expect(tela.publicados).toBe(1);
    expect(tela.aberto()).toBe(false);
  });

  it('não mostra a política nem a pede quando o item não é resultado', async () => {
    await preparar({
      tipo: 'previsto',
      item: item({ papel: null }),
      politica: null,
      corrigido: null,
    });
    expect(tela.host.querySelector('#pub-politica')).toBeNull();

    confirmar();

    const requisicao = tela.controller.expectOne(ROTA_PRODUTO);
    expect(requisicao.request.body).toMatchObject({ politicaDeDivulgacaoConfirmada: false });
    requisicao.flush({ atoId: ATO_AVISO }, { status: 201, statusText: 'Created' });
    await tick();
  });

  it('corrige a publicação mais recente: leva o ato corrigido, exige o motivo e a política', async () => {
    await preparar({ ...publicarResultado, corrigido: aviso });
    expect(tela.host.textContent).toContain('Corrigir Aviso nº 01/2026');

    confirmar();
    expect(tela.confirmando()).toBe(false);
    expect(tela.host.querySelector('#pub-motivo')?.closest('.field')?.textContent).toContain(
      'Campo obrigatório.',
    );
    expect(tela.host.querySelector('#pub-politica')?.getAttribute('aria-invalid')).toBe('true');

    tela.preencher({ motivoDaCorrecao: 'Corrige a classificação.' });
    (tela.host.querySelector('#pub-politica') as HTMLInputElement).click();
    tela.fixture.detectChanges();
    confirmar();

    const requisicao = tela.controller.expectOne(ROTA_PRODUTO);
    expect(requisicao.request.body).toMatchObject({
      atoCorrigidoId: ATO_AVISO,
      motivoDaCorrecao: 'Corrige a classificação.',
      politicaDeDivulgacaoConfirmada: true,
    });
    requisicao.flush({ atoId: ATO_AVISO }, { status: 201, statusText: 'Created' });
    await tick();
  });

  it('mostra a recusa do servidor com a mensagem do catálogo e mantém o formulário preenchido', async () => {
    await preparar({ ...publicarResultado, item: item({ papel: 'DEFINITIVO' }) });
    (tela.host.querySelector('#pub-politica') as HTMLInputElement).click();
    tela.fixture.detectChanges();
    confirmar();

    const recusa = problema(
      422,
      'uniplus.selecao.ato_do_processo.preliminar_nao_publicado',
      'O resultado definitivo só pode ser publicado depois do preliminar da mesma matéria.',
    );
    tela.controller.expectOne(ROTA_PRODUTO).flush(recusa.body, recusa.opts);
    await tick();
    tela.fixture.detectChanges();

    expect(tela.textoDoResumo()).toContain('só pode ser publicado depois do preliminar');
    expect(tela.aberto()).toBe(true);
    expect((tela.host.querySelector('#pub-politica') as HTMLInputElement).checked).toBe(true);
    expect(tela.confirmadosNo('pub-principal-titulo')).toBe(1);
  });
});

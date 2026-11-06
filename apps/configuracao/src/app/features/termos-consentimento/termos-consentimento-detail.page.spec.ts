import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CenaDoDetalhe,
  CODIGOS,
  ID,
  LEITURA,
  PROMOVER,
  RASCUNHO,
  REMOVER,
  REVISADO,
  REVISAR,
  SEM_CONTEUDO,
  montarDetalhe,
  recusar,
  termo,
  versao,
} from './termos-consentimento.testing';

let cena: CenaDoDetalhe;
afterEach(() => cena.controller.verify());

describe('TermosConsentimentoDetailPage — leitura', () => {
  it('não exibe o rascunho se a leitura falhar e avisa só no 5xx', async () => {
    cena = await montarDetalhe(ID, null);
    recusar(
      cena.controller.expectOne(LEITURA),
      503,
      'uniplus.indisponivel',
      'Serviço indisponível',
    );
    await cena.propagar();
    expect(cena.fixture.nativeElement.querySelector('form')).toBeNull();
    expect(cena.fixture.nativeElement.textContent).toContain('Serviço indisponível');
    expect(cena.avisos()).toEqual(['Serviço indisponível']);
  });

  it('não avisa por toast quando a leitura é recusada com 4xx', async () => {
    cena = await montarDetalhe(ID, null);
    recusar(
      cena.controller.expectOne(LEITURA),
      404,
      'uniplus.configuracao.termo_consentimento.nao_encontrado',
      'Termo não encontrado',
    );
    await cena.propagar();
    expect(cena.fixture.nativeElement.textContent).toContain('Termo não encontrado');
    expect(cena.avisos()).toEqual([]);
  });

  it('"Tentar novamente" fica indisponível durante a carga e, ao dar certo, leva o foco ao título', async () => {
    cena = await montarDetalhe(ID, null);
    recusar(
      cena.controller.expectOne(LEITURA),
      503,
      'uniplus.indisponivel',
      'Serviço indisponível',
    );
    await cena.propagar();
    const tentar = cena.botao('Tentar novamente');
    tentar.focus();
    tentar.click();
    await cena.propagar();
    expect(cena.botao('Tentar novamente')).toBe(tentar);
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(tentar.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(tentar);
    tentar.click();
    cena.controller.expectOne(LEITURA).flush(termo());
    await cena.propagar();
    await cena.propagar();
    expect(cena.fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(document.activeElement).toBe(cena.titulo());
  });

  it('o foco levado a "Voltar à lista" durante a carga continua lá ao fim dela', async () => {
    cena = await montarDetalhe(ID, null);
    const voltar = cena.elemento<HTMLAnchorElement>('a.cfg-voltar');
    voltar.focus();
    cena.controller.expectOne(LEITURA).flush(termo());
    await cena.propagar();
    await cena.propagar();
    expect(cena.fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(document.activeElement).toBe(voltar);
  });

  it('"Tentar novamente" com nova falha mantém o foco no botão', async () => {
    cena = await montarDetalhe(ID, null);
    recusar(
      cena.controller.expectOne(LEITURA),
      503,
      'uniplus.indisponivel',
      'Serviço indisponível',
    );
    await cena.propagar();
    const tentar = cena.botao('Tentar novamente');
    tentar.focus();
    tentar.click();
    await cena.propagar();
    recusar(
      cena.controller.expectOne(LEITURA),
      503,
      'uniplus.indisponivel',
      'Serviço indisponível',
    );
    await cena.propagar();
    await cena.propagar();
    expect(cena.botao('Tentar novamente')).toBe(tentar);
    expect(tentar.getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(tentar);
  });

  it('mostra os motivos dos botões indisponíveis, sem afirmar causa que o termo não tem', async () => {
    cena = await montarDetalhe(ID, termo({ textoRascunho: null, versoes: [versao()] }));
    const motivo = (nome: string): string | null =>
      cena.elemento(`[aria-label="${nome} indisponível"]`).getAttribute('data-tooltip');
    expect(motivo('Marcar como revisado')).toBe(
      'Preencha texto e base legal do rascunho salvo antes de marcar como revisado.',
    );
    expect(motivo('Promover a versão')).toBe('Marque o rascunho como revisado antes de promover.');
    expect(motivo('Remover termo')).toBe('Termo com versão promovida não pode ser removido.');
    const promocao = cena.elemento('[aria-label="Promover a versão indisponível"]');
    expect(promocao.getAttribute('tabindex')).toBe('0');
    expect(promocao.getAttribute('aria-describedby')).toBe(
      'cfg-termo-consentimento-motivo-promocao',
    );
    expect(cena.elemento('#cfg-termo-consentimento-motivo-remocao').textContent).toContain(
      'Termo com versão promovida',
    );
    for (const nome of ['Marcar como revisado', 'Promover a versão', 'Remover']) {
      expect(cena.botao(nome).matches(':disabled')).toBe(true);
    }
  });

  it('libera revisar e remover num termo com texto e base legal e sem versão', async () => {
    cena = await montarDetalhe(ID);
    expect(cena.botao('Marcar como revisado').matches(':disabled')).toBe(false);
    expect(cena.botao('Remover').matches(':disabled')).toBe(false);
    expect(cena.botao('Promover a versão').matches(':disabled')).toBe(true);
    expect(
      cena.fixture.nativeElement.querySelector('[aria-label="Remover termo indisponível"]'),
    ).toBeNull();
    expect(
      cena.fixture.nativeElement.querySelector('[aria-label="Marcar como revisado indisponível"]'),
    ).toBeNull();
  });

  it('descreve a tabela de versões e mostra a promoção no fuso institucional', async () => {
    cena = await montarDetalhe(
      ID,
      termo({
        versoes: [versao({ promovidaEm: '2018-12-01T02:30:00Z', hash: 'abcdef0123456789' })],
      }),
    );
    expect(cena.elemento('table > caption').textContent?.trim()).toBe(
      'Versões promovidas deste termo de consentimento',
    );
    expect(cena.elemento('td[data-label="Promovida em"]').textContent?.trim()).toBe(
      '30/11/2018, 23:30',
    );
    expect(cena.elemento('td[data-label="Hash"] code').textContent).toBe('abcdef012345…');
  });
});

describe('TermosConsentimentoDetailPage — ações sobre o termo', () => {
  it('salva o rascunho com a chave de idempotência, avisa e relê o termo', async () => {
    cena = await montarDetalhe(ID);
    cena.edicao.rascunhoForm.controls.texto.setValue(' Texto revisado ');
    cena.botao('Salvar rascunho').click();
    const envio = cena.controller.expectOne(RASCUNHO);
    expect(envio.request.method).toBe('PUT');
    expect(envio.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(envio.request.body).toMatchObject({
      textoRascunho: 'Texto revisado',
      formaAceiteRascunho: 'A_DEFINIR',
    });
    envio.flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo({ textoRascunho: 'Texto revisado' }));
    await cena.propagar();
    expect(cena.avisos()).toEqual(['Rascunho salvo']);
    expect(cena.edicao.rascunhoForm.pristine).toBe(true);
  });

  it('marca como revisado e anuncia o aviso de revisão', async () => {
    cena = await montarDetalhe(ID);
    cena.botao('Marcar como revisado').click();
    cena.controller.expectOne(REVISAR).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(REVISADO);
    await cena.propagar();
    expect(cena.avisos()).toEqual(['Termo marcado como revisado']);
    expect(cena.fixture.nativeElement.textContent).toContain('Revisado em');
  });

  it('promover devolve o foco ao título quando o botão fica indisponível', async () => {
    cena = await montarDetalhe(ID, REVISADO);
    const promover = cena.botao('Promover a versão');
    promover.focus();
    promover.click();
    cena.controller.expectOne(PROMOVER).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo({ versoes: [versao()] }));
    await cena.propagar();
    await cena.propagar();
    expect(cena.avisos()).toEqual(['Nova versão promovida']);
    expect(cena.botao('Promover a versão').matches(':disabled')).toBe(true);
    expect(document.activeElement).toBe(cena.titulo());
  });

  it('revisar mantém o foco no botão depois da releitura', async () => {
    cena = await montarDetalhe(ID);
    const revisar = cena.botao('Marcar como revisado');
    revisar.focus();
    revisar.click();
    cena.controller.expectOne(REVISAR).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(REVISADO);
    await cena.propagar();
    await cena.propagar();
    expect(document.activeElement).toBe(cena.botao('Marcar como revisado'));
  });

  it('releitura que falha após a ação mostra o erro com "Tentar novamente" e leva o foco ao título', async () => {
    cena = await montarDetalhe(ID);
    const revisar = cena.botao('Marcar como revisado');
    revisar.focus();
    revisar.click();
    cena.controller.expectOne(REVISAR).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    recusar(cena.controller.expectOne(LEITURA), 500, CODIGOS.erroInterno, 'Erro interno');
    await cena.propagar();
    await cena.propagar();
    expect(cena.fixture.nativeElement.querySelector('form')).toBeNull();
    expect(cena.botao('Tentar novamente').getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(cena.titulo());
    expect(cena.avisos()).toEqual(['Termo marcado como revisado', 'Erro interno']);
  });

  it('remove o termo sem versão, avisa e volta à lista', async () => {
    cena = await montarDetalhe(ID);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    cena.botao('Remover').click();
    await cena.propagar();
    cena.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    cena.controller.expectOne(REMOVER).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    expect(cena.avisos()).toEqual(['Termo removido']);
    expect(navegar).toHaveBeenCalledWith(['/termos-consentimento']);
    expect(cena.elemento<HTMLDialogElement>('dialog').open).toBe(false);
  });

  it('cancelar a remoção fecha o diálogo e devolve o foco ao botão da página', async () => {
    cena = await montarDetalhe(ID);
    const remover = cena.botao('Remover');
    remover.focus();
    remover.click();
    await cena.propagar();
    expect(cena.elemento<HTMLDialogElement>('dialog').open).toBe(true);
    cena.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]').click();
    await cena.propagar();
    expect(cena.elemento<HTMLDialogElement>('dialog').open).toBe(false);
    expect(document.activeElement).toBe(remover);
    cena.controller.expectNone(REMOVER);
  });
});

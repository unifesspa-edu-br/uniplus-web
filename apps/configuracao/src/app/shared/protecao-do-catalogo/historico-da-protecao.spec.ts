import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, type AtoDaProtecaoDto } from '@uniplus/shared-data/configuracao';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoricoDaProtecaoComponent } from './historico-da-protecao';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000d2';
const ADMIN = `${BASE}/api/configuracao/admin`;

const ato = (extra: Partial<AtoDaProtecaoDto>): AtoDaProtecaoDto => ({
  ato: 'SOLICITACAO',
  instante: '2026-10-30T15:00:00Z',
  atorNome: 'Isabella Moura',
  classificacaoProtecao: 'INTERNO',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Conferir o laudo do candidato.',
  classificacaoRecomendada: null,
  justificativa: null,
  ...extra,
});

describe('HistoricoDaProtecaoComponent', () => {
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  function montar(
    cadastro: 'TIPO_DOCUMENTO' | 'FATO',
  ): ComponentFixture<HistoricoDaProtecaoComponent> {
    const fixture = TestBed.createComponent(HistoricoDaProtecaoComponent);
    fixture.componentRef.setInput('cadastro', cadastro);
    fixture.componentRef.setInput('itemId', ID);
    fixture.detectChanges();
    return fixture;
  }

  const texto = (fixture: ComponentFixture<unknown>): string =>
    (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

  it('lê os atos do tipo de documento ao abrir e os mostra em ordem, com quem agiu e a justificativa', async () => {
    const fixture = montar('TIPO_DOCUMENTO');
    const req = controller.expectOne(`${ADMIN}/tipos-documento/${ID}/protecao/atos`);
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('protecao-do-catalogo-ato', 1),
    );
    req.flush([
      ato({}),
      ato({
        ato: 'AJUSTE_RECOMENDADO',
        instante: '2026-10-31T13:00:00Z',
        atorNome: 'Caroline Ribeiro',
        classificacaoRecomendada: 'PESSOAL',
        justificativa: 'O laudo identifica o candidato.',
      }),
      ato({ ato: 'ACEITE', instante: '2026-11-01T14:00:00Z' }),
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const itens = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.cfg-atos__item'),
    ).map((item) => item.textContent?.replace(/\s+/g, ' ').trim());
    expect(itens).toHaveLength(3);
    expect(itens[0]).toContain('Solicitação');
    expect(itens[0]).toContain('30/10/2026');
    expect(itens[0]).toContain('Isabella Moura');
    expect(itens[1]).toContain('Ajuste recomendado');
    expect(itens[1]).toContain('Caroline Ribeiro');
    expect(itens[1]).toContain('Classificação recomendada: Pessoal');
    expect(itens[1]).toContain('Justificativa: O laudo identifica o candidato.');
    expect(itens[2]).toContain('Aceite da recomendação');
  });

  it('lê os atos do fato na rota do fato', async () => {
    const fixture = montar('FATO');
    controller
      .expectOne(`${ADMIN}/fatos-candidato/${ID}/protecao/atos`)
      .flush([ato({ ato: 'REPROVACAO' })]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Reprovação');
  });

  it('sem atos diz que o item ainda não passou pela proteção de dados', async () => {
    const fixture = montar('FATO');
    controller.expectOne(`${ADMIN}/fatos-candidato/${ID}/protecao/atos`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Este item ainda não passou pela proteção de dados.');
  });

  const resposta = (status: number, title: string) =>
    [
      { type: 'about:blank', title, status, code: 'uniplus.x' },
      {
        status,
        statusText: 'Erro',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    ] as const;
  const FALHA = resposta(503, 'Servidor indisponível');
  const RECUSA = resposta(403, 'Sem permissão');

  it('na falha do servidor mostra o motivo, mantém o alerta durante a nova tentativa e leva o foco ao título quando dá certo', async () => {
    const fixture = montar('TIPO_DOCUMENTO');
    controller.expectOne(`${ADMIN}/tipos-documento/${ID}/protecao/atos`).flush(...FALHA);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Não foi possível carregar o histórico');
    expect(texto(fixture)).toContain('Servidor indisponível');

    const raiz = fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector<HTMLButtonElement>('button.btn--secondary');
    botao?.focus();
    botao?.click();
    fixture.detectChanges();
    expect(botao?.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(botao);
    controller.expectOne(`${ADMIN}/tipos-documento/${ID}/protecao/atos`).flush([ato({})]);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(texto(fixture)).toContain('Solicitação');
    expect(document.activeElement).toBe(raiz.querySelector('h3'));
  });

  it('a recusa por falta de permissão mostra o motivo sem oferecer nova tentativa', async () => {
    const fixture = montar('TIPO_DOCUMENTO');
    controller.expectOne(`${ADMIN}/tipos-documento/${ID}/protecao/atos`).flush(...RECUSA);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Acesso negado');
    expect(texto(fixture)).toContain('Sem permissão');
    expect(texto(fixture)).not.toContain('Tentar novamente');
  });

  it('o histórico que deixou de existir mostra a recusa pelo desfecho e a nova tentativa que termina nela não anuncia leitura concluída', async () => {
    const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');
    const fixture = montar('TIPO_DOCUMENTO');
    controller.expectOne(`${ADMIN}/tipos-documento/${ID}/protecao/atos`).flush(...FALHA);
    await fixture.whenStable();
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    raiz.querySelector<HTMLButtonElement>('button.btn--secondary')?.click();
    fixture.detectChanges();
    (document.activeElement as HTMLElement | null)?.blur();

    controller
      .expectOne(`${ADMIN}/tipos-documento/${ID}/protecao/atos`)
      .flush(...resposta(404, 'Item não encontrado'));
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(texto(fixture)).toContain('Histórico não encontrado');
    expect(texto(fixture)).toContain('Feche o painel e confira a lista.');
    expect(texto(fixture)).not.toContain('Tentar novamente');
    expect(anunciar).not.toHaveBeenCalled();
  });
});

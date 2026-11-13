import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProvidenciaDetalhePage } from './providencia-detalhe.page';
import {
  ADMINISTRAR,
  ID,
  ROTA,
  assentar,
  botao,
  digitar,
  montar,
  notificacoes,
  problema,
  providencia,
  type Montagem,
} from './providencias.testing';

const ID_B = '01960000-0000-7000-0000-0000000000e2';
const DETALHE_A = `${ROTA}/${ID}`;
const DETALHE_B = `${ROTA}/${ID_B}`;

describe('ProvidenciaDetalhePage — o diálogo preso à providência em que abriu', () => {
  let tela: Montagem<ProvidenciaDetalhePage>;

  beforeEach(async () => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    tela = montar(ProvidenciaDetalhePage, [ADMINISTRAR]);
    await irPara(ID, DETALHE_A);
  });

  afterEach(() => {
    tela.http.verify();
    document.body.innerHTML = '';
  });

  async function irPara(id: string, url: string): Promise<void> {
    tela.fixture.componentRef.setInput('id', id);
    tela.fixture.detectChanges();
    tela.http.expectOne(url).flush(providencia({ id }));
    await assentar();
  }

  const dialogoDaResposta = () =>
    document.querySelector('cfg-motivo-dialog dialog') as HTMLDialogElement;
  const textoDaResposta = () =>
    document.querySelector('cfg-motivo-dialog textarea') as HTMLTextAreaElement;

  async function escreverResposta(motivo: string): Promise<void> {
    botao('Responder')?.click();
    await assentar();
    digitar(textoDaResposta(), motivo);
    await assentar();
  }

  it('de A para B para A, o diálogo de A fecha e o motivo de A não vai para nenhum envio', async () => {
    await escreverResposta('Motivo escrito para A.');

    await irPara(ID_B, DETALHE_B);
    expect(dialogoDaResposta().hasAttribute('open')).toBe(false);

    await irPara(ID, DETALHE_A);
    botao('Responder')?.click();
    await assentar();
    expect(textoDaResposta().value).toBe('');
    digitar(textoDaResposta(), 'Motivo novo para A.');
    await assentar();
    botao('Registrar resposta')?.click();
    await assentar();

    const envio = tela.http.expectOne(`${DETALHE_A}/resposta`);
    expect(envio.request.body).toEqual({ motivo: 'Motivo novo para A.' });
    tela.http.expectNone(`${DETALHE_B}/resposta`);
    envio.flush(providencia({ situacao: 'respondida' }));
    await assentar();
    tela.http.expectOne(DETALHE_A).flush(providencia({ situacao: 'respondida' }));
    await assentar();
  });

  it('a resposta de A que chega já em B não fecha, não avisa nem relê nada em B', async () => {
    await escreverResposta('Motivo escrito para A.');
    botao('Registrar resposta')?.click();
    await assentar();
    const envioDeA = tela.http.expectOne(`${DETALHE_A}/resposta`);

    await irPara(ID_B, DETALHE_B);
    envioDeA.flush(providencia({ situacao: 'respondida' }));
    await assentar();

    expect(notificacoes.success).not.toHaveBeenCalled();
    tela.http.expectNone(DETALHE_B);
    tela.http.expectNone(DETALHE_A);
  });

  it('a recusa ja_respondida fecha o diálogo e deixa a mensagem na página', async () => {
    await escreverResposta('Segue na banca.');
    botao('Registrar resposta')?.click();
    await assentar();

    tela.http
      .expectOne(`${DETALHE_A}/resposta`)
      .flush(...problema(409, 'uniplus.autorizacao.providencia.ja_respondida'));
    await assentar();
    tela.http.expectOne(DETALHE_A).flush(providencia({ situacao: 'respondida' }));
    await assentar();

    expect(dialogoDaResposta().hasAttribute('open')).toBe(false);
    expect(tela.host.querySelector('ui-alert')?.textContent).toContain(
      'A providência já foi respondida.',
    );
    expect(botao('Responder')).toBeUndefined();
  });

  it('sair da página com a resposta pendente: nada avisa nem relê depois', async () => {
    await escreverResposta('Motivo escrito para A.');
    botao('Registrar resposta')?.click();
    await assentar();
    const envio = tela.http.expectOne(`${DETALHE_A}/resposta`);

    tela.fixture.destroy();
    envio.flush(providencia({ situacao: 'respondida' }));
    await new Promise((resolver) => setTimeout(resolver));

    expect(notificacoes.success).not.toHaveBeenCalled();
    tela.http.expectNone(DETALHE_A);
  });
});

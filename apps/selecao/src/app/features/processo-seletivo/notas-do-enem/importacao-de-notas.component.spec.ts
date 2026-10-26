import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { LoteDeNotasDoEnemDto } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NotasDoEnemPage } from './notas-do-enem.page';
import {
  ROTA_EDICAO,
  abrirTela,
  escolherEdicao,
  providersDaTela,
  tick,
  trocarEdicao,
  type TelaAberta,
} from './notas-do-enem.testing';

const ROTA_LOTES = `${ROTA_EDICAO}/lotes-de-notas`;
const ID_DO_LOTE = '01960000-0000-7000-0000-0000000005dd';

function lote(sobrescritas: Partial<LoteDeNotasDoEnemDto> = {}): LoteDeNotasDoEnemDto {
  return {
    id: ID_DO_LOTE,
    edicao: '2025',
    leiauteCodigo: 'RETORNO_20',
    leiauteVersao: '1',
    leiauteHash: 'h'.repeat(64),
    arquivoHash: 'a'.repeat(64),
    importadoPor: 'usuario-opaco',
    importadoPorNome: 'Diogo Bruno Filipe Souza',
    importadoEm: '2026-10-26T12:00:00Z',
    totalDeLinhas: '5',
    totalDeInscritosComNota: '2',
    totalDeLancamentos: '10',
    totalDeInscritosSemLinha: '1',
    totalDeLinhasSemInscrito: '1',
    totalDeInscritosEmConflito: '0',
    totalDeInscritosAusentes: '0',
    vigente: true,
    ausentes: null,
    ocorrencias: [
      {
        tipo: 'INSCRITO_SEM_LINHA',
        inscricaoId: null,
        numeroDeInscricao: 'INS-0003',
        numerosDasLinhas: null,
        nomeDoCandidato: null,
        cpfMascarado: null,
        sexo: null,
        opcoesDeCurso: null,
      },
      {
        tipo: 'LINHA_SEM_INSCRITO',
        inscricaoId: null,
        numeroDeInscricao: null,
        numerosDasLinhas: ['14'],
        nomeDoCandidato: null,
        cpfMascarado: null,
        sexo: null,
        opcoesDeCurso: null,
      },
    ],
    ...sobrescritas,
  };
}

describe('ImportacaoDeNotasComponent', () => {
  let controller: HttpTestingController;
  let tela: TelaAberta;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NotasDoEnemPage], providers: providersDaTela() });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  const secao = (): HTMLElement => {
    const el = tela.host.querySelector<HTMLElement>('sel-importacao-de-notas');
    if (el === null) throw new Error('A seção de importação não foi renderizada.');
    return el;
  };
  const botao = (): HTMLButtonElement => {
    const el = Array.from(secao().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Importar notas' || b.textContent?.trim() === 'Importando…',
    );
    if (el === undefined) throw new Error('O botão de importação não foi renderizado.');
    return el;
  };
  const leiaute = (): HTMLSelectElement => {
    const el = secao().querySelector<HTMLSelectElement>('#notas-leiaute-retorno');
    if (el === null) throw new Error('O seletor de leiaute não foi renderizado.');
    return el;
  };

  function escolherLeiaute(valor: string): void {
    const select = leiaute();
    select.value = valor;
    select.dispatchEvent(new Event('change'));
  }

  function escolherArquivo(nome = 'retorno.txt'): void {
    const input = secao().querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('O campo de arquivo não foi renderizado.');
    const arquivo = new File(['conteúdo sintético'], nome, { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [arquivo], configurable: true });
    input.dispatchEvent(new Event('change'));
    tela.fixture.detectChanges();
  }

  async function prepararPedido(): Promise<void> {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'retorno');
    escolherLeiaute('RETORNO_20|v1');
    escolherArquivo();
  }

  async function responderLotes(): Promise<void> {
    await tick();
    controller.expectOne(ROTA_LOTES).flush([]);
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();
  }

  function problema(status: number, code: string, detail?: string): [string, object] {
    return [
      JSON.stringify({
        type: 'about:blank',
        title: 'Recusa',
        status,
        code,
        detail,
        traceId: 't-1',
      }),
      {
        status,
        statusText: 'Recusa',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    ];
  }

  it('monta as opções do catálogo de retorno sem escolher nenhuma', async () => {
    tela = await abrirTela(controller);

    expect(Array.from(leiaute().options).map((o) => o.text.trim())).toEqual([
      'Selecione o leiaute',
      'Retorno do INEP com 20 campos (v1)',
      'Retorno do INEP com 21 campos (v1)',
    ]);
    expect(leiaute().value).toBe('');
  });

  it('sem edição, o botão fica desabilitado e descrito pelo motivo, e nada é enviado', async () => {
    tela = await abrirTela(controller);

    expect(botao().disabled).toBe(true);
    expect(secao().querySelector('#notas-importacao-ajuda')?.textContent).toContain(
      'Escolha a edição do ENEM',
    );
    botao().click();
    controller.expectNone((r) => r.method === 'POST');
  });

  it('com a edição escolhida, sem leiaute e arquivo não envia nada e aponta cada falta', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'retorno');

    botao().click();
    tela.fixture.detectChanges();

    controller.expectNone((r) => r.method === 'POST');
    expect(secao().textContent).toContain('Escolha o leiaute do arquivo de retorno.');
    expect(secao().textContent).toContain('Escolha o arquivo de retorno do INEP.');
    expect(document.activeElement).toBe(leiaute());
  });

  it('importa o formulário multipart, mostra o resultado em abas por tipo de ocorrência, a linha sem inscrito só com o número, e limpa o arquivo', async () => {
    await prepararPedido();

    botao().click();
    botao().click();
    tela.fixture.detectChanges();
    expect(botao().getAttribute('aria-busy')).toBe('true');

    const req = controller.expectOne(ROTA_LOTES);
    const corpo = req.request.body as FormData;
    expect((corpo.get('arquivo') as File).name).toBe('retorno.txt');
    expect(corpo.get('leiauteCodigo')).toBe('RETORNO_20');
    expect(corpo.get('leiauteVersao')).toBe('v1');
    req.flush(lote(), { status: 201, statusText: 'Created' });
    await responderLotes();
    await tick();

    const texto = secao().textContent ?? '';
    expect(texto).toContain(
      'Lote importado: 2 inscritos com nota, 1 sem nota, 1 linha sem inscrito.',
    );
    const abas = Array.from(secao().querySelectorAll('[role="tab"]')).map((a) =>
      (a.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(abas).toEqual(['Sem nota 1', 'Linhas sem inscrito 1']);
    expect(texto).toContain('INS-0003');
    secao().querySelectorAll<HTMLElement>('[role="tab"]')[1].click();
    tela.fixture.detectChanges();
    const linha = secao().querySelector('[role="tabpanel"] tbody tr');
    expect(linha?.querySelector('th')?.textContent?.trim()).toBe('14');
    const resultado = secao().querySelector('[aria-labelledby="notas-resultado-titulo"]');
    expect(resultado?.querySelector('sel-origem-do-lote')?.textContent).toMatch(/Leiaute\s+1\s+·/);
    expect(secao().querySelector('.uni-uploader__item')).toBeNull();
    expect(document.activeElement?.id).toBe('notas-resultado-titulo');
  });

  it('na primeira importação da edição não diz que substitui um lote anterior', async () => {
    await prepararPedido();

    botao().click();
    controller.expectOne(ROTA_LOTES).flush(lote(), { status: 201, statusText: 'Created' });
    await responderLotes();

    const texto = secao().textContent ?? '';
    expect(texto).toContain('passam a ser as notas vigentes desta edição');
    expect(texto).not.toContain('lote anterior');
  });

  it('com lote anterior na edição diz que as notas passam a valer no lugar das dele', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'retorno', '2025', [lote({ id: 'anterior' })]);
    escolherLeiaute('RETORNO_20|v1');
    escolherArquivo();

    botao().click();
    controller.expectOne(ROTA_LOTES).flush(lote(), { status: 201, statusText: 'Created' });
    await tick();
    controller.expectOne(ROTA_LOTES).flush([lote()]);
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();

    expect(secao().textContent).toContain('no lugar das do lote anterior desta edição');
  });

  it('o arquivo que já é o do lote vigente volta com 200 e diz que nada mudou', async () => {
    await prepararPedido();

    botao().click();
    controller.expectOne(ROTA_LOTES).flush(lote(), { status: 200, statusText: 'OK' });
    await responderLotes();

    expect(secao().textContent).toContain('Este arquivo já é o do lote vigente. Nada mudou.');
  });

  it('arquivo fora do leiaute diz que nada foi gravado, manda conferir o leiaute e foca o alerta', async () => {
    await prepararPedido();

    botao().click();
    const [corpo, opcoes] = problema(
      422,
      'uniplus.selecao.notas_do_enem.arquivo_fora_do_leiaute',
      'Linha 3, coluna 21.',
    );
    controller.expectOne(ROTA_LOTES).flush(corpo, opcoes);
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();
    await tick();

    const alerta = secao().querySelector<HTMLElement>('[role="alert"]');
    expect(alerta?.textContent).toContain('nenhuma nota foi gravada');
    expect(alerta?.textContent).toContain('Confira se o leiaute selecionado');
    expect(alerta?.textContent).toContain('Linha 3, coluna 21.');
    expect(document.activeElement).toBe(alerta);
    expect(secao().querySelector('.uni-uploader__item')).not.toBeNull();
  });

  it('falha de servidor não afirma que nada foi gravado e relê o histórico que manda conferir', async () => {
    await prepararPedido();

    botao().click();
    controller
      .expectOne(ROTA_LOTES)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await tick();
    controller.expectOne((r) => r.method === 'GET' && r.url === ROTA_LOTES).flush([lote()]);
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();

    const alerta = secao().querySelector<HTMLElement>('[role="alert"]');
    expect(alerta?.textContent).not.toContain('nenhuma nota foi gravada');
    expect(alerta?.textContent).toContain('Confira o histórico de lotes');
    expect(tela.host.textContent).toContain('Ver ocorrências');
  });

  it('"Ver ocorrências" lê o lote do histórico e mostra as ocorrências dele', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'retorno', '2025', [lote({ ocorrencias: null })]);

    const ver = Array.from(tela.host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Ver ocorrências',
    );
    ver?.click();
    controller.expectOne(`${ROTA_LOTES}/${ID_DO_LOTE}`).flush(lote());
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();
    await tick();

    expect(tela.host.textContent).toMatch(/Linhas sem inscrito\s*1/);
    expect(document.activeElement?.id).toBe('notas-detalhe-titulo');
  });

  it('"Ocultar ocorrências" fecha o detalhe e devolve o foco ao "Ver ocorrências" do lote', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'retorno', '2025', [lote({ ocorrencias: null })]);
    const ver = (): HTMLButtonElement | undefined =>
      Array.from(tela.host.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Ver ocorrências',
      );
    ver()?.click();
    controller.expectOne(`${ROTA_LOTES}/${ID_DO_LOTE}`).flush(lote());
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();

    Array.from(tela.host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Ocultar ocorrências')
      ?.click();
    tela.fixture.detectChanges();
    await tela.fixture.whenStable();

    expect(tela.host.querySelector('#notas-detalhe-titulo')).toBeNull();
    expect(document.activeElement).toBe(ver());
  });

  it('o lote aberto em "Ver ocorrências" fecha quando o histórico é relido depois de uma importação', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'retorno', '2025', [lote({ ocorrencias: null })]);
    escolherLeiaute('RETORNO_20|v1');
    escolherArquivo();
    const ver = Array.from(tela.host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Ver ocorrências',
    );
    ver?.click();
    controller.expectOne(`${ROTA_LOTES}/${ID_DO_LOTE}`).flush(lote());
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();
    expect(tela.host.querySelector('#notas-detalhe-titulo')).not.toBeNull();

    botao().click();
    controller.expectOne(ROTA_LOTES).flush(lote(), { status: 201, statusText: 'Created' });
    await responderLotes();

    expect(tela.host.querySelector('#notas-detalhe-titulo')).toBeNull();
  });

  it('o resultado e a recusa de uma edição somem ao trocar de edição', async () => {
    await prepararPedido();
    botao().click();
    controller.expectOne(ROTA_LOTES).flush(lote(), { status: 201, statusText: 'Created' });
    await responderLotes();
    expect(secao().textContent).toContain('Resultado da importação');

    await trocarEdicao(controller, tela, 'retorno', '2024');

    expect(secao().textContent).not.toContain('Resultado da importação');
  });

  it('a recusa de uma edição some ao trocar de edição', async () => {
    await prepararPedido();
    botao().click();
    const [corpo, opcoes] = problema(422, 'uniplus.selecao.notas_do_enem.arquivo_vazio');
    controller.expectOne(ROTA_LOTES).flush(corpo, opcoes);
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();
    expect(secao().querySelector('[role="alert"]')).not.toBeNull();

    await trocarEdicao(controller, tela, 'retorno', '2024');

    expect(secao().querySelector('[role="alert"]')).toBeNull();
  });

  it('a resposta que chega depois da troca de edição não é aplicada à nova', async () => {
    await prepararPedido();
    botao().click();
    const pedido = controller.expectOne(ROTA_LOTES);

    await trocarEdicao(controller, tela, 'retorno', '2024');
    pedido.flush(lote(), { status: 201, statusText: 'Created' });
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();

    expect(secao().textContent).not.toContain('Resultado da importação');
  });

  it('o erro do leiaute some ao escolher um leiaute válido', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'retorno');
    botao().click();
    tela.fixture.detectChanges();
    expect(leiaute().getAttribute('aria-invalid')).toBe('true');

    escolherLeiaute('RETORNO_20|v1');
    tela.fixture.detectChanges();

    expect(leiaute().getAttribute('aria-invalid')).toBeNull();
  });

  it('o histórico mostra quem importou o lote e, sem o nome, diz que não foi registrado', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'retorno', '2025', [
      lote({ ocorrencias: null }),
      lote({ id: 'anterior', vigente: false, importadoPorNome: null, ocorrencias: null }),
    ]);

    const linhas = Array.from(secao().querySelectorAll('sel-historico-de-lotes tbody tr')).map(
      (tr) => (tr.querySelector('td')?.textContent ?? '').replace(/\s+/g, ' '),
    );
    expect(linhas[0]).toContain('por Diogo Bruno Filipe Souza');
    expect(linhas[1]).toContain('Não registrado');
    expect(linhas[1]).not.toContain('por ');
  });
});

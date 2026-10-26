import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotasDoEnemPage } from './notas-do-enem.page';
import {
  ROTA_EDICAO,
  abrirTela,
  escolherEdicao,
  leiaute as leiauteDoCatalogo,
  processo,
  providersDaTela,
  tick,
  trocarEdicao,
  type TelaAberta,
} from './notas-do-enem.testing';

/** Os CPFs de duas personas do portal (fernanda.drumond e kevin.carvalho), sem pontuação. */
const ARQUIVO_DE_ENVIO = '69959836371\n33257350376\n';

function textoDe(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsText(blob);
  });
}

const DOIS_LEIAUTES = [
  leiauteDoCatalogo('ENVIO_CPF', 'envio'),
  leiauteDoCatalogo('ENVIO_CPF_COM_NOME', 'envio'),
];

describe('EnvioAoInepComponent', () => {
  let controller: HttpTestingController;
  let tela: TelaAberta;
  let blobsSalvos: Blob[];
  let nomesSalvos: string[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NotasDoEnemPage], providers: providersDaTela() });
    controller = TestBed.inject(HttpTestingController);

    blobsSalvos = [];
    nomesSalvos = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobsSalvos.push(blob);
      return 'blob:envio';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      nomesSalvos.push(this.download);
    });
  });

  afterEach(() => {
    controller.verify();
    vi.restoreAllMocks();
  });

  const secao = (): HTMLElement => {
    const el = tela.host.querySelector<HTMLElement>('sel-envio-ao-inep');
    if (el === null) throw new Error('A seção de envio não foi renderizada.');
    return el;
  };
  const botao = (): HTMLButtonElement => {
    const el = Array.from(secao().querySelectorAll('button')).find((b) =>
      /arquivo/.test(b.textContent ?? ''),
    );
    if (el === undefined) throw new Error('O botão de envio não foi renderizado.');
    return el;
  };
  const leiaute = (): HTMLSelectElement => {
    const el = secao().querySelector<HTMLSelectElement>('#notas-leiaute-envio');
    if (el === null) throw new Error('O seletor de leiaute não foi renderizado.');
    return el;
  };
  const escolherLeiaute = (valor: string): void => {
    const select = leiaute();
    select.value = valor;
    select.dispatchEvent(new Event('change'));
  };

  it('com um único leiaute, não há campo para escolher e as orientações o apresentam como texto', async () => {
    tela = await abrirTela(controller);

    expect(secao().querySelector('select#notas-leiaute-envio')).toBeNull();
    const orientacoes = secao().querySelector('sel-orientacoes-do-enem')?.textContent ?? '';
    expect(orientacoes).toContain('Leiaute de envio');
    expect(orientacoes).toContain('ENVIO_CPF v1');
    expect(orientacoes).toContain('Leiaute ENVIO_CPF');
    expect(orientacoes).not.toContain('vv1');
  });

  it('com dois ou mais leiautes, monta as opções do catálogo sem escolher nenhuma', async () => {
    tela = await abrirTela(controller, undefined, { envio: DOIS_LEIAUTES });

    expect(Array.from(leiaute().options).map((o) => o.text.trim())).toEqual([
      'Selecione o leiaute',
      'Leiaute ENVIO_CPF (v1)',
      'Leiaute ENVIO_CPF_COM_NOME (v1)',
    ]);
    expect(leiaute().value).toBe('');
  });

  it('sem edição, o botão fica desabilitado e descrito pelo motivo, e nada é enviado', async () => {
    tela = await abrirTela(controller);

    expect(botao().disabled).toBe(true);
    const motivo = secao().querySelector<HTMLElement>(
      `#${botao().getAttribute('aria-describedby')}`,
    );
    expect(motivo?.textContent).toContain('Escolha a edição do ENEM');
    botao().click();
    controller.expectNone((r) => r.method === 'POST');
  });

  it('com a edição escolhida e sem leiaute, não envia e leva o foco ao leiaute', async () => {
    tela = await abrirTela(controller, undefined, { envio: DOIS_LEIAUTES });
    await escolherEdicao(controller, tela, 'envio');

    botao().click();
    tela.fixture.detectChanges();

    controller.expectNone((r) => r.method === 'POST');
    expect(secao().textContent).toContain('Escolha o leiaute do arquivo de envio.');
    expect(document.activeElement).toBe(leiaute());
  });

  it('gera uma vez só apesar do duplo clique, salva o arquivo pelo nome da edição e não o guarda na tela', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'envio');

    botao().click();
    botao().click();
    tela.fixture.detectChanges();
    expect(botao().getAttribute('aria-busy')).toBe('true');

    const req = controller.expectOne(`${ROTA_EDICAO}/envios-ao-inep`);
    expect(req.request.body).toEqual({ leiauteCodigo: 'ENVIO_CPF', leiauteVersao: 'v1' });
    req.flush(ARQUIVO_DE_ENVIO, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    await tick();
    controller.expectOne(`${ROTA_EDICAO}/envios-ao-inep`).flush([]);
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();

    expect(nomesSalvos).toEqual(['notas-do-enem-envio-2025.txt']);
    expect(await textoDe(blobsSalvos[0])).toBe(ARQUIVO_DE_ENVIO);
    expect(tela.host.textContent).toContain(
      'Arquivo de envio gerado com 2 CPFs. Verifique a pasta de downloads.',
    );
    expect(tela.host.textContent).not.toContain('69959836371');
    expect(botao().getAttribute('aria-busy')).toBeNull();
  });

  it('falha de servidor manda conferir o histórico e o relê, porque a geração pode ter sido registrada', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'envio');

    botao().click();
    controller
      .expectOne((r) => r.method === 'POST' && r.url === `${ROTA_EDICAO}/envios-ao-inep`)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await tick();
    controller
      .expectOne((r) => r.method === 'GET' && r.url === `${ROTA_EDICAO}/envios-ao-inep`)
      .flush([]);
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();

    expect(secao().querySelector('[role="alert"]')?.textContent).toContain(
      'Confira-o antes de gerar outro arquivo',
    );
  });

  it('edição sem inscritos chega como aviso orientador e foca o alerta', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'envio');

    botao().click();
    controller.expectOne(`${ROTA_EDICAO}/envios-ao-inep`).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Edição sem inscritos',
        status: 422,
        code: 'uniplus.selecao.notas_do_enem.edicao_sem_inscritos',
        traceId: 't-1',
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();
    await tick();

    const alerta = secao().querySelector<HTMLElement>('[role="alert"]');
    expect(alerta?.classList.contains('alert--warning')).toBe(true);
    expect(alerta?.textContent).toContain(
      'Gere o arquivo depois que os candidatos enviarem as inscrições.',
    );
    expect(document.activeElement).toBe(alerta);
    expect(nomesSalvos).toEqual([]);
  });

  const recusaSemInscritos = (): [string, object] => [
    JSON.stringify({
      type: 'about:blank',
      title: 'Edição sem inscritos',
      status: 422,
      code: 'uniplus.selecao.notas_do_enem.edicao_sem_inscritos',
      traceId: 't-1',
    }),
    {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'Content-Type': 'application/problem+json' },
    },
  ];

  it('a recusa de uma edição some ao trocar de edição', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'envio');
    botao().click();
    const [corpo, opcoes] = recusaSemInscritos();
    controller.expectOne(`${ROTA_EDICAO}/envios-ao-inep`).flush(corpo, opcoes);
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();
    expect(secao().querySelector('[role="alert"]')).not.toBeNull();

    await trocarEdicao(controller, tela, 'envio', '2024');
    await tick();
    tela.fixture.detectChanges();

    expect(secao().querySelector('[role="alert"]')).toBeNull();
  });

  it('a resposta que chega depois da troca de edição não é aplicada à nova', async () => {
    tela = await abrirTela(controller);
    await escolherEdicao(controller, tela, 'envio');
    botao().click();
    const pedido = controller.expectOne(`${ROTA_EDICAO}/envios-ao-inep`);

    await trocarEdicao(controller, tela, 'envio', '2024');
    const [corpo, opcoes] = recusaSemInscritos();
    pedido.flush(corpo, opcoes);
    await tela.fixture.whenStable();
    tela.fixture.detectChanges();

    expect(secao().querySelector('[role="alert"]')).toBeNull();
  });

  it('o erro do leiaute some ao escolher um leiaute válido', async () => {
    tela = await abrirTela(controller, undefined, { envio: DOIS_LEIAUTES });
    await escolherEdicao(controller, tela, 'envio');
    botao().click();
    tela.fixture.detectChanges();
    expect(leiaute().getAttribute('aria-invalid')).toBe('true');

    escolherLeiaute('ENVIO_CPF|v1');
    tela.fixture.detectChanges();

    expect(leiaute().getAttribute('aria-invalid')).toBeNull();
    expect(secao().textContent).not.toContain('Escolha o leiaute do arquivo de envio.');
  });

  it('o nome do arquivo leva o identificador legível do processo e, sem ele, o nome genérico', async () => {
    tela = await abrirTela(controller, processo({ identificadorLegivel: 'medicina-2027' }));
    await escolherEdicao(controller, tela, 'envio');

    botao().click();
    controller
      .expectOne(`${ROTA_EDICAO}/envios-ao-inep`)
      .flush(ARQUIVO_DE_ENVIO, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    await tick();
    controller.expectOne(`${ROTA_EDICAO}/envios-ao-inep`).flush([]);

    expect(nomesSalvos).toEqual(['medicina-2027-envio-2025.txt']);
  });

  it('o histórico mostra quem gerou o envio e, sem o nome, diz que não foi registrado', async () => {
    tela = await abrirTela(controller);
    const envio = {
      id: '01960000-0000-7000-0000-0000000005ee',
      edicao: '2025',
      leiauteCodigo: 'ENVIO_CPF',
      leiauteVersao: 'v1',
      geradoPor: 'usuario-opaco',
      geradoEm: '2026-10-26T12:00:00Z',
      totalDeCpfs: '1300',
    };
    await escolherEdicao(controller, tela, 'envio', '2025', [
      { ...envio, geradoPorNome: 'Diogo Bruno Filipe Souza' },
      { ...envio, id: '01960000-0000-7000-0000-0000000005ef', geradoPorNome: null },
    ]);

    const linhas = Array.from(secao().querySelectorAll('tbody tr')).map((tr) =>
      (tr.textContent ?? '').replace(/\s+/g, ' '),
    );
    expect(linhas[0]).toContain('Diogo Bruno Filipe Souza');
    expect(linhas[1]).toContain('Não registrado');
  });
});

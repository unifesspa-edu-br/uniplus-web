import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NotasDoEnemPage } from './notas-do-enem.page';
import { NotasDoEnemDoProcesso } from './notas-do-enem-do-processo.service';
import {
  PROCESSO_ID,
  ROTA_EDICAO,
  ROTA_LEIAUTES,
  abrirTela,
  processo,
  providersDaTela,
  responderALeituraInicial,
} from './notas-do-enem.testing';

const ROTA_ENVIOS = `${ROTA_EDICAO}/envios-ao-inep`;
const ROTA_LOTES = `${ROTA_EDICAO}/lotes-de-notas`;

describe('NotasDoEnemDoProcesso: leitura em curso do histórico', () => {
  let fixture: ComponentFixture<NotasDoEnemPage>;
  let controller: HttpTestingController;
  let notas: NotasDoEnemDoProcesso;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [NotasDoEnemPage], providers: providersDaTela() });
    controller = TestBed.inject(HttpTestingController);
    ({ fixture } = await abrirTela(controller, processo()));
    notas = fixture.debugElement.injector.get(NotasDoEnemDoProcesso);
  });

  afterEach(() => controller.verify());

  async function edicaoDeEnvioEmFalha(): Promise<void> {
    const escolha = notas.escolherEdicaoDeEnvio('2025');
    controller.expectOne(ROTA_ENVIOS).flush({ title: 'Indisponível' }, { status: 503, statusText: 'x' });
    await escolha;
  }

  it('a recarga marca a leitura em curso e a baixa quando o histórico chega', async () => {
    await edicaoDeEnvioEmFalha();
    expect(notas.relendoEnvios()).toBe(false);

    const recarga = notas.recarregarEnvios();
    expect(notas.relendoEnvios()).toBe(true);
    controller.expectOne(ROTA_ENVIOS).flush([]);
    await recarga;

    expect(notas.relendoEnvios()).toBe(false);
    expect(notas.envios().estado).toBe('lido');
  });

  it('a recarga que falha de novo baixa a leitura em curso e mantém a falha', async () => {
    await edicaoDeEnvioEmFalha();

    const recarga = notas.recarregarEnvios();
    controller.expectOne(ROTA_ENVIOS).flush({ title: 'Indisponível' }, { status: 503, statusText: 'x' });
    await recarga;

    expect(notas.relendoEnvios()).toBe(false);
    expect(notas.envios().estado).toBe('falha');
  });

  it('a leitura superada por outra segue marcada até a mais nova responder', async () => {
    await edicaoDeEnvioEmFalha();

    const antiga = notas.recarregarEnvios();
    const pedidoAntigo = controller.expectOne(ROTA_ENVIOS);
    const recente = notas.recarregarEnvios();
    const pedidoRecente = controller.expectOne(ROTA_ENVIOS);

    pedidoAntigo.flush([]);
    await antiga;
    expect(notas.relendoEnvios()).toBe(true);

    pedidoRecente.flush([]);
    await recente;
    expect(notas.relendoEnvios()).toBe(false);
  });

  it('a troca para a edição vazia durante a releitura descarta a leitura e baixa a marca', async () => {
    await edicaoDeEnvioEmFalha();
    const recarga = notas.recarregarEnvios();
    const pedido = controller.expectOne(ROTA_ENVIOS);
    expect(notas.relendoEnvios()).toBe(true);

    await notas.escolherEdicaoDeEnvio('');
    expect(notas.relendoEnvios()).toBe(false);

    pedido.flush([]);
    await recarga;
    expect(notas.relendoEnvios()).toBe(false);
  });

  it('a troca de processo descarta a leitura em curso e baixa a marca', async () => {
    await edicaoDeEnvioEmFalha();
    const recarga = notas.recarregarEnvios();
    const pedido = controller.expectOne(ROTA_ENVIOS);
    expect(notas.relendoEnvios()).toBe(true);

    const abertura = notas.abrir(PROCESSO_ID);
    expect(notas.relendoEnvios()).toBe(false);

    pedido.flush([]);
    await recarga;
    expect(notas.relendoEnvios()).toBe(false);

    await responderALeituraInicial(controller, processo());
    await abertura;
  });

  it('o histórico de lotes tem a própria marca', async () => {
    const escolha = notas.escolherEdicaoDeRetorno('2025');
    controller.expectOne(ROTA_LOTES).flush([]);
    await escolha;

    const recarga = notas.recarregarLotes();
    expect(notas.relendoLotes()).toBe(true);
    expect(notas.relendoEnvios()).toBe(false);
    controller.expectOne(ROTA_LOTES).flush([]);
    await recarga;

    expect(notas.relendoLotes()).toBe(false);
  });

  it('a leitura de leiautes superada por outra não desfaz o resultado da mais nova', async () => {
    const antiga = notas.recarregarLeiautes('envio');
    const pedidoAntigo = controller.expectOne(
      (r) => r.url === ROTA_LEIAUTES && r.params.get('tipo') === 'envio',
    );
    const recente = notas.recarregarLeiautes('envio');
    const pedidoRecente = controller.expectOne(
      (r) => r.url === ROTA_LEIAUTES && r.params.get('tipo') === 'envio',
    );

    pedidoRecente.flush([]);
    await recente;
    pedidoAntigo.flush({ title: 'Indisponível' }, { status: 503, statusText: 'x' });
    await antiga;

    expect(notas.leiautesDeEnvio().estado).toBe('lido');
  });
});

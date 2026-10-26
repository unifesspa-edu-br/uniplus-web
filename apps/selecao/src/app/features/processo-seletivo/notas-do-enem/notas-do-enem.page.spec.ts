import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NotasDoEnemPage } from './notas-do-enem.page';
import { NotasDoEnemDoProcesso } from './notas-do-enem-do-processo.service';
import {
  ROTA_EDICAO,
  ROTA_LEIAUTES,
  ROTA_PROCESSO,
  abrirTela,
  escolherEdicao,
  processo,
  providersDaTela,
  snapshotVigente,
  type Card,
} from './notas-do-enem.testing';

describe('NotasDoEnemPage', () => {
  let fixture: ComponentFixture<NotasDoEnemPage>;
  let controller: HttpTestingController;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NotasDoEnemPage], providers: providersDaTela() });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  async function abrir(
    lido: ReturnType<typeof processo>,
    publicada: ReturnType<typeof snapshotVigente> | null = snapshotVigente(),
  ): Promise<void> {
    ({ fixture, host } = await abrirTela(controller, lido, {}, publicada));
  }

  const texto = (): string => host.textContent ?? '';
  const seletor = (card: Card = 'envio'): HTMLSelectElement => {
    const select = host.querySelector<HTMLSelectElement>(`#notas-edicao-${card}`);
    if (select === null) throw new Error('O seletor de edição não foi renderizado.');
    return select;
  };

  it('o processo em rascunho explica que falta divulgar e não oferece escolha de edição', async () => {
    await abrir(processo({ status: 'rascunho' }));

    expect(texto()).toContain('O processo ainda não foi divulgado');
    expect(host.querySelector('sel-seletor-de-edicao')).toBeNull();
  });

  it('o processo sem etapa de nota do ENEM diz que não há onde importar', async () => {
    await abrir(processo(), snapshotVigente({ etapaDoEnem: false }));

    expect(texto()).toContain('Este processo não tem etapa de nota do ENEM');
  });

  it('o processo sem edições declaradas diz que não há o que escolher', async () => {
    await abrir(processo(), snapshotVigente({ edicoes: [] }));

    expect(texto()).toContain('O processo não declara edições do ENEM');
  });

  it('o processo publicado sem snapshot vigente é tratado como não divulgado', async () => {
    await abrir(processo(), null);

    expect(texto()).toContain('O processo ainda não foi divulgado');
  });

  it('uma retificação aberta que removeu a edição não tira a edição publicada da tela', async () => {
    // A configuração administrativa já não declara a edição 2025; a publicada ainda a declara.
    await abrir(processo(), snapshotVigente({ edicoes: ['2025'] }));

    expect(Array.from(seletor().options).map((o) => o.value)).toEqual(['', '2025']);
  });

  it('cada card tem a própria edição e lê só o histórico dela', async () => {
    await abrir(processo());
    expect(Array.from(seletor().options).map((o) => o.text.trim())).toEqual([
      'Selecione a edição',
      '2024',
      '2025',
    ]);

    seletor('envio').value = '2025';
    seletor('envio').dispatchEvent(new Event('change'));
    controller.expectOne(`${ROTA_EDICAO}/envios-ao-inep`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('Nenhum envio gerado para esta edição');
    expect(texto()).not.toContain('Nenhum lote importado para esta edição');
    expect(seletor('retorno').value).toBe('');

    seletor('retorno').value = '2024';
    seletor('retorno').dispatchEvent(new Event('change'));
    controller.expectOne(`${ROTA_EDICAO.replace(/2025$/, '2024')}/lotes-de-notas`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('Nenhum lote importado para esta edição');
    expect(seletor('envio').value).toBe('2025');
  });

  it('a leitura do processo que termina depois de uma mais nova não a sobrescreve', async () => {
    fixture = TestBed.createComponent(NotasDoEnemPage);
    fixture.detectChanges();
    controller
      .expectOne(ROTA_PROCESSO)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    controller
      .expectOne((r) => r.url === ROTA_LEIAUTES && r.params.get('tipo') === 'envio')
      .flush([]);
    controller
      .expectOne((r) => r.url === ROTA_LEIAUTES && r.params.get('tipo') === 'retorno')
      .flush([]);
    await fixture.whenStable();

    const notas = fixture.debugElement.injector.get(NotasDoEnemDoProcesso);
    const antiga = notas.recarregarProcesso();
    const [pedidoAntigo] = controller.match(ROTA_PROCESSO);
    const recente = notas.recarregarProcesso();
    const pedidoRecente = controller.expectOne(ROTA_PROCESSO);

    pedidoRecente.flush(processo({ status: 'rascunho' }));
    await recente;
    pedidoAntigo.flush(null, { status: 503, statusText: 'Service Unavailable' });
    await antiga;

    expect(notas.processo().estado).toBe('lido');
  });

  it('a releitura do histórico invalida a leitura anterior que ainda não voltou', async () => {
    await abrir(processo());
    const notas = fixture.debugElement.injector.get(NotasDoEnemDoProcesso);
    const rota = `${ROTA_EDICAO}/envios-ao-inep`;

    const escolha = notas.escolherEdicaoDeEnvio('2025');
    const pedidoAntigo = controller.expectOne(rota);
    const recarga = notas.recarregarEnvios();
    const pedidoRecente = controller.expectOne(rota);

    pedidoRecente.flush([{ id: 'gerado-agora' }]);
    await recarga;
    pedidoAntigo.flush([]);
    await escolha;

    const envios = notas.envios();
    expect(envios.estado === 'lido' ? envios.dados : null).toEqual([{ id: 'gerado-agora' }]);
  });

  it('volta a "sem edição" ao desfazer a escolha, sem ler nada', async () => {
    await abrir(processo());
    await escolherEdicao(controller, { fixture, host }, 'envio');
    expect(texto()).toContain('Nenhum envio gerado para esta edição');

    seletor('envio').value = '';
    seletor('envio').dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('Escolha a edição do ENEM para gerar o arquivo de envio');
    expect(texto()).not.toContain('Nenhum envio gerado para esta edição');
  });
});

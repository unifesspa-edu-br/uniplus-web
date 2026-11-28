import { afterEach, describe, expect, it } from 'vitest';

import { quadroCongelado } from '../../shared/quadro-de-pesos';

import {
  QUADRO_CONGELADO,
  RESOLUCAO,
  botao,
  montarSecao,
  encerrarMontagem,
  rascunhoComResolucao,
  releitura,
  responderPesos,
  texto,
} from './peso-por-area.testing';

function gravarComQuadroPorConfirmar(m: Awaited<ReturnType<typeof montarSecao>>): void {
  m.store.classificacao.registrarGravadaComQuadro(RESOLUCAO, quadroCongelado(QUADRO_CONGELADO));
  m.fixture.detectChanges();
}

async function relerSemConfirmar(m: Awaited<ReturnType<typeof montarSecao>>): Promise<void> {
  releitura.reler.mockImplementation(async () => true);
  botao(m, 'Reler o processo')?.click();
  await m.fixture.whenStable();
  m.fixture.detectChanges();
}

describe('PesoPorAreaComponent — aviso do quadro ainda não relido', () => {
  afterEach(encerrarMontagem);

  it('o aviso do quadro não relido diz que não impede a publicação, o que fica impedido e o que fazer', async () => {
    const m = await montarSecao({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
    responderPesos(m);
    m.store.classificacao.registrarGravadaComQuadro(RESOLUCAO, quadroCongelado(QUADRO_CONGELADO));
    m.fixture.detectChanges();

    expect(texto(botao(m, 'Reler o processo')?.closest('div')?.querySelector('p') ?? null)).toBe(
      'O quadro de Peso por Área que a última gravação da classificação congelou no processo ainda não foi confirmado por uma releitura. Não é preciso reler antes de publicar: o sistema relê o processo ao publicar. Se essa leitura falhar e houver critério de desempate por área, a publicação para. Enquanto o processo não for relido, não é possível confirmar, no passo Desempate, um critério de desempate por área. Use "Reler o processo" para conferir agora; este aviso some quando a releitura confirmar o que foi gravado.',
    );
  });

  it('releitura que falha: o aviso continua à vista e diz que não foi possível reler', async () => {
    const m = await montarSecao({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
    responderPesos(m);
    m.store.classificacao.registrarGravadaComQuadro(RESOLUCAO, quadroCongelado(QUADRO_CONGELADO));
    m.fixture.detectChanges();
    releitura.reler.mockImplementation(async () => true);

    botao(m, 'Reler o processo')?.click();
    await m.fixture.whenStable();
    m.fixture.detectChanges();

    expect(texto(botao(m, 'Reler o processo')?.closest('div')?.querySelector('p') ?? null)).toBe(
      'Não foi possível reler o processo agora. Use "Reler o processo" para tentar de novo. O quadro de Peso por Área que a última gravação da classificação congelou no processo ainda não foi confirmado por uma releitura. Não é preciso reler antes de publicar: o sistema relê o processo ao publicar. Se essa leitura falhar e houver critério de desempate por área, a publicação para. Enquanto o processo não for relido, não é possível confirmar, no passo Desempate, um critério de desempate por área. Use "Reler o processo" para conferir agora; este aviso some quando a releitura confirmar o que foi gravado.',
    );
  });

  it('a falha de uma releitura não passa para a pendência seguinte', async () => {
    const m = await montarSecao({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
    responderPesos(m);
    gravarComQuadroPorConfirmar(m);
    await relerSemConfirmar(m);

    m.store.classificacao.marcarDesconhecida();
    m.fixture.detectChanges();

    expect(botao(m, 'Reler o processo')).toBeDefined();
    expect(texto(m.el)).toContain('Não se sabe o que a classificação gravada tem agora');
    expect(texto(m.el)).not.toContain('Não foi possível reler');
  });
});

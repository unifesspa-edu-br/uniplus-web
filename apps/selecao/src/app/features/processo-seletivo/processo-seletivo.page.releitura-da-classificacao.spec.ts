import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { apiOk } from '@uniplus/shared-core/http';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { ConducaoDoWizard } from './editor/conducao-do-wizard.service';
import {
  CRITERIO_POR_AREA,
  configurarPagina,
  montarPagina,
} from './processo-seletivo.page.testing';
import { CadastroInicial } from './wizard/shared/cadastro-inicial.service';
import { quadroCongelado } from './wizard/shared/quadro-de-pesos';
import { ReleituraDoSnapshot } from './wizard/shared/releitura-do-snapshot.service';
import { CatalogosDeClassificacao } from './wizard/passos/classificacao/catalogos-de-classificacao.service';

describe('ProcessoSeletivoPage — publicação: releitura da classificação', () => {
  beforeEach(configurarPagina);

  it('relê o processo uma vez no fim da varredura quando uma gravação deixou o quadro congelado velho', async () => {
    const { fixture, page, store } = montarPagina();
    const releitura = fixture.debugElement.injector.get(ReleituraDoSnapshot);
    const reler = vi.spyOn(releitura, 'reler').mockResolvedValue(true);
    const stubQueMarca = {
      validar: () => ({ valid: true }),
      persistir: vi.fn(async () => {
        store.classificacao.marcarDesconhecida();
        return { valid: false, messages: ['Falha ao gravar de novo.'] };
      }),
    };
    const stubSemPersistir = { validar: () => ({ valid: true }) };

    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (index: number) => (index === 2 ? stubQueMarca : stubSemPersistir),
    );

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    // Mesmo com a varredura falhando, a leitura acontece — sem ela a marca ficaria para sempre.
    expect(reler).toHaveBeenCalledTimes(1);
  });

  it('a cópia que a gravação na varredura presumiu é confirmada por uma releitura no fim, com o que o servidor congelou', async () => {
    const { fixture, page, store } = montarPagina();
    // O processo já criado ganha endereço próprio; a rota dele não está neste teste.
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    store.processoSeletivoId.set('processo-1');
    const detalhe = {
      id: 'processo-1',
      classificacao: {
        resolucaoPesoAreaEnem: 'Resolução nova',
        quadroPesoAreaEnem: [
          {
            grupoAreaEnem: { codigo: 'G', rotulo: 'Grupo' },
            baseLegal: 'Anexo I',
            areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 3, corte: null }],
          },
        ],
      },
      criteriosDesempate: [],
    } as unknown as ProcessoSeletivoDto;
    const obterDetalhe = vi
      .spyOn(fixture.debugElement.injector.get(CadastroInicial), 'obterDetalhe')
      .mockResolvedValue(apiOk(detalhe, 200, new HttpHeaders()));
    // O cadastro lido aqui tinha peso 1; o servidor copiou o dele, mais novo, com peso 3.
    const stubDaEliminacao = {
      validar: () => ({ valid: true }),
      persistir: vi.fn(async () => {
        store.classificacao.registrarGravadaComQuadro('Resolução nova', [
          {
            codigo: 'G',
            rotulo: 'Grupo',
            baseLegal: 'Anexo I',
            areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }],
          },
        ]);
        return { valid: true };
      }),
    };
    const stubSemPersistir = { validar: () => ({ valid: true }) };
    // A Revisão para a publicação depois da releitura: o que importa aqui é o que veio antes.
    const stubDaRevisao = { validar: () => ({ valid: false, messages: ['Revisão pendente.'] }) };
    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (index: number) =>
        index === 2
          ? stubDaEliminacao
          : index === store.totalDePassos - 1
            ? stubDaRevisao
            : stubSemPersistir,
    );

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(stubDaEliminacao.persistir).toHaveBeenCalledTimes(1);
    expect(obterDetalhe).toHaveBeenCalledTimes(1);
    expect(store.classificacao.copiaCongeladaEmVigor()).toEqual({
      resolucao: 'Resolução nova',
      grupos: quadroCongelado(detalhe.classificacao?.quadroPesoAreaEnem ?? []),
    });
  });

  it('com a classificação gravada desconhecida, valida, relê e valida de novo', async () => {
    const { fixture, page, store } = montarPagina();
    const releitura = fixture.debugElement.injector.get(ReleituraDoSnapshot);
    const ordem: string[] = [];
    vi.spyOn(releitura, 'reler').mockImplementation(async () => {
      ordem.push('releu');
      store.classificacao.registrarGravadaSemQuadro();
      return true;
    });
    // O Desempate recusa enquanto não se sabe o que a classificação gravada tem.
    const stubQueDependeDaClassificacao = {
      validar: () => {
        ordem.push('validou');
        return store.classificacao.motivoDaReleitura() === 'desconhecida'
          ? { valid: false, messages: ['Classificação desconhecida.'] }
          : { valid: true };
      },
    };
    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      () => stubQueDependeDaClassificacao,
    );
    store.classificacao.marcarDesconhecida();

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    // Valida antes de ir à rede, e de novo depois da releitura.
    expect(ordem[0]).toBe('validou');
    expect(ordem).toContain('releu');
    expect(ordem.slice(ordem.indexOf('releu'))).toContain('validou');
    expect(JSON.stringify(store.erroDoPasso() ?? null)).not.toContain(
      'Classificação desconhecida.',
    );
  });

  it('sem nada por reler, o rascunho incompleto é barrado sem ir à rede', async () => {
    const { fixture, page, store } = montarPagina();
    const reler = vi.spyOn(fixture.debugElement.injector.get(ReleituraDoSnapshot), 'reler');
    const stubIncompleto = { validar: () => ({ valid: false, messages: ['Falta a regra.'] }) };
    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      () => stubIncompleto,
    );

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(reler).not.toHaveBeenCalled();
    expect(JSON.stringify(store.erroDoPasso())).toContain('Falta a regra.');
  });

  it('cada leitura do cadastro que dá certo reavalia a recusa pelo desempate', () => {
    const { fixture, store } = montarPagina();
    store.classificacao.criteriosDesempateGravados.set([]);
    store.classificacao.recusarPeloDesempate('Recusa pelo desempate.', 0);

    fixture.debugElement.injector
      .get(CatalogosDeClassificacao)
      .pesosLidosNaLeitura.update((leitura) => leitura + 1);
    TestBed.tick();

    expect(store.classificacao.recusaPeloDesempatePorArea()).toBeNull();
  });

  it('critérios de desempate gravados que mudam reavaliam a recusa pelo desempate', () => {
    const { store } = montarPagina();
    store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);
    store.classificacao.recusarPeloDesempate('Recusa pelo desempate.', 0);
    TestBed.tick();
    expect(store.classificacao.recusaPeloDesempatePorArea()).toBe('Recusa pelo desempate.');

    // A releitura do processo, ou a gravação do Desempate, trouxe critérios sem área.
    store.classificacao.criteriosDesempateGravados.set([]);
    TestBed.tick();

    expect(store.classificacao.recusaPeloDesempatePorArea()).toBeNull();
  });
});

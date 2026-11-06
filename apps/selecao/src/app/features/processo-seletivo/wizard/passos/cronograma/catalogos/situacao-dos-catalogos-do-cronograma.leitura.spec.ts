import { HttpHeaders } from '@angular/common/http';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure, apiOk, type ApiResult } from '@uniplus/shared-core/http';
import {
  CategoriasDocumentoApi,
  FasesCanonicasApi,
  FatosCandidatoApi,
  PrecedenciasFaseApi,
  TiposBancaApi,
  TiposDocumentoApi,
  TiposEtapaApi,
} from '@uniplus/shared-data/configuracao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { TiposAtoApi } from '@uniplus/shared-data/publicacoes';
import { RegrasCatalogoApi } from '@uniplus/shared-data/selecao';
import {
  acompanharLeitura,
  AnuncioDaConclusao,
  type LeituraAcompanhada,
} from '@uniplus/shared-ui/components';

import { CATALOGOS_DO_CRONOGRAMA } from './catalogos-do-cronograma';
import { pagina } from './catalogos.testing';
import { SituacaoDosCatalogosDoCronograma } from './situacao-dos-catalogos-do-cronograma.service';

type Resposta = Subject<ApiResult<readonly never[]>>;

const sucesso = (): ApiResult<readonly never[]> => apiOk([], 200, new HttpHeaders());
const recusa = (): ApiResult<readonly never[]> =>
  apiFailure(
    { type: 'about:blank', title: 'x', status: 500, code: 'uniplus.erro', traceId: '' },
    500,
    new HttpHeaders(),
  );

/** Uma atualização da tela: efeitos, `afterNextRender` e a macrotarefa que decide o desfecho. */
async function atualizar(): Promise<void> {
  TestBed.inject(ApplicationRef).tick();
  await new Promise((resolver) => setTimeout(resolver));
  TestBed.inject(ApplicationRef).tick();
}

describe('leitura acompanhada dos catálogos do cronograma', () => {
  const anunciar = vi.fn();
  let fases: Resposta;
  let fatos: Resposta;
  let situacao: SituacaoDosCatalogosDoCronograma;
  let leitura: LeituraAcompanhada;
  let destino: HTMLElement;

  /** Fases e fatos respondem quando o teste manda; os demais catálogos respondem na hora. */
  function montar(): void {
    fases = new Subject();
    fatos = new Subject();
    const vazio = { listar: () => pagina([]) };
    TestBed.configureTestingModule({
      providers: [
        ...CATALOGOS_DO_CRONOGRAMA,
        { provide: AnuncioDaConclusao, useValue: { anunciar } },
        { provide: FasesCanonicasApi, useValue: { listar: () => fases } },
        { provide: FatosCandidatoApi, useValue: { listar: () => fatos } },
        { provide: PrecedenciasFaseApi, useValue: vazio },
        { provide: TiposBancaApi, useValue: vazio },
        { provide: CategoriasDocumentoApi, useValue: vazio },
        { provide: TiposEtapaApi, useValue: vazio },
        { provide: TiposDocumentoApi, useValue: vazio },
        { provide: TiposAtoApi, useValue: vazio },
        { provide: RegrasCatalogoApi, useValue: vazio },
        { provide: UnidadesApi, useValue: vazio },
      ],
    });
    situacao = TestBed.inject(SituacaoDosCatalogosDoCronograma);
    leitura = TestBed.runInInjectionContext(() =>
      acompanharLeitura({
        falha: situacao.erro,
        pendente: situacao.carregando,
        recarregar: () => situacao.recarregar(),
        destino: () => destino,
      }),
    );
  }

  /** A primeira rodada termina com a falha dos fatos, e a pessoa pede a segunda. */
  async function falharEPedirDeNovo(): Promise<void> {
    situacao.carregar();
    fases.next(sucesso());
    fases.complete();
    fatos.next(recusa());
    fatos.complete();
    await atualizar();
    fases = new Subject();
    fatos = new Subject();
    leitura.tentar();
    await atualizar();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    anunciar.mockReset();
    destino = document.createElement('p');
    destino.tabIndex = -1;
    document.body.append(destino);
    montar();
  });

  afterEach(() => destino.remove());

  it('a rodada que recomeça apaga a falha dos catálogos, e o aviso segue com a mensagem de antes', async () => {
    await falharEPedirDeNovo();

    expect(situacao.erro()).toBeNull();
    expect(leitura.visivel()).toBe(true);
    expect(leitura.fase()).toBe('tentando');
    expect(leitura.mensagem()).toContain('Não foi possível carregar os catálogos');
  });

  it('um catálogo que responde antes do outro não encerra a tentativa nem a dá por boa', async () => {
    await falharEPedirDeNovo();

    fases.next(sucesso());
    fases.complete();
    await atualizar();

    expect(situacao.carregando()).toBe(true);
    expect(leitura.fase()).toBe('tentando');
    expect(anunciar).not.toHaveBeenCalled();
  });

  it('a falha que chega no último catálogo é "também falhou", sem sucesso no meio', async () => {
    await falharEPedirDeNovo();

    fases.next(sucesso());
    fases.complete();
    await atualizar();
    fatos.next(recusa());
    fatos.complete();
    await atualizar();

    expect(leitura.fase()).toBe('repetida');
    expect(leitura.visivel()).toBe(true);
    expect(anunciar).not.toHaveBeenCalled();
  });

  it('os dois catálogos que respondem bem encerram a tentativa e tiram o aviso', async () => {
    await falharEPedirDeNovo();

    fases.next(sucesso());
    fases.complete();
    fatos.next(sucesso());
    fatos.complete();
    await atualizar();

    expect(leitura.visivel()).toBe(false);
    expect(leitura.fase()).toBe('inicial');
  });
});

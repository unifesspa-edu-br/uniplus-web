import { HttpHeaders } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { apiOk } from '@uniplus/shared-core/http';
import { VocabulariosDeConfiguracaoApi } from './vocabularios-de-configuracao.api';
import { TipoDoDadoCodigo } from './schema';
import { TiposBancaApi } from './tipos-banca.api';
import { TiposDeDecisaoApi } from './tipos-de-decisao.api';
import {
  fornecerVocabularioDeTiposDoDado,
  VOCABULARIO_DE_TIPOS_DO_DADO,
  fornecerVocabularioDePapeisDeBanca,
  fornecerVocabularioDeTiposDeDecisao,
  VOCABULARIO_DE_PAPEIS_DE_BANCA,
  VOCABULARIO_DE_TIPOS_DE_DECISAO,
} from './vocabularios';

const NOTA = { codigo: 'NOTA_DA_ETAPA', rotulo: 'Nota da etapa' };

function aplicacaoComApi(listar: () => unknown, listarPapeis: () => unknown = () => of()) {
  TestBed.configureTestingModule({
    providers: [
      { provide: TiposDeDecisaoApi, useValue: { listar } },
      { provide: TiposBancaApi, useValue: { listarPapeis } },
    ],
  });
  return TestBed.inject(EnvironmentInjector);
}

/** A tela dona: o injetor que ela cria com os provedores do componente e destrói ao sair. */
const abrirTela = (aplicacao: EnvironmentInjector) =>
  createEnvironmentInjector(
    [fornecerVocabularioDeTiposDeDecisao(), fornecerVocabularioDePapeisDeBanca()],
    aplicacao,
  );

describe('vocabulários da Configuração', () => {
  it('lê os tipos de decisão da API e dá o rótulo dela', () => {
    const listar = vi.fn(() => of(apiOk([NOTA], 200, new HttpHeaders())));
    const tela = abrirTela(aplicacaoComApi(listar));
    const vocabulario = tela.get(VOCABULARIO_DE_TIPOS_DE_DECISAO);

    vocabulario.carregar();

    expect(listar).toHaveBeenCalledTimes(1);
    expect(vocabulario.rotulo()('NOTA_DA_ETAPA')).toBe('Nota da etapa');
  });

  it('lê os papéis de banca da API e diz a falha com texto próprio', () => {
    const listarPapeis = vi.fn(() => of(apiOk([], 200, new HttpHeaders())));
    const tela = abrirTela(aplicacaoComApi(() => of(), listarPapeis));
    const vocabulario = tela.get(VOCABULARIO_DE_PAPEIS_DE_BANCA);

    vocabulario.carregar();

    expect(listarPapeis).toHaveBeenCalledTimes(1);
    expect(vocabulario.erro()).toBe('Não foi possível carregar os papéis de banca.');
  });

  it.each([
    [[{ codigo: TipoDoDadoCodigo.OPCAO, rotulo: 'Rótulo da API' }], null],
    [[], 'Não foi possível carregar os tipos de dado.'],
  ])('lê os tipos de dado e informa falha para lista vazia', (itens, erro) => {
    const listar = vi.fn(() => of(apiOk(itens, 200, new HttpHeaders())));
    TestBed.configureTestingModule({
      providers: [{ provide: VocabulariosDeConfiguracaoApi, useValue: { listar } }],
    });
    const tela = createEnvironmentInjector(
      [fornecerVocabularioDeTiposDoDado()],
      TestBed.inject(EnvironmentInjector),
    );
    const vocabulario = tela.get(VOCABULARIO_DE_TIPOS_DO_DADO);
    vocabulario.carregar();
    expect(listar).toHaveBeenCalledWith('tipos-do-dado');
    expect(vocabulario.itens()).toEqual(itens);
    expect(vocabulario.erro()).toBe(erro);
  });

  it('informa falha quando a leitura dos tipos de dado falha', () => {
    const listar = vi.fn(() => throwError(() => new Error('falha')));
    TestBed.configureTestingModule({
      providers: [{ provide: VocabulariosDeConfiguracaoApi, useValue: { listar } }],
    });
    const tela = createEnvironmentInjector(
      [fornecerVocabularioDeTiposDoDado()],
      TestBed.inject(EnvironmentInjector),
    );
    const vocabulario = tela.get(VOCABULARIO_DE_TIPOS_DO_DADO);
    vocabulario.carregar();
    expect(vocabulario.itens()).toEqual([]);
    expect(vocabulario.erro()).toBe('Não foi possível carregar os tipos de dado.');
  });

  it('não guarda cópia na aplicação: quem esquece de fornecer falha na injeção', () => {
    const aplicacao = aplicacaoComApi(() => of());

    expect(() => aplicacao.get(VOCABULARIO_DE_TIPOS_DE_DECISAO)).toThrow();
    expect(() => aplicacao.get(VOCABULARIO_DE_PAPEIS_DE_BANCA)).toThrow();
  });

  it('pede de novo a cada vez que a tela é aberta, e dá a mesma instância dentro dela', () => {
    const listar = vi.fn(() => of(apiOk([NOTA], 200, new HttpHeaders())));
    const aplicacao = aplicacaoComApi(listar);

    const visitar = (): void => {
      const tela = abrirTela(aplicacao);
      expect(tela.get(VOCABULARIO_DE_TIPOS_DE_DECISAO)).toBe(
        tela.get(VOCABULARIO_DE_TIPOS_DE_DECISAO),
      );
      tela.get(VOCABULARIO_DE_TIPOS_DE_DECISAO).carregar();
      tela.destroy();
    };
    visitar();
    visitar();

    expect(listar).toHaveBeenCalledTimes(2);
  });
});

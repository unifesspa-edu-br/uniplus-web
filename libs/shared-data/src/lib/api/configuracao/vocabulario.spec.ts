import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError, type Observable } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { apiOk, type ApiResult } from '@uniplus/shared-core/http';
import { criarVocabulario, opcoesDoVocabulario, type ItemDeVocabulario } from './vocabulario';

const MENSAGEM = 'Não foi possível carregar o vocabulário.';
const NOTA = { codigo: 'NOTA_DA_ETAPA', rotulo: 'Nota da etapa' };
const GABARITO = { codigo: 'GABARITO_DA_PROVA', rotulo: 'Gabarito da prova' };

const ok = (itens: readonly ItemDeVocabulario[]): ApiResult<readonly ItemDeVocabulario[]> =>
  apiOk(itens, 200, new HttpHeaders());

function vocabularioDe(listar: () => Observable<ApiResult<readonly ItemDeVocabulario[]>>) {
  return TestBed.runInInjectionContext(() => criarVocabulario(listar, MENSAGEM));
}

describe('criarVocabulario', () => {
  it('fica carregando desde a criação, sem erro, e não mostra nome nenhum', () => {
    const vocabulario = vocabularioDe(() => of(ok([NOTA])));

    expect(vocabulario.carregando()).toBe(true);
    expect(vocabulario.erro()).toBeNull();
    expect(vocabulario.itens()).toEqual([]);
  });

  it('guarda a resposta na ordem da API e dá o rótulo dela, ou o código desconhecido', () => {
    const vocabulario = vocabularioDe(() => of(ok([NOTA, GABARITO])));

    vocabulario.carregar();

    expect(vocabulario.carregando()).toBe(false);
    expect(vocabulario.erro()).toBeNull();
    expect(vocabulario.itens()).toEqual([NOTA, GABARITO]);
    expect(vocabulario.rotulo()('GABARITO_DA_PROVA')).toBe('Gabarito da prova');
    expect(vocabulario.rotulo()('OUTRO')).toBe('OUTRO');
  });

  it('busca uma vez só, ainda que carregar seja chamado duas vezes', () => {
    const listar = vi.fn(() => of(ok([NOTA])));
    const vocabulario = vocabularioDe(listar);

    vocabulario.carregar();
    vocabulario.carregar();

    expect(listar).toHaveBeenCalledTimes(1);
  });

  it('continua carregando enquanto a primeira resposta não chega', () => {
    const resposta = new Subject<ApiResult<readonly ItemDeVocabulario[]>>();
    const vocabulario = vocabularioDe(() => resposta);

    vocabulario.carregar();
    vocabulario.carregar();
    expect(vocabulario.carregando()).toBe(true);

    resposta.next(ok([NOTA]));
    resposta.complete();
    expect(vocabulario.carregando()).toBe(false);
  });

  it('dá a mensagem na falha de rede e busca de novo no carregar seguinte', () => {
    const listar = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('sem rede')))
      .mockReturnValue(of(ok([NOTA])));
    const vocabulario = vocabularioDe(listar);

    vocabulario.carregar();
    expect(vocabulario.erro()).toBe(MENSAGEM);
    expect(vocabulario.carregando()).toBe(false);

    vocabulario.carregar();
    expect(listar).toHaveBeenCalledTimes(2);
    expect(vocabulario.erro()).toBeNull();
    expect(vocabulario.itens()).toEqual([NOTA]);
  });

  it('dá a mensagem na recusa da API', () => {
    const recusa = { ok: false, problem: { status: 403 } } as unknown as ApiResult<
      readonly ItemDeVocabulario[]
    >;
    const vocabulario = vocabularioDe(() => of(recusa));

    vocabulario.carregar();

    expect(vocabulario.erro()).toBe(MENSAGEM);
  });

  it('trata a lista vazia como falha, para a tela não oferecer escolha nenhuma', () => {
    const vocabulario = vocabularioDe(() => of(ok([])));

    vocabulario.carregar();

    expect(vocabulario.erro()).toBe(MENSAGEM);
  });

  it('descarta a resposta antiga que chega depois do recarregar', () => {
    const antiga = new Subject<ApiResult<readonly ItemDeVocabulario[]>>();
    const nova = new Subject<ApiResult<readonly ItemDeVocabulario[]>>();
    const listar = vi.fn().mockReturnValueOnce(antiga).mockReturnValueOnce(nova);
    const vocabulario = vocabularioDe(listar);

    vocabulario.carregar();
    vocabulario.recarregar();
    antiga.next(ok([GABARITO]));
    antiga.complete();
    expect(vocabulario.itens()).toEqual([]);
    expect(vocabulario.carregando()).toBe(true);

    nova.next(ok([NOTA]));
    nova.complete();
    expect(vocabulario.itens()).toEqual([NOTA]);
    expect(vocabulario.carregando()).toBe(false);
  });
});

describe('opcoesDoVocabulario', () => {
  it('oferece os itens na ordem da API quando nada foi declarado', () => {
    expect(opcoesDoVocabulario([NOTA, GABARITO], [])).toEqual([NOTA, GABARITO]);
  });

  it('não repete o código declarado que o vocabulário conhece', () => {
    expect(opcoesDoVocabulario([NOTA, GABARITO], ['NOTA_DA_ETAPA'])).toEqual([NOTA, GABARITO]);
  });

  it('acrescenta no fim o código declarado que o vocabulário não conhece, uma vez só', () => {
    expect(opcoesDoVocabulario([NOTA], ['TIPO_DO_FUTURO', 'TIPO_DO_FUTURO'])).toEqual([
      NOTA,
      { codigo: 'TIPO_DO_FUTURO', rotulo: 'TIPO_DO_FUTURO' },
    ]);
  });

  it('acrescenta o declarado desconhecido com o rótulo que a leitura trouxe', () => {
    const lido = { codigo: 'TIPO_ANTIGO', rotulo: 'Tipo antigo' };

    expect(opcoesDoVocabulario([NOTA], [lido, lido, 'NOTA_DA_ETAPA'])).toEqual([NOTA, lido]);
  });

  it('oferece só o código declarado enquanto o vocabulário está vazio', () => {
    expect(opcoesDoVocabulario([], ['CLASSIFICACAO'])).toEqual([
      { codigo: 'CLASSIFICACAO', rotulo: 'CLASSIFICACAO' },
    ]);
  });
});

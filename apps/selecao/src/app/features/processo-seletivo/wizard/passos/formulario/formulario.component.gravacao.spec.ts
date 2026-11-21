import { describe, expect, it } from 'vitest';

import { GravacaoDosFormularios } from './servicos/gravacao-dos-formularios.service';
import {
  PROBLEM_JSON,
  PROCESSO,
  proximoPasso,
  ROTA_INSCRICAO,
  ROTA_PROCESSO,
  usarPasso,
  type ContextoDoPasso,
} from './formulario-passo.testing';

describe('FormularioPassoComponent: gravação', () => {
  let fixture: ContextoDoPasso['fixture'];
  let store: ContextoDoPasso['store'];
  let controller: ContextoDoPasso['controller'];

  usarPasso((contexto) => {
    ({ fixture, store, controller } = contexto);
  });

  it('grava só o que mudou, seguindo o plano, e envia os itens sem os dados básicos', async () => {
    const conteudo = store.draft().formulario.conteudo;
    store.patchObjectSection('formulario', {
      conteudo: {
        ...conteudo,
        itens:
          conteudo.itens?.map((i) =>
            i.fatoCodigo === 'PCD' ? { ...i, rotulo: 'Você tem deficiência?' } : i,
          ) ?? [],
      },
    });

    const gravacao = fixture.componentInstance.persistir();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);
    await proximoPasso();

    const itens = controller.expectOne(
      (r) => r.method === 'PUT' && r.url === `${ROTA_INSCRICAO}/itens`,
    );
    expect(
      itens.request.body.itens.map((i: { fatoCodigo: string; rotulo: string }) => [
        i.fatoCodigo,
        i.rotulo,
      ]),
    ).toEqual([['PCD', 'Você tem deficiência?']]);
    expect(itens.request.headers.has('Idempotency-Key')).toBe(true);
    itens.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    controller
      .expectOne(`${ROTA_PROCESSO}/referencia-temporal-fatos`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);

    expect(await gravacao).toEqual({ valid: true });
    // A releitura projeta o que o servidor tem, inclusive a fase pelo código.
    expect(store.draft().formulario.faseCodigo).toBe('INSCRICAO');
  });

  it('recusa o limite que não é número e diz em que formulário está', () => {
    const conteudo = store.draft().formulario.conteudo;
    store.patchObjectSection('formulario', {
      conteudo: {
        ...conteudo,
        itens:
          conteudo.itens?.map((i) =>
            i.fatoCodigo === 'PCD'
              ? {
                  ...i,
                  regras: {
                    ...i.regras,
                    restricoes: [{ tipo: 'TAMANHO_TEXTO', minimo: 'dez', maximo: null }],
                  },
                }
              : i,
          ) ?? [],
      },
    });

    expect(fixture.componentInstance.validar()).toEqual({
      valid: false,
      messages: [
        'O formulário de inscrição tem campos que não são números: veja os campos marcados na aba dele.',
      ],
    });
  });

  it('a recusa de um item vai para ele, pelo índice da lista enviada sem os dados básicos', async () => {
    const conteudo = store.draft().formulario.conteudo;
    store.patchObjectSection('formulario', {
      conteudo: {
        ...conteudo,
        itens:
          conteudo.itens?.map((i) =>
            i.fatoCodigo === 'PCD'
              ? { ...i, apresentacao: { ...i.apresentacao, rotulo: 'Outro' } }
              : i,
          ) ?? [],
      },
    });

    const gravacao = fixture.componentInstance.persistir();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);
    await proximoPasso();
    controller.expectOne(`${ROTA_INSCRICAO}/itens`).flush(
      {
        type: 'about:blank',
        title: 'Recusado.',
        status: 422,
        code: 'uniplus.selecao.formulario.item_invalido',
        traceId: '00000000000000000000000000000003',
        errors: [{ field: 'itens[0].rotulo', code: 'x', message: 'Rótulo recusado.' }],
      },
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
    );
    await proximoPasso();
    // Depois da recusa, relê para comparar a próxima tentativa com o que ficou gravado.
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(
      fixture.debugElement.injector
        .get(GravacaoDosFormularios)
        .recusas()
        .get('INSCRICAO')
        ?.porItem.get('PCD'),
    ).toEqual(['Rótulo recusado.']);
  });
});

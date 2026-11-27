import { describe, expect, it } from 'vitest';

import { comInscricao, inscricaoGravada } from './formulario-de-inscricao.testing';
import { conteudoDaInscricao, formularioDoCodigo } from './formularios-do-rascunho';
import { GravacaoDosFormularios } from './servicos/gravacao-dos-formularios.service';
import {
  PROBLEM_JSON,
  PROCESSO,
  proximoPasso,
  ROTA_HABILITACAO,
  ROTA_INSCRICAO,
  ROTA_PROCESSO,
  usarPasso,
  type ContextoDoPasso,
} from './formulario-passo.testing';

const INSCRICOES = new Set(['INSCRICAO']);

describe('FormularioPassoComponent: gravação', () => {
  let fixture: ContextoDoPasso['fixture'];
  let store: ContextoDoPasso['store'];
  let controller: ContextoDoPasso['controller'];
  let contexto: ContextoDoPasso;

  usarPasso((montado) => {
    contexto = montado;
    ({ fixture, store, controller } = montado);
  });

  it('grava só o que mudou, seguindo o plano, e envia os itens sem os dados básicos', async () => {
    const conteudo = conteudoDaInscricao(store.draft().formulario, INSCRICOES);
    store.patchObjectSection(
      'formulario',
      comInscricao(store.draft().formulario, {
        ...conteudo,
        itens:
          conteudo.itens?.map((i) =>
            i.fatoCodigo === 'PCD' ? { ...i, rotulo: 'Você tem deficiência?' } : i,
          ) ?? [],
      }),
    );

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
    expect(formularioDoCodigo(store.draft().formulario, 'INSCRICAO')?.faseCodigo).toBe('INSCRICAO');
  });

  it('recusa o limite que não é número e diz em que formulário está', () => {
    const conteudo = conteudoDaInscricao(store.draft().formulario, INSCRICOES);
    store.patchObjectSection(
      'formulario',
      comInscricao(store.draft().formulario, {
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
      }),
    );

    expect(fixture.componentInstance.validar()).toEqual({
      valid: false,
      messages: [
        'O formulário "Inscrição — Medicina 2027" tem campos que não são números: veja os campos marcados na aba dele.',
      ],
    });
  });

  it('a recusa de um item vai para ele, pelo índice da lista enviada sem os dados básicos', async () => {
    const conteudo = conteudoDaInscricao(store.draft().formulario, INSCRICOES);
    store.patchObjectSection(
      'formulario',
      comInscricao(store.draft().formulario, {
        ...conteudo,
        itens:
          conteudo.itens?.map((i) =>
            i.fatoCodigo === 'PCD'
              ? { ...i, apresentacao: { ...i.apresentacao, rotulo: 'Outro' } }
              : i,
          ) ?? [],
      }),
    );

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

  it('marca como gravado o formulário novo que o servidor criou e depois recusou, sem perder o conteúdo', async () => {
    contexto.comHabilitacao();
    const { formularios } = store.draft().formulario;
    const novo = { ...formularios[formularios.length - 1], conteudo: inscricaoGravada() };
    store.patchObjectSection('formulario', { formularios: [...formularios.slice(0, -1), novo] });
    const rotaNovo = ROTA_HABILITACAO;
    const cronogramaFases = [
      ...PROCESSO.cronogramaFases,
      { id: 'F-HABILITACAO', codigo: 'HABILITACAO', coletaInscricao: false },
    ];

    const gravacao = fixture.componentInstance.persistir();
    controller.expectOne(ROTA_PROCESSO).flush({ ...PROCESSO, cronogramaFases });
    await proximoPasso();
    controller.expectOne(rotaNovo).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(`${rotaNovo}/itens`).flush(
      {
        type: 'about:blank',
        title: 'Recusado.',
        status: 422,
        code: 'uniplus.selecao.formulario.item_invalido',
        traceId: '00000000000000000000000000000004',
        errors: [{ field: 'itens[0].rotulo', code: 'x', message: 'Rótulo recusado.' }],
      },
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
    );
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush({
      ...PROCESSO,
      cronogramaFases,
      formularios: [
        ...PROCESSO.formularios,
        { ...PROCESSO.formularios[0], codigo: 'HABILITACAO', faseId: 'F-HABILITACAO' },
      ],
    });

    expect((await gravacao).valid).toBe(false);
    const aba = formularioDoCodigo(store.draft().formulario, 'HABILITACAO');
    expect(aba?.gravado).toBe(true);
    expect(aba?.conteudo).toEqual(novo.conteudo);
    expect(
      fixture.debugElement.injector.get(GravacaoDosFormularios).recusas().has('HABILITACAO'),
    ).toBe(true);
  });
});

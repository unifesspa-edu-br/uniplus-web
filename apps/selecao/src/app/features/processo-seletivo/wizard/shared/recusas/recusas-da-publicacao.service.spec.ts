import { TestBed } from '@angular/core/testing';
import type { ProblemDetails, ProblemValidationError } from '@uniplus/shared-core/http';
import { StatusProcesso, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { umaFaseDoCronograma } from '../fase-do-cronograma.testing';
import { NumeracaoDasRespostasRecusadas } from './numeracao-das-respostas-recusadas';
import { RecusasDaPublicacao, recusasDaResposta, SEM_CAMPO } from './recusas-da-publicacao.service';

const PAGINAS = 'https://erros.exemplo.unifesspa.edu.br/erros/';
const CODIGO_A = 'uniplus.selecao.processo_seletivo.codigo_a';
const CODIGO_B = 'uniplus.selecao.processo_seletivo.codigo_b';
const TITULO = 'A configuração não pode ser publicada.';

function problema(...erros: ProblemValidationError[]): ProblemDetails {
  return {
    type: `${PAGINAS}uniplus.validacao`,
    title: 'Validação',
    status: 422,
    code: 'uniplus.validacao',
    traceId: 't',
    errors: erros,
  };
}

const comCampo = (field: string, code = CODIGO_A) => ({ field, code, message: `Sobre ${field}.` });

describe('recusasDaResposta', () => {
  it('leva todas as causas, na ordem da API, com a página de cada código', () => {
    const recusas = recusasDaResposta(
      problema(
        comCampo('/cronograma/fases/1/produtos'),
        comCampo('/cronograma/fases/0/fim', CODIGO_B),
      ),
      4,
    );

    expect(
      recusas.map(({ campo, codigo, ordem, resposta, pagina }) => [
        campo,
        codigo,
        ordem,
        resposta,
        pagina,
      ]),
    ).toEqual([
      ['/cronograma/fases/1/produtos', CODIGO_A, 0, 4, `${PAGINAS}${CODIGO_A}`],
      ['/cronograma/fases/0/fim', CODIGO_B, 1, 4, `${PAGINAS}${CODIGO_B}`],
    ]);
  });

  it('leva a causa geral sem campo, na posição em que a API a deu', () => {
    const recusas = recusasDaResposta(
      problema(comCampo('/cronograma/fases/0/fim'), { code: CODIGO_B, message: 'Geral.' }),
      1,
    );

    expect(recusas.map((recusa) => [recusa.campo, recusa.ordem])).toEqual([
      ['/cronograma/fases/0/fim', 0],
      [SEM_CAMPO, 1],
    ]);
  });

  it('marca a origem como publicação e não as dá como a conferir', () => {
    const [recusa] = recusasDaResposta(problema(comCampo('/x')), 1);

    expect([recusa.origem, recusa.aConferir]).toEqual(['publicacao', false]);
  });

  it('leva os identificadores dos itens de lista que a API deu, e vazios quando não deu', () => {
    const doItem = { lista: 'fases', identificador: 'CLASSIFICACAO' };

    const recusas = recusasDaResposta(
      problema(
        { ...comCampo('fases[0].fim'), identificadores: [doItem] },
        comCampo('fases[1].fim'),
      ),
      1,
    );

    expect(recusas.map((recusa) => recusa.identificadores)).toEqual([[doItem], []]);
  });

  it('devolve nada quando a resposta não traz causas', () => {
    expect(recusasDaResposta(problema(), 1)).toEqual([]);
  });
});

describe('RecusasDaPublicacao', () => {
  let recusas: RecusasDaPublicacao;
  let store: ProcessoSeletivoStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProcessoSeletivoStore, NumeracaoDasRespostasRecusadas, RecusasDaPublicacao],
    });
    recusas = TestBed.inject(RecusasDaPublicacao);
    store = TestBed.inject(ProcessoSeletivoStore);
  });

  it('numera cada resposta recusada com o número seguinte da numeração da página', () => {
    const numeracao = TestBed.inject(NumeracaoDasRespostasRecusadas);
    numeracao.proxima();

    recusas.registrar(problema(comCampo('/a')), TITULO);

    expect(recusas.recusas()[0].resposta).toBe(2);
    expect(numeracao.proxima()).toBe(3);
  });

  it('troca o conjunto inteiro pelas causas da resposta seguinte', () => {
    recusas.registrar(problema(comCampo('/a'), comCampo('/b')), TITULO);

    recusas.registrar(problema(comCampo('/c')), TITULO);

    expect(recusas.recusas().map((recusa) => recusa.campo)).toEqual(['/c']);
  });

  it('guarda o código da resposta, que não é o de nenhuma causa, e o título já resolvido', () => {
    recusas.registrar({ ...problema(comCampo('/a')), code: 'uniplus.validacao' }, TITULO);

    expect(recusas.resposta()).toEqual({ codigo: 'uniplus.validacao', titulo: TITULO });
  });

  it('guarda o código e o título da resposta que não traz causas', () => {
    recusas.registrar({ ...problema(), code: CODIGO_B }, TITULO);

    expect([recusas.resposta(), recusas.recusas()]).toEqual([
      { codigo: CODIGO_B, titulo: TITULO },
      [],
    ]);
  });

  it('não tem resposta antes de qualquer recusa', () => {
    expect(recusas.resposta()).toBeNull();
  });

  it('troca o código e o título junto com as causas na resposta seguinte', () => {
    recusas.registrar({ ...problema(comCampo('/a')), code: CODIGO_A }, 'Primeira.');

    recusas.registrar({ ...problema(comCampo('/b')), code: CODIGO_B }, 'Segunda.');

    expect(recusas.resposta()).toEqual({ codigo: CODIGO_B, titulo: 'Segunda.' });
  });

  it('guarda o cronograma que a publicação conferiu, enquanto a resposta vale', () => {
    expect(recusas.cronogramaDaResposta()).toBeNull();
    store.patchObjectSection('cronograma', { fases: [umaFaseDoCronograma()] });

    recusas.registrar(problema(comCampo('/a')), TITULO);
    store.patchObjectSection('cronograma', { fases: [] });

    expect(recusas.cronogramaDaResposta()?.fases).toHaveLength(1);
    recusas.limpar();
    expect(recusas.cronogramaDaResposta()).toBeNull();
  });

  it('esquece o destino do "Ir ao campo" ao limpar', () => {
    recusas.registrar(problema(comCampo('/a')), TITULO);
    recusas.destino.set(recusas.recusas()[0]);

    recusas.limpar();

    expect(recusas.destino()).toBeNull();
  });

  it('esvazia ao limpar', () => {
    recusas.registrar(problema(comCampo('/a')), TITULO);

    recusas.limpar();

    expect([recusas.recusas(), recusas.resposta()]).toEqual([[], null]);
  });

  it('esvazia quando muda o processo', () => {
    recusas.registrar(problema(comCampo('/a')), TITULO);

    store.geracao.update((geracao) => geracao + 1);
    TestBed.tick();

    expect([recusas.recusas(), recusas.resposta()]).toEqual([[], null]);
  });

  it('esvazia quando o servidor diz que o processo saiu do rascunho', () => {
    recusas.registrar(problema(comCampo('/a')), TITULO);

    store.remoteSnapshot.set({ id: 'p1', status: StatusProcesso.publicado } as ProcessoSeletivoDto);
    TestBed.tick();

    expect(recusas.recusas()).toEqual([]);
  });

  it('mantém as recusas enquanto o processo segue em rascunho', () => {
    recusas.registrar(problema(comCampo('/a')), TITULO);

    store.remoteSnapshot.set({ id: 'p1', status: StatusProcesso.rascunho } as ProcessoSeletivoDto);
    TestBed.tick();

    expect(recusas.recusas()).toHaveLength(1);
  });

  it('considera o rascunho alterado só depois que o cronograma muda', () => {
    recusas.registrar(problema(comCampo('/a')), TITULO);
    expect(recusas.rascunhoAlterado()).toBe(false);

    store.patchObjectSection('cronograma', { fases: [umaFaseDoCronograma()] });

    expect(recusas.rascunhoAlterado()).toBe(true);
  });

  it('considera o rascunho alterado quando muda parte fora do cronograma', () => {
    recusas.registrar(problema(comCampo('/a')), TITULO);

    store.patchObjectSection('identificacao', { nome: 'Nome corrigido' });

    expect(recusas.rascunhoAlterado()).toBe(true);
  });

  it('não considera alterado o rascunho reescrito com o mesmo conteúdo', () => {
    store.patchObjectSection('cronograma', { fases: [umaFaseDoCronograma()] });
    recusas.registrar(problema(comCampo('/a')), TITULO);

    store.patchObjectSection('cronograma', { fases: [umaFaseDoCronograma()] });

    expect(recusas.rascunhoAlterado()).toBe(false);
  });

  it('não considera alterado o rascunho sem recusas', () => {
    store.patchObjectSection('cronograma', { fases: [umaFaseDoCronograma()] });

    expect(recusas.rascunhoAlterado()).toBe(false);
  });

  it('volta a conferir o cronograma da tentativa nova, e não o da anterior', () => {
    recusas.registrar(problema(comCampo('/a')), TITULO);
    store.patchObjectSection('cronograma', { fases: [umaFaseDoCronograma()] });

    recusas.registrar(problema(comCampo('/a')), TITULO);

    expect(recusas.rascunhoAlterado()).toBe(false);
  });
});

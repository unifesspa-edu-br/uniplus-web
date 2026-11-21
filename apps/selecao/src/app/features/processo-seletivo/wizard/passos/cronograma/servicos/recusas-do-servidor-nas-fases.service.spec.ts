import { TestBed } from '@angular/core/testing';
import type { RecusaDoProblema } from '@uniplus/shared-core/http';
import { beforeEach, describe, expect, it } from 'vitest';

import type { FaseDoCronograma, RecursoDaFase } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from '../../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { umaFaseDoCronograma } from '../../../shared/fase-do-cronograma.testing';
import type { ControleNaTela } from './distribuicao-das-recusas-das-fases';
import { faseComoNoFormulario } from '../cronograma-form';
import { RecusasDoServidorNasFases } from './recusas-do-servidor-nas-fases.service';
import { SEM_RECUSAS_DA_PUBLICACAO } from './recusas-da-publicacao-no-cronograma.testing';

const PRIMEIRA = umaFaseDoCronograma({ faseCanonicaId: 'fase-a', codigo: 'A', ordem: 1 });
const SEGUNDA = umaFaseDoCronograma({ faseCanonicaId: 'fase-b', codigo: 'B', ordem: 2 });

const COM_DUAS_PUBLICACOES = umaFaseDoCronograma({
  ...PRIMEIRA,
  produtos: [
    { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
    { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
  ],
});

const TUDO_NA_TELA: ControleNaTela = () => true;

function registrar(
  recusasDasFases: RecusasDoServidorNasFases,
  resposta: number,
  enviadas: readonly FaseDoCronograma[],
  recusas: readonly RecusaDoProblema[],
) {
  return recusasDasFases.registrar(resposta, enviadas, recusas, TUDO_NA_TELA);
}

function recusa(campo: string, ordem = 0, codigo = 'uniplus.selecao.codigo_a'): RecusaDoProblema {
  return {
    campo,
    codigo,
    mensagem: `Mensagem de ${campo}.`,
    pagina: null,
    ordem,
    identificadores: [],
  };
}

describe('RecusasDoServidorNasFases', () => {
  let recusasNasFases: RecusasDoServidorNasFases;
  let store: ProcessoSeletivoStore;

  const noRascunho = (...fases: FaseDoCronograma[]) =>
    store.patchObjectSection('cronograma', { fases });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProcessoSeletivoStore, RecusasDoServidorNasFases, SEM_RECUSAS_DA_PUBLICACAO],
    });
    recusasNasFases = TestBed.inject(RecusasDoServidorNasFases);
    store = TestBed.inject(ProcessoSeletivoStore);
    noRascunho(PRIMEIRA, SEGUNDA);
  });

  it('põe a recusa na fase que o envio tinha naquela posição, e não na que o rascunho tem', () => {
    registrar(recusasNasFases, 1, [PRIMEIRA, SEGUNDA], [recusa('fases[1].produtos[0]')]);

    noRascunho({ ...SEGUNDA, ordem: 1 }, { ...PRIMEIRA, ordem: 2 });

    expect(recusasNasFases.recusasDoCampo('fase-b', 'produtos')).toHaveLength(1);
    expect(recusasNasFases.recusasDoCampo('fase-a', 'produtos')).toHaveLength(0);
  });

  it('devolve as recusas que não acharam fase, para o resumo', () => {
    const { semLugar } = registrar(
      recusasNasFases,
      1,
      [PRIMEIRA],
      [recusa('fases[4].produtos'), recusa('etapas[0].nome'), recusa('fases[0].produtos')],
    );

    expect(semLugar.map((r) => r.campo)).toEqual(['fases[4].produtos', 'etapas[0].nome']);
  });

  it('devolve ao resumo a recusa de campo cujo controle a tela não mostra, sem guardá-la', () => {
    const semControle: ControleNaTela = (_fase, campo) => campo !== 'inicio' && campo !== 'fim';

    const { semLugar } = recusasNasFases.registrar(
      1,
      [PRIMEIRA],
      [recusa('fases[0].inicio'), recusa('fases[0].fim', 1), recusa('fases[0].produtos', 2)],
      semControle,
    );

    expect(semLugar.map((r) => r.campo)).toEqual(['fases[0].inicio', 'fases[0].fim']);
    expect(recusasNasFases.recusasDaFase('fase-a').map((r) => r.campo)).toEqual(['produtos']);
  });

  it.each(['fases[0].codigo', 'fases[0].bancas[x]', 'fases[0].regraRecurso.campoQueNaoExiste'])(
    'devolve ao resumo a recusa de %s, que a fase não conhece, sem guardá-la',
    (field) => {
      const { semLugar } = registrar(recusasNasFases, 1, [PRIMEIRA], [recusa(field)]);

      expect(semLugar.map((r) => r.campo)).toEqual([field]);
      expect(recusasNasFases.recusasDaFase('fase-a')).toEqual([]);
    },
  );

  it('devolve ao resumo a recusa da fase que já saiu do rascunho, sem guardá-la', () => {
    noRascunho(PRIMEIRA);

    const { semLugar } = registrar(
      recusasNasFases,
      1,
      [PRIMEIRA, SEGUNDA],
      [recusa('fases[1].produtos'), recusa('fases[0].produtos', 1)],
    );

    expect(semLugar.map((r) => r.campo)).toEqual(['fases[1].produtos']);
    expect(recusasNasFases.recusasDaFase('fase-b')).toEqual([]);
    expect(recusasNasFases.recusasDaFase('fase-a')).toHaveLength(1);
  });

  it('pergunta o controle pela fase que o envio tinha naquela posição', () => {
    const perguntas: string[] = [];

    recusasNasFases.registrar(
      1,
      [PRIMEIRA, SEGUNDA],
      [recusa('fases[1].unidadeResponsavelId')],
      (id, campo) => {
        perguntas.push(`${id}:${campo}`);
        return true;
      },
    );

    expect(perguntas).toEqual(['fase-b:unidadeResponsavelId']);
  });

  it('descarta as recusas quando o passo Cronograma deixa de ser o corrente', () => {
    store.irParaFase('A');
    TestBed.tick();
    registrar(recusasNasFases, 1, [PRIMEIRA], [recusa('fases[0].produtos')]);

    store.goTo(0);
    TestBed.tick();

    expect(recusasNasFases.recusasDaFase('fase-a')).toEqual([]);
  });

  it('mantém as recusas registradas com o passo escondido quando ele passa a ser o corrente', () => {
    TestBed.tick();
    registrar(recusasNasFases, 1, [PRIMEIRA], [recusa('fases[0].produtos')]);

    store.irParaFase('A');
    TestBed.tick();

    expect(recusasNasFases.recusasDaFase('fase-a')).toHaveLength(1);
  });

  it('põe no topo da fase a recusa que não aponta campo que a tela mostre', () => {
    registrar(recusasNasFases, 1, [PRIMEIRA], [recusa('fases[0].tiposDeDecisao[0]')]);

    expect(recusasNasFases.recusasDaFase('fase-a').map((r) => r.campo)).toEqual(['']);
  });

  it('lê a recusa do campo na ordem em que a API a deu dentro da mesma resposta', () => {
    noRascunho(COM_DUAS_PUBLICACOES);
    const depois = recusa('fases[0].produtos[0].atoCodigo', 3, 'uniplus.selecao.c');
    const antes = recusa('fases[0].produtos[0].atoCodigo', 1, 'uniplus.selecao.b');

    registrar(recusasNasFases, 1, [COM_DUAS_PUBLICACOES], [depois, antes]);

    const doCampo = recusasNasFases.recusasDoCampo('fase-a', 'produtos.0.atoCodigo');
    expect(doCampo.map((r) => r.ordem)).toEqual([1, 3]);
  });

  it('guarda sob o campo de cada linha a recusa dela, mesmo com a mesma recusa em várias linhas', () => {
    noRascunho(COM_DUAS_PUBLICACOES);
    const daSegunda = recusa('fases[0].produtos[1].atoCodigo', 3);
    const daPrimeira = recusa('fases[0].produtos[0].atoCodigo', 1);

    registrar(recusasNasFases, 1, [COM_DUAS_PUBLICACOES], [daSegunda, daPrimeira]);

    const ordemDe = (campo: 'produtos.0.atoCodigo' | 'produtos.1.atoCodigo') =>
      recusasNasFases.recusasDoCampo('fase-a', campo).map((r) => r.ordem);
    expect(ordemDe('produtos.0.atoCodigo')).toEqual([1]);
    expect(ordemDe('produtos.1.atoCodigo')).toEqual([3]);
    expect(recusasNasFases.recusasDoCampo('fase-a', 'produtos')).toEqual([]);
  });

  it('põe na lista a recusa à linha que a fase enviada não tinha', () => {
    noRascunho(COM_DUAS_PUBLICACOES);

    registrar(recusasNasFases, 1, [COM_DUAS_PUBLICACOES], [recusa('fases[0].produtos[2].papel')]);

    expect(recusasNasFases.recusasDoCampo('fase-a', 'produtos')).toHaveLength(1);
  });

  it('troca tudo pelas recusas da resposta seguinte', () => {
    registrar(recusasNasFases, 1, [PRIMEIRA], [recusa('fases[0].produtos')]);

    registrar(recusasNasFases, 2, [PRIMEIRA], [recusa('fases[0].bancasRequeridas[0]')]);

    expect(recusasNasFases.recusasDaFase('fase-a').map((r) => r.campo)).toEqual([
      'bancasRequeridas',
    ]);
  });

  it('esquece tudo ao limpar', () => {
    registrar(recusasNasFases, 1, [PRIMEIRA], [recusa('fases[0].produtos')]);

    recusasNasFases.limpar();

    expect(recusasNasFases.recusasDaFase('fase-a')).toEqual([]);
  });

  it('esquece tudo quando muda o processo', () => {
    registrar(recusasNasFases, 1, [PRIMEIRA], [recusa('fases[0].produtos')]);

    store.geracao.update((geracao) => geracao + 1);
    TestBed.tick();

    expect(recusasNasFases.recusasDaFase('fase-a')).toEqual([]);
  });

  it('esquece a recusa da fase que saiu do rascunho', () => {
    registrar(recusasNasFases, 1, [PRIMEIRA, SEGUNDA], [recusa('fases[1].produtos')]);

    noRascunho(PRIMEIRA);

    expect(recusasNasFases.recusasDaFase('fase-b')).toEqual([]);
  });
});

describe('RecusasDoServidorNasFases: a conferir de novo', () => {
  let recusasNasFases: RecusasDoServidorNasFases;
  let store: ProcessoSeletivoStore;
  const REGRA: RecursoDaFase = {
    regraCodigo: 'R',
    regraVersao: '1',
    ...PARAMETROS_SEM_INSTANCIA_SUPERIOR,
    prazoValor: '3',
    atoAncoraCodigo: '',
    admiteInstanciaSuperior: null,
    leitura: umaLeituraDoRecurso(),
    procedimentos: [],
  };
  const COM_REGRA: FaseDoCronograma = { ...PRIMEIRA, regraRecurso: REGRA };

  /** Escreve o rascunho como o formulário escreve: a escrita avisa as recusas das fases na hora. */
  const alterar = (fase: FaseDoCronograma) => {
    store.patchObjectSection('cronograma', { fases: [fase] });
    recusasNasFases.registrarAlteracao();
  };
  const estado = (campo: 'produtos' | 'recurso.prazoValor') =>
    recusasNasFases.recusasDaFase('fase-a').find((r) => r.campo === campo)?.aConferir;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProcessoSeletivoStore, RecusasDoServidorNasFases, SEM_RECUSAS_DA_PUBLICACAO],
    });
    recusasNasFases = TestBed.inject(RecusasDoServidorNasFases);
    store = TestBed.inject(ProcessoSeletivoStore);
    TestBed.tick();
    alterar(COM_REGRA);
    registrar(
      recusasNasFases,
      1,
      [COM_REGRA],
      [recusa('fases[0].produtos'), recusa('fases[0].regraRecurso.prazoValor', 1)],
    );
  });

  it('começa com as recusas ativas', () => {
    expect([estado('produtos'), estado('recurso.prazoValor')]).toEqual([false, false]);
  });

  it('passa a recusa da fase a conferir quando a fase muda, e deixa a da regra de recurso', () => {
    alterar({ ...COM_REGRA, fim: '2026-04-01T18:00:00-03:00' });

    expect([estado('produtos'), estado('recurso.prazoValor')]).toEqual([true, false]);
  });

  it('passa a recusa da regra de recurso a conferir quando ela muda, e deixa a da fase', () => {
    alterar({ ...COM_REGRA, regraRecurso: { ...REGRA, prazoValor: '5' } });

    expect([estado('produtos'), estado('recurso.prazoValor')]).toEqual([false, true]);
  });

  it('não conta a mudança de posição como alteração da fase', () => {
    alterar({ ...COM_REGRA, ordem: 7 });

    expect(estado('produtos')).toBe(false);
  });

  it('escolhe a primeira recusa ativa e ignora as que estão a conferir', () => {
    alterar({ ...COM_REGRA, fim: '2026-04-01T18:00:00-03:00' });

    expect(recusasNasFases.primeiraRecusaAtiva()?.recusa.campo).toBe('recurso.prazoValor');
  });

  it('não tem primeira recusa ativa quando todas estão a conferir ou não há nenhuma', () => {
    alterar({ ...COM_REGRA, fim: '2026-04-01T18:00:00-03:00', regraRecurso: null });
    expect(recusasNasFases.primeiraRecusaAtiva()).toBeNull();
    recusasNasFases.limpar();
    expect(recusasNasFases.primeiraRecusaAtiva()).toBeNull();
  });

  it('mantém a recusa da fase a conferir mesmo ao desfazer a alteração antes do próximo ciclo', () => {
    alterar({ ...COM_REGRA, fim: '2026-04-01T18:00:00-03:00' });

    alterar(COM_REGRA);

    expect([estado('produtos'), estado('recurso.prazoValor')]).toEqual([true, false]);
  });

  it('mantém a recusa da regra de recurso a conferir mesmo ao desfazer a alteração antes do próximo ciclo', () => {
    alterar({ ...COM_REGRA, regraRecurso: { ...REGRA, prazoValor: '5' } });

    alterar(COM_REGRA);

    expect([estado('produtos'), estado('recurso.prazoValor')]).toEqual([false, true]);
  });

  it('volta a valer a recusa quando a resposta seguinte a traz de novo', () => {
    alterar({ ...COM_REGRA, fim: '2026-04-01T18:00:00-03:00' });
    alterar(COM_REGRA);

    registrar(recusasNasFases, 2, [COM_REGRA], [recusa('fases[0].produtos')]);

    expect(estado('produtos')).toBe(false);
  });

  it('volta a valer a recusa que a resposta traz com a fase já alterada e depois desfeita', () => {
    alterar({ ...COM_REGRA, fim: '2026-04-01T18:00:00-03:00' });
    registrar(
      recusasNasFases,
      2,
      [{ ...COM_REGRA, fim: '2026-04-01T18:00:00-03:00' }],
      [recusa('fases[0].produtos')],
    );

    expect(estado('produtos')).toBe(false);
  });

  it('não põe a conferir a recusa de fase que o rascunho traz com a janela em outro formato', () => {
    const doServidor: FaseDoCronograma = { ...PRIMEIRA, inicio: '2026-04-01T21:00:00Z' };
    store.patchObjectSection('cronograma', { fases: [doServidor] });

    registrar(
      recusasNasFases,
      1,
      [faseComoNoFormulario(doServidor)],
      [recusa('fases[0].produtos')],
    );

    expect(estado('produtos')).toBe(false);
  });
});

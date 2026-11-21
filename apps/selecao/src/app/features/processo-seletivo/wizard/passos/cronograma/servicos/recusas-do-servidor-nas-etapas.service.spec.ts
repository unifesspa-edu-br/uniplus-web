import type { FormGroup } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import type { RecusaDoProblema } from '@uniplus/shared-core/http';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  umaEtapaDoCronograma,
  umRecursoDaEtapa,
} from '../../../shared/etapa-do-cronograma.testing';
import type { CampoDaRecusaDaEtapa } from '../campo-da-etapa';
import { etapaDoFormulario, grupoDaEtapa, type EtapaForm } from '../cronograma-form';
import type { ControleNaTelaDaEtapa } from './distribuicao-das-recusas-das-etapas';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';
import { RecusasDoServidorNasEtapas } from './recusas-do-servidor-nas-etapas.service';
import { novoFormularioDoCronograma } from '../cronograma-form';

const TUDO_NA_TELA: ControleNaTelaDaEtapa = () => true;

function recusa(campo: string, ordem = 0, codigo = 'uniplus.selecao.codigo_a'): RecusaDoProblema {
  return { campo, codigo, mensagem: `Mensagem de ${campo}.`, pagina: null, ordem };
}

describe('RecusasDoServidorNasEtapas', () => {
  let recusasNasEtapas: RecusasDoServidorNasEtapas;
  let store: ProcessoSeletivoStore;
  const formulario = novoFormularioDoCronograma();
  let primeira: FormGroup<EtapaForm>;
  let segunda: FormGroup<EtapaForm>;

  /** Registra a resposta como a gravação o faz: com o que cada formulário valia ao enviar. */
  const registrar = (
    resposta: number,
    recusas: readonly RecusaDoProblema[],
    controleNaTela: ControleNaTelaDaEtapa = TUDO_NA_TELA,
  ) => {
    const grupos = [...formulario.controls.etapas.controls];
    return recusasNasEtapas.registrar(
      resposta,
      { grupos, etapasNoFormulario: grupos.map(etapaDoFormulario) },
      recusas,
      controleNaTela,
    );
  };
  const campos = (grupo: FormGroup<EtapaForm>, campo: CampoDaRecusaDaEtapa) =>
    recusasNasEtapas.recusasDoCampo(grupo, campo).map((r) => r.campo);

  beforeEach(() => {
    formulario.controls.etapas.clear();
    primeira = grupoDaEtapa(umaEtapaDoCronograma({ nome: 'Prova', ordem: 1 }));
    segunda = grupoDaEtapa(umaEtapaDoCronograma({ nome: 'Redação', ordem: 2 }));
    formulario.controls.etapas.push(primeira);
    formulario.controls.etapas.push(segunda);
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        RecusasDoServidorNasEtapas,
        {
          provide: FormularioDoCronograma,
          useValue: { formulario, etapas: formulario.controls.etapas },
        },
      ],
    });
    recusasNasEtapas = TestBed.inject(RecusasDoServidorNasEtapas);
    store = TestBed.inject(ProcessoSeletivoStore);
    TestBed.tick();
  });

  it('põe a recusa na etapa que o envio tinha naquela posição, e não na que o formulário tem', () => {
    registrar(1, [recusa('etapas[1].notaMaxima')]);

    formulario.controls.etapas.removeAt(0);
    formulario.controls.etapas.push(primeira);

    expect(recusasNasEtapas.recusasDoCampo(segunda, 'notaMaxima')).toHaveLength(1);
    expect(recusasNasEtapas.recusasDoCampo(primeira, 'notaMaxima')).toHaveLength(0);
  });

  it('devolve as recusas que não acharam etapa, para o resumo', () => {
    const { semLugar } = registrar(1, [
      recusa('etapas[4].notaMaxima'),
      recusa('fases[0].produtos'),
      recusa('etapas[0].notaMaxima'),
    ]);

    expect(semLugar.map((r) => r.campo)).toEqual(['etapas[4].notaMaxima', 'fases[0].produtos']);
  });

  it('devolve ao resumo a recusa de campo cujo controle a tela não mostra, sem guardá-la', () => {
    const semNota: ControleNaTelaDaEtapa = (_grupo, campo) => campo !== 'notaMinima';

    const { semLugar } = registrar(
      1,
      [recusa('etapas[0].notaMinima'), recusa('etapas[0].bancas[0]', 1)],
      semNota,
    );

    expect(semLugar.map((r) => r.campo)).toEqual(['etapas[0].notaMinima']);
    expect(campos(primeira, 'bancas')).toEqual(['bancas']);
  });

  it('pergunta o controle pela etapa que o envio tinha naquela posição', () => {
    const perguntas: (FormGroup<EtapaForm> | string)[] = [];

    registrar(1, [recusa('etapas[1].notaMaxima')], (grupo, campo) => {
      perguntas.push(grupo, campo);
      return true;
    });

    expect(perguntas).toEqual([segunda, 'notaMaxima']);
  });

  it('põe no topo da etapa a recusa que não aponta campo que a tela mostre', () => {
    registrar(1, [recusa('etapas[0].nome')]);

    expect(campos(primeira, '')).toEqual(['']);
  });

  it('lê a recusa do campo na ordem em que a API a deu dentro da mesma resposta', () => {
    registrar(1, [
      recusa('etapas[0].itensDeAvaliacao', 3, 'uniplus.selecao.c'),
      recusa('etapas[0].itensDeAvaliacao[0].id', 1, 'uniplus.selecao.b'),
    ]);

    const ordens = recusasNasEtapas
      .recusasDoCampo(primeira, 'itensDeAvaliacao')
      .map((r) => r.ordem);

    expect(ordens).toEqual([1, 3]);
  });

  it('guarda a recusa do recurso pela posição dele no formulário enviado', () => {
    primeira.controls.recursos.setValue([
      umRecursoDaEtapa(),
      umRecursoDaEtapa(),
      umRecursoDaEtapa(),
    ]);

    registrar(1, [recusa('etapas[0].recursos[2].prazoValor')]);

    expect(campos(primeira, 'recursos.2.prazoValor')).toEqual(['recursos.2.prazoValor']);
  });

  it('conta como o comando conta: o recurso sem regra não viaja e não tem posição na resposta', () => {
    const semRegra = umRecursoDaEtapa({ regraCodigo: '', regraVersao: '' });
    primeira.controls.recursos.setValue([semRegra, umRecursoDaEtapa(), umRecursoDaEtapa()]);

    registrar(1, [recusa('etapas[0].recursos[1].prazoValor')]);

    expect(campos(primeira, 'recursos.1.prazoValor')).toEqual([]);
    expect(campos(primeira, 'recursos.2.prazoValor')).toEqual(['recursos.2.prazoValor']);
  });

  it('manda ao resumo a recusa do recurso que o envio não levou', () => {
    primeira.controls.recursos.setValue([umRecursoDaEtapa()]);

    const { semLugar } = registrar(1, [recusa('etapas[0].recursos[3].prazoValor')]);

    expect(semLugar).toHaveLength(1);
  });

  it.each(['etapas[0].id', 'etapas[0].campoQueNaoExiste', 'etapas[0].bancas[x]'])(
    'manda ao resumo a recusa de %s, que a etapa não conhece',
    (field) => {
      const { semLugar, porEtapa } = registrar(1, [recusa(field)]);

      expect(semLugar.map((r) => r.campo)).toEqual([field]);
      expect(porEtapa.size).toBe(0);
    },
  );

  it('manda ao resumo a recusa de um campo que o recurso não conhece', () => {
    primeira.controls.recursos.setValue([umRecursoDaEtapa()]);

    const { semLugar } = registrar(1, [recusa('etapas[0].recursos[0].campoQueNaoExiste')]);

    expect(semLugar).toHaveLength(1);
  });

  it.each(['etapas[0]', 'etapas[0].nome', 'etapas[0].tiposDeDecisao[1]'])(
    'põe no topo da etapa a recusa de %s, que a etapa conhece sem controle de recusa',
    (field) => {
      registrar(1, [recusa(field)]);

      expect(campos(primeira, '')).toEqual(['']);
    },
  );

  it.each([
    'etapas[0].recursos[0]',
    'etapas[0].recursos[0].procedimentos[1]',
    'etapas[0].recursos[0].regraCodigo',
  ])('põe no recurso inteiro a recusa de %s', (field) => {
    primeira.controls.recursos.setValue([umRecursoDaEtapa()]);

    registrar(1, [recusa(field)]);

    expect(campos(primeira, 'recursos.0.recurso')).toEqual(['recursos.0.recurso']);
  });

  it('troca tudo pelas recusas da resposta seguinte', () => {
    registrar(1, [recusa('etapas[0].notaMaxima')]);

    registrar(2, [recusa('etapas[0].notaMinima')]);

    expect(campos(primeira, 'notaMaxima')).toEqual([]);
    expect(campos(primeira, 'notaMinima')).toEqual(['notaMinima']);
  });

  it('esquece tudo ao limpar', () => {
    registrar(1, [recusa('etapas[0].notaMaxima')]);

    recusasNasEtapas.limpar();

    expect(campos(primeira, 'notaMaxima')).toEqual([]);
  });

  it('esquece tudo quando muda o processo', () => {
    registrar(1, [recusa('etapas[0].notaMaxima')]);

    store.geracao.update((geracao) => geracao + 1);
    TestBed.tick();

    expect(campos(primeira, 'notaMaxima')).toEqual([]);
  });

  it('descarta as recusas quando o passo Cronograma deixa de ser o corrente', () => {
    store.irParaFase('A');
    TestBed.tick();
    registrar(1, [recusa('etapas[0].notaMaxima')]);

    store.goTo(0);
    TestBed.tick();

    expect(campos(primeira, 'notaMaxima')).toEqual([]);
  });

  it('mantém as recusas registradas com o passo escondido quando ele passa a ser o corrente', () => {
    TestBed.tick();
    registrar(1, [recusa('etapas[0].notaMaxima')]);

    store.irParaFase('A');
    TestBed.tick();

    expect(campos(primeira, 'notaMaxima')).toHaveLength(1);
  });

  it('esquece a recusa da etapa que saiu do formulário', () => {
    registrar(1, [recusa('etapas[1].notaMaxima')]);

    formulario.controls.etapas.removeAt(1);

    expect(campos(segunda, 'notaMaxima')).toEqual([]);
  });
});

describe('RecusasDoServidorNasEtapas: a conferir de novo', () => {
  let recusasNasEtapas: RecusasDoServidorNasEtapas;
  const formulario = novoFormularioDoCronograma();
  let etapa: FormGroup<EtapaForm>;

  const registrar = (resposta: number, recusas: readonly RecusaDoProblema[]) => {
    const grupos = [...formulario.controls.etapas.controls];
    recusasNasEtapas.registrar(
      resposta,
      { grupos, etapasNoFormulario: grupos.map(etapaDoFormulario) },
      recusas,
      TUDO_NA_TELA,
    );
  };
  const aConferir = (campo: CampoDaRecusaDaEtapa) =>
    recusasNasEtapas.recusasDoCampo(etapa, campo)[0]?.aConferir;
  const estados = () => [aConferir('notaMaxima'), aConferir('recursos.0.prazoValor')];

  beforeEach(() => {
    formulario.controls.etapas.clear();
    etapa = grupoDaEtapa(umaEtapaDoCronograma({ recursos: [umRecursoDaEtapa()] }));
    formulario.controls.etapas.push(etapa);
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        RecusasDoServidorNasEtapas,
        {
          provide: FormularioDoCronograma,
          useValue: { formulario, etapas: formulario.controls.etapas },
        },
      ],
    });
    recusasNasEtapas = TestBed.inject(RecusasDoServidorNasEtapas);
    TestBed.tick();
    registrar(1, [recusa('etapas[0].notaMaxima'), recusa('etapas[0].recursos[0].prazoValor', 1)]);
  });

  const mudarRecurso = (prazoValor: string) =>
    etapa.controls.recursos.setValue([umRecursoDaEtapa({ prazoValor })]);

  it('começa com as recusas ativas', () => {
    expect(estados()).toEqual([false, false]);
  });

  it('passa a recusa da etapa a conferir quando a etapa muda, e deixa a do recurso', () => {
    etapa.controls.notaMaxima.setValue('20');

    expect(estados()).toEqual([true, false]);
  });

  it('passa a recusa do recurso a conferir quando ele muda, e deixa a da etapa', () => {
    mudarRecurso('5');

    expect(estados()).toEqual([false, true]);
  });

  it('não conta a mudança de posição como alteração da etapa', () => {
    etapa.controls.ordem.setValue(7);

    expect(estados()).toEqual([false, false]);
  });

  it('mantém a recusa a conferir mesmo ao desfazer a alteração', () => {
    etapa.controls.notaMaxima.setValue('20');

    etapa.controls.notaMaxima.setValue('10');

    expect(estados()).toEqual([true, false]);
  });

  it('mantém a recusa do recurso a conferir mesmo ao desfazer a alteração', () => {
    mudarRecurso('5');

    mudarRecurso('3');

    expect(estados()).toEqual([false, true]);
  });

  it('escolhe a primeira recusa ativa e ignora as que estão a conferir', () => {
    etapa.controls.notaMaxima.setValue('20');

    expect(recusasNasEtapas.primeiraRecusaAtiva()?.recusa.campo).toBe('recursos.0.prazoValor');
  });

  it('não tem primeira recusa ativa quando todas estão a conferir ou não há nenhuma', () => {
    etapa.controls.notaMaxima.setValue('20');
    mudarRecurso('5');
    expect(recusasNasEtapas.primeiraRecusaAtiva()).toBeNull();
    recusasNasEtapas.limpar();
    expect(recusasNasEtapas.primeiraRecusaAtiva()).toBeNull();
  });

  it('volta a valer a recusa que a resposta seguinte traz, mesmo depois de alterada e desfeita', () => {
    etapa.controls.notaMaxima.setValue('20');
    etapa.controls.notaMaxima.setValue('10');

    registrar(2, [recusa('etapas[0].notaMaxima')]);

    expect(aConferir('notaMaxima')).toBe(false);
  });

  it('já traz a conferir a recusa da resposta que chega com a etapa alterada no meio do envio', () => {
    const grupos = [etapa];
    const enviada = grupos.map(etapaDoFormulario);
    etapa.controls.notaMaxima.setValue('20');

    recusasNasEtapas.registrar(
      2,
      { grupos, etapasNoFormulario: enviada },
      [recusa('etapas[0].notaMaxima')],
      TUDO_NA_TELA,
    );

    expect(aConferir('notaMaxima')).toBe(true);
  });
});

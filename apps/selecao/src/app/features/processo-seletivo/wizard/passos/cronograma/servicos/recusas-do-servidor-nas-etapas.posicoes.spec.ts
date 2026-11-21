import { TestBed } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';
import type { RecusaDoProblema } from '@uniplus/shared-core/http';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ItemDeAvaliacaoDaEtapa, RecursoDaEtapa } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  umaEtapaDoCronograma,
  umRecursoDaEtapa,
} from '../../../shared/etapa-do-cronograma.testing';
import type { CampoDaRecusaDaEtapa } from '../campo-da-etapa';
import {
  type EtapaForm,
  etapaDoFormulario,
  grupoDaEtapa,
  novoFormularioDoCronograma,
} from '../cronograma-form';
import type { ControleNaTelaDaEtapa } from './distribuicao-das-recusas-das-etapas';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';
import { RecusasDoServidorNasEtapas } from './recusas-do-servidor-nas-etapas.service';

const TUDO_NA_TELA: ControleNaTelaDaEtapa = () => true;

const recusa = (campo: string): RecusaDoProblema => ({
  campo,
  codigo: 'uniplus.selecao.codigo_a',
  mensagem: `Mensagem de ${campo}.`,
  pagina: null,
  ordem: 0,
});

const item = (rotulo: string): ItemDeAvaliacaoDaEtapa => ({
  id: null,
  rotulo,
  pontuacaoMaxima: '5',
});

describe('RecusasDoServidorNasEtapas: a recusa segue o item, não a posição', () => {
  let servico: RecusasDoServidorNasEtapas;
  const formulario = novoFormularioDoCronograma();
  let etapa: FormGroup<EtapaForm>;
  let [a, b, c]: RecursoDaEtapa[] = [];

  const registrar = (...campos: string[]) => {
    const grupos = [...formulario.controls.etapas.controls];
    return servico.registrar(
      1,
      { grupos, etapasNoFormulario: grupos.map(etapaDoFormulario) },
      campos.map(recusa),
      TUDO_NA_TELA,
    );
  };
  const mensagens = (campo: CampoDaRecusaDaEtapa) =>
    servico.recusasDoCampo(etapa, campo).map((r) => r.mensagem);
  const remover = (posicao: number) =>
    etapa.controls.recursos.setValue(etapa.controls.recursos.value.filter((_, i) => i !== posicao));

  beforeEach(() => {
    a = umRecursoDaEtapa({ prazoValor: '1' });
    b = umRecursoDaEtapa({ prazoValor: '2' });
    c = umRecursoDaEtapa({ prazoValor: '3' });
    formulario.controls.etapas.clear();
    etapa = grupoDaEtapa(umaEtapaDoCronograma({ recursos: [a, b, c] }));
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
    servico = TestBed.inject(RecusasDoServidorNasEtapas);
    TestBed.tick();
  });

  it('leva a recusa do recurso seguinte para a posição que ele passa a ter ao remover o anterior', () => {
    registrar('etapas[0].recursos[0].prazoValor', 'etapas[0].recursos[1].prazoValor');

    remover(0);

    expect(mensagens('recursos.0.prazoValor')).toEqual([
      'Mensagem de etapas[0].recursos[1].prazoValor.',
    ]);
    expect(mensagens('recursos.1.prazoValor')).toEqual([]);
  });

  it('não passa ao recurso que ocupa o lugar a recusa do recurso removido', () => {
    registrar('etapas[0].recursos[0].prazoValor');

    remover(0);

    expect(mensagens('recursos.0.prazoValor')).toEqual([]);
    expect(servico.primeiraRecusaAtiva()).toBeNull();
  });

  it('mantém a recusa do recurso quando um posterior sai', () => {
    registrar('etapas[0].recursos[0].prazoValor');

    remover(2);

    expect(mensagens('recursos.0.prazoValor')).toHaveLength(1);
  });

  it('não marca como alterado o recurso que só mudou de posição', () => {
    registrar('etapas[0].recursos[1].prazoValor');

    remover(0);

    expect(servico.recusasDoCampo(etapa, 'recursos.0.prazoValor')[0].aConferir).toBe(false);
  });

  it('passa a conferir o recurso que mudou de posição e foi editado depois', () => {
    registrar('etapas[0].recursos[1].prazoValor');
    remover(0);

    etapa.controls.recursos.setValue([{ ...b, prazoValor: '9' }, c]);

    expect(servico.recusasDoCampo(etapa, 'recursos.0.prazoValor')[0].aConferir).toBe(true);
  });

  it('mantém a recusa do recurso editado no lugar', () => {
    registrar('etapas[0].recursos[1].prazoValor');

    etapa.controls.recursos.setValue([a, { ...b, prazoValor: '9' }, c]);

    expect(mensagens('recursos.1.prazoValor')).toHaveLength(1);
  });

  it('acompanha o recurso reordenado', () => {
    registrar('etapas[0].recursos[0].prazoValor');

    etapa.controls.recursos.setValue([b, c, a]);

    expect(mensagens('recursos.2.prazoValor')).toHaveLength(1);
    expect(mensagens('recursos.0.prazoValor')).toEqual([]);
  });

  it('mantém a recusa quando um recurso é acrescentado no fim', () => {
    registrar('etapas[0].recursos[1].prazoValor');

    etapa.controls.recursos.setValue([a, b, c, umRecursoDaEtapa()]);

    expect(mensagens('recursos.1.prazoValor')).toHaveLength(1);
  });

  it('leva a recusa do recurso inteiro junto com o recurso', () => {
    registrar('etapas[0].recursos[2]');

    remover(0);

    expect(mensagens('recursos.1.recurso')).toHaveLength(1);
    expect(mensagens('recursos.2.recurso')).toEqual([]);
  });

  it('leva a recusa do item de avaliação para a posição de hoje ao remover um anterior', () => {
    const itens = [item('Clareza'), item('Método'), item('Coesão')];
    etapa.controls.itensDeAvaliacao.setValue(itens);
    registrar('etapas[0].itensDeAvaliacao[1].rotulo', 'etapas[0].itensDeAvaliacao[0].rotulo');

    etapa.controls.itensDeAvaliacao.setValue([itens[1], itens[2]]);

    expect(mensagens('itensDeAvaliacao.0.rotulo')).toEqual([
      'Mensagem de etapas[0].itensDeAvaliacao[1].rotulo.',
    ]);
    expect(mensagens('itensDeAvaliacao.1.rotulo')).toEqual([]);
  });

  it('descarta a recusa do item removido, sem entregá-la ao que ocupa o lugar', () => {
    const itens = [item('Clareza'), item('Método')];
    etapa.controls.itensDeAvaliacao.setValue(itens);
    registrar('etapas[0].itensDeAvaliacao[0].pontuacaoMaxima');

    etapa.controls.itensDeAvaliacao.setValue([itens[1]]);

    expect(mensagens('itensDeAvaliacao.0.pontuacaoMaxima')).toEqual([]);
  });

  it('segue o nível da escala de atendimento como segue o item', () => {
    const niveis = [
      { rotulo: 'Atende', percentual: '100' },
      { rotulo: 'Atende em parte', percentual: '50' },
    ];
    etapa.controls.escalaDeAtendimento.setValue(niveis);
    registrar('etapas[0].escalaDeAtendimento[1].fracao');

    etapa.controls.escalaDeAtendimento.setValue([niveis[1]]);

    expect(mensagens('escalaDeAtendimento.0.fracao')).toHaveLength(1);
  });

  it('manda ao resumo a recusa do item que já tinha saído quando a resposta chegou', () => {
    const itens = [item('Clareza'), item('Método')];
    etapa.controls.itensDeAvaliacao.setValue(itens);
    const grupos = [etapa];
    const enviadas = { grupos, etapasNoFormulario: grupos.map(etapaDoFormulario) };
    etapa.controls.itensDeAvaliacao.setValue([itens[1]]);

    const { semLugar } = servico.registrar(
      1,
      enviadas,
      [recusa('etapas[0].itensDeAvaliacao[0].rotulo')],
      TUDO_NA_TELA,
    );

    expect(semLugar).toHaveLength(1);
    expect(mensagens('itensDeAvaliacao.0.rotulo')).toEqual([]);
  });

  it('manda ao resumo a recusa do recurso que já tinha saído quando a resposta chegou', () => {
    const grupos = [etapa];
    const enviadas = { grupos, etapasNoFormulario: grupos.map(etapaDoFormulario) };
    remover(0);

    const { semLugar } = servico.registrar(
      1,
      enviadas,
      [recusa('etapas[0].recursos[0].prazoValor')],
      TUDO_NA_TELA,
    );

    expect(semLugar).toHaveLength(1);
  });
});

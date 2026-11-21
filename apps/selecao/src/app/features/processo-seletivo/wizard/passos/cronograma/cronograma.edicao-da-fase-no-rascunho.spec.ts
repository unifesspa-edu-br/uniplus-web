import type { AbstractControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { etapaDoServidor, faseDoServidor } from '../../shared/cronograma-do-servidor.testing';
import { hidratarDraft } from '../../shared/hidratacao';
import { DRAFT, dtoComCronograma } from '../../shared/hidratacao.testing';
import { ID_AVALIACAO, ID_INSCRICAO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

/**
 * A configuração embutida na fase escreve no rascunho sem passar pelo formulário do cronograma. O
 * formulário precisa achar os grupos onde estavam a cada escrita dessas, seja qual for a forma em
 * que o rascunho chegou: um rascunho que só difere na forma não é um cronograma novo, e recriar os
 * controles tira o foco do que o operador acabou de acionar.
 */
describe('CronogramaPassoComponent: edição da fase pelo rascunho', () => {
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let detectar: ContextoDoCronograma['detectar'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];

  usarCronograma((tela) => {
    ({ cronograma, store, detectar, comFases, comUmaEtapa } = tela);
  });

  const gruposDoFormulario = (): AbstractControl[] => [
    ...cronograma.fases.controls,
    ...cronograma.etapas.controls,
  ];

  function esperarOsMesmosGrupos(anteriores: AbstractControl[], rotulo: string): void {
    const atuais = gruposDoFormulario();
    expect(atuais, rotulo).toHaveLength(anteriores.length);
    for (const [posicao, grupo] of anteriores.entries()) {
      expect(atuais[posicao], `${rotulo} (grupo ${posicao})`).toBe(grupo);
    }
  }

  function editarAFaseNoRascunho(posicao: number, tiposDeDecisao: string[]): void {
    const fases = store
      .draft()
      .cronograma.fases.map((fase, indice) =>
        indice === posicao ? { ...fase, tiposDeDecisao } : fase,
      );
    store.patchObjectSection('cronograma', { fases });
    detectar();
  }

  it('a primeira e a segunda edição da fase mantêm os grupos das fases e das etapas', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comUmaEtapa();
    const grupos = gruposDoFormulario();

    editarAFaseNoRascunho(1, ['CLASSIFICACAO']);
    esperarOsMesmosGrupos(grupos, 'primeira edição');

    editarAFaseNoRascunho(1, ['CLASSIFICACAO', 'HABILITACAO']);
    esperarOsMesmosGrupos(grupos, 'segunda edição');
    expect(cronograma.fases.at(1).controls.tiposDeDecisao.value).toStrictEqual([
      'CLASSIFICACAO',
      'HABILITACAO',
    ]);
  });

  it('mantém os grupos quando o rascunho hidratado do servidor tem a fase editada', () => {
    const dto = dtoComCronograma({
      cronogramaFases: [
        faseDoServidor({ faseCanonica: { origemId: ID_INSCRICAO } }),
        faseDoServidor({
          id: 'fase-2',
          codigo: 'HOMOLOGACAO_INSCRICOES',
          faseCanonica: { origemId: ID_AVALIACAO },
        }),
      ],
      etapas: [etapaDoServidor()],
    });
    store.patchObjectSection('cronograma', hidratarDraft(DRAFT, dto).cronograma);
    detectar();
    const grupos = gruposDoFormulario();

    editarAFaseNoRascunho(1, ['CLASSIFICACAO']);
    esperarOsMesmosGrupos(grupos, 'primeira edição');

    editarAFaseNoRascunho(1, []);
    esperarOsMesmosGrupos(grupos, 'segunda edição');
    expect(cronograma.fases.at(1).controls.tiposDeDecisao.value).toStrictEqual([]);
  });
});

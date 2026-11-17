import { FormArray } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { faseDoServidor } from '../../../shared/cronograma-do-servidor.testing';
import { hidratarDraft } from '../../../shared/hidratacao';
import { DRAFT, dtoComCronograma } from '../../../shared/hidratacao.testing';
import { faseDoFormulario, grupoDaFase } from '../cronograma-form';
import { espelharFasesNoFormulario } from './espelho-das-fases-no-formulario';

const fasesDe = (...fases: ReturnType<typeof faseDoServidor>[]) =>
  hidratarDraft(DRAFT, dtoComCronograma({ cronogramaFases: fases, etapas: [] })).cronograma.fases;

const PRIMEIRA = faseDoServidor({ id: 'fase-1', codigo: 'INSCRICAO' });
const SEGUNDA = faseDoServidor({
  id: 'fase-2',
  codigo: 'HABILITACAO',
  faseCanonica: { origemId: '01960000-0000-7000-0000-000000000905' },
});

function formularioCom(fases: ReturnType<typeof fasesDe>) {
  return new FormArray(fases.map(grupoDaFase));
}

describe('espelho das fases no formulário', () => {
  it('atualiza no mesmo grupo a fase que só mudou de conteúdo', () => {
    const [fase] = fasesDe(PRIMEIRA);
    const formulario = formularioCom([fase]);
    const grupo = formulario.at(0);

    espelharFasesNoFormulario(formulario, [{ ...fase, tiposDeDecisao: ['CLASSIFICACAO'] }]);

    expect(formulario.at(0)).toBe(grupo);
    expect(faseDoFormulario(grupo).tiposDeDecisao).toStrictEqual(['CLASSIFICACAO']);
  });

  it('recria o conjunto quando uma fase entra', () => {
    const [primeira, segunda] = fasesDe(PRIMEIRA, SEGUNDA);
    const formulario = formularioCom([primeira]);
    const grupo = formulario.at(0);

    espelharFasesNoFormulario(formulario, [primeira, segunda]);

    expect(formulario.length).toBe(2);
    expect(formulario.at(0)).not.toBe(grupo);
  });

  it('recria o conjunto quando as fases trocam de ordem', () => {
    const [primeira, segunda] = fasesDe(PRIMEIRA, SEGUNDA);
    const formulario = formularioCom([primeira, segunda]);
    const grupoAnterior = formulario.at(0);

    espelharFasesNoFormulario(formulario, [segunda, primeira]);

    expect(formulario.at(0)).not.toBe(grupoAnterior);
    expect(formulario.controls.map((grupo) => grupo.controls.codigo.value)).toStrictEqual([
      'HABILITACAO',
      'INSCRICAO',
    ]);
  });

  it('recria o conjunto quando uma fase sai', () => {
    const [primeira, segunda] = fasesDe(PRIMEIRA, SEGUNDA);
    const formulario = formularioCom([primeira, segunda]);
    const grupoAnterior = formulario.at(0);

    espelharFasesNoFormulario(formulario, [primeira]);

    expect(formulario.length).toBe(1);
    expect(formulario.at(0)).not.toBe(grupoAnterior);
  });
});

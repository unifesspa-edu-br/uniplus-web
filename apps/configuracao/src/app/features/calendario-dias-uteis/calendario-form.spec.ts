import { describe, expect, it } from 'vitest';
import {
  comandoDeCriacaoDoCalendario,
  criarFormularioDeCalendario,
  dataEstaDuplicada,
} from './calendario-form';
import { aplicarAbrangencia, criarGrupoDeDiaNaoUtil } from './dia-nao-util-form';

function formularioComDias(...dias: Array<[string, string]>) {
  const form = criarFormularioDeCalendario();
  form.controls.versaoDataset.setValue('2026.1');
  for (const [abrangencia, data] of dias) {
    const grupo = criarGrupoDeDiaNaoUtil();
    grupo.controls.abrangencia.setValue(abrangencia);
    aplicarAbrangencia(grupo);
    grupo.controls.data.setValue(data);
    grupo.controls.descricao.setValue('Independência do Brasil');
    form.controls.diasNaoUteis.push(grupo);
  }
  return form;
}

describe('formulário de calendário', () => {
  it('permite a mesma data em abrangências diferentes', () => {
    const form = formularioComDias(['NACIONAL', '2026-09-07'], ['INSTITUCIONAL', '2026-09-07']);

    expect(form.controls.diasNaoUteis.errors).toBeNull();
    expect(form.valid).toBe(true);
  });

  it('recusa a mesma data na mesma abrangência e região, nas duas linhas, até uma ser corrigida', () => {
    const form = formularioComDias(['NACIONAL', '2026-09-07'], ['NACIONAL', '2026-09-07']);
    const dias = form.controls.diasNaoUteis;

    expect(dias.errors?.['dataDuplicada']).toBe(true);
    expect(form.invalid).toBe(true);
    expect(dataEstaDuplicada(dias, dias.at(0))).toBe(true);
    expect(dataEstaDuplicada(dias, dias.at(1))).toBe(true);

    dias.at(1).controls.data.setValue('2026-09-08');

    expect(dias.errors).toBeNull();
    expect(dataEstaDuplicada(dias, dias.at(0))).toBe(false);
    expect(dataEstaDuplicada(dias, dias.at(1))).toBe(false);
    expect(form.valid).toBe(true);
  });

  it('o mesmo dia estadual em UFs diferentes não se repete', () => {
    const form = formularioComDias(['ESTADUAL', '2026-08-15'], ['ESTADUAL', '2026-08-15']);
    form.controls.diasNaoUteis.at(1).controls.uf.setValue('SP');

    expect(form.controls.diasNaoUteis.errors).toBeNull();
  });

  it('o dia municipal só é comparável depois da escolha do município', () => {
    const form = formularioComDias(['MUNICIPAL', '2026-04-05'], ['MUNICIPAL', '2026-04-05']);

    expect(form.controls.diasNaoUteis.errors).toBeNull();
  });

  it('bloqueia a versão do dataset composta só por espaços', () => {
    const form = criarFormularioDeCalendario();
    form.controls.versaoDataset.setValue('   ');

    expect(form.controls.versaoDataset.errors?.['required']).toBe(true);
  });

  it('recusa a versão acima de 60 caracteres', () => {
    const form = criarFormularioDeCalendario();
    form.controls.versaoDataset.setValue('v'.repeat(61));

    expect(form.controls.versaoDataset.errors?.['maxlength']).toBeDefined();
  });

  it('o comando leva a versão aparada e os dias na ordem da tela', () => {
    const form = formularioComDias(['NACIONAL', '2026-09-07'], ['INSTITUCIONAL', '2026-10-01']);
    form.controls.versaoDataset.setValue('  2026.1 ');

    const comando = comandoDeCriacaoDoCalendario(form);

    expect(comando.versaoDataset).toBe('2026.1');
    expect(comando.diasNaoUteis?.map((dia) => dia.data)).toEqual(['2026-09-07', '2026-10-01']);
  });
});

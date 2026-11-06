import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
} from '@angular/forms';
import type { CriarCalendarioDiasUteisCommand } from '@uniplus/shared-data/configuracao';
import { nullIfBlank } from '../../shared/formulario';
import { type DiaNaoUtilFormGroup, textoNormalizado } from './calendario-dias-uteis.util';
import { comandoDoDiaNaoUtil, type GrupoDoDia } from './dia-nao-util-form';

export interface CalendarioForm {
  versaoDataset: FormControl<string>;
  diasNaoUteis: FormArray<FormGroup<DiaNaoUtilFormGroup>>;
}

export const VERSAO_DATASET_MAXIMO = 60;

/**
 * O que identifica um dia para a regra de duplicidade: a mesma data só se repete em abrangência ou
 * região diferentes. Sem os campos que a identificam, o dia ainda não pode ser comparado.
 */
export function chaveDeDuplicidade(grupo: GrupoDoDia): string | null {
  const { data, abrangencia, codigoMunicipio, uf } = grupo.controls;
  if (!data.value || !abrangencia.value) {
    return null;
  }
  if (abrangencia.value === 'MUNICIPAL') {
    const municipio = codigoMunicipio.value?.trim();
    return municipio ? `${data.value}|MUNICIPAL|${municipio}` : null;
  }
  if (abrangencia.value === 'ESTADUAL') {
    const sigla = uf.value?.trim().toUpperCase();
    return sigla ? `${data.value}|ESTADUAL|${sigla}` : null;
  }
  return `${data.value}|${abrangencia.value}`;
}

export function dataEstaDuplicada(dias: FormArray<GrupoDoDia>, grupo: GrupoDoDia): boolean {
  const chave = chaveDeDuplicidade(grupo);
  return (
    chave !== null && dias.controls.filter((dia) => chaveDeDuplicidade(dia) === chave).length > 1
  );
}

function datasNaoUteisSemDuplicidade(control: AbstractControl): ValidationErrors | null {
  const dias = (control as FormArray<GrupoDoDia>).controls;
  const chaves = dias.map(chaveDeDuplicidade).filter((chave) => chave !== null);
  return new Set(chaves).size < chaves.length ? { dataDuplicada: true } : null;
}

export function criarFormularioDeCalendario(): FormGroup<CalendarioForm> {
  return new FormGroup<CalendarioForm>({
    versaoDataset: new FormControl('', {
      nonNullable: true,
      validators: [textoNormalizado(VERSAO_DATASET_MAXIMO)],
    }),
    diasNaoUteis: new FormArray<GrupoDoDia>([], { validators: [datasNaoUteisSemDuplicidade] }),
  });
}

export function comandoDeCriacaoDoCalendario(
  form: FormGroup<CalendarioForm>,
): CriarCalendarioDiasUteisCommand {
  return {
    versaoDataset: nullIfBlank(form.controls.versaoDataset.value),
    diasNaoUteis: form.controls.diasNaoUteis.controls.map(comandoDoDiaNaoUtil),
  };
}

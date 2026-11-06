import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AtualizarTipoBancaCommand, TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';
export interface BancaForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  faseTipica: FormControl<string>;
  descricao: FormControl<string>;
}
const CAMPOS: ReadonlySet<string> = new Set<keyof BancaForm>([
  'codigo',
  'nome',
  'faseTipica',
  'descricao',
]);
export function criarFormularioDeBanca(): FormGroup<BancaForm> {
  return new FormGroup<BancaForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    faseTipica: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(60)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(300)],
    }),
  });
}
export function valoresDaBanca(banca: TipoBancaDto) {
  return {
    codigo: banca.codigo,
    nome: banca.nome,
    faseTipica: banca.faseTipica ?? '',
    descricao: banca.descricao ?? '',
  };
}
export function controleDoCampoDoServidor(field: string): keyof BancaForm | null {
  return controlNameFromBackendField<keyof BancaForm>(field, CAMPOS);
}
export function comandoDeAtualizacao(
  id: string,
  form: FormGroup<BancaForm>,
): AtualizarTipoBancaCommand {
  const valor = form.getRawValue();
  return {
    id,
    nome: valor.nome.trim(),
    faseTipica: nullIfBlank(valor.faseTipica),
    descricao: nullIfBlank(valor.descricao),
  };
}

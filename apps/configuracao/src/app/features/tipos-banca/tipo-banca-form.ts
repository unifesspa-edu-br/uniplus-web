import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
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
function campoDeTexto(...validadores: ValidatorFn[]): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators: validadores });
}

export function criarFormularioDeBanca(): FormGroup<BancaForm> {
  return new FormGroup<BancaForm>({
    codigo: campoDeTexto(Validators.required, Validators.maxLength(60)),
    nome: campoDeTexto(Validators.required, Validators.maxLength(200)),
    faseTipica: campoDeTexto(Validators.maxLength(60)),
    descricao: campoDeTexto(Validators.maxLength(300)),
  });
}

export function valoresDaBanca(banca: TipoBancaDto) {
  return {
    codigo: banca.codigo.codigo,
    nome: banca.nome,
    faseTipica: banca.faseTipica ?? '',
    descricao: banca.descricao ?? '',
  };
}
export function controleDoCampoDoServidor(field: string): keyof BancaForm | null {
  return controlNameFromBackendField<keyof BancaForm>(field, CAMPOS);
}
/**
 * O papel e as marcas que a tela não edita voltam como a leitura os trouxe: o servidor os
 * substitui por inteiro, e omiti-los os zeraria.
 */
function papelEMarcasDaBanca(
  banca: TipoBancaDto,
): Omit<AtualizarTipoBancaCommand, 'id' | 'nome' | 'faseTipica' | 'descricao'> {
  return {
    papel: banca.papel.codigo,
    exigeDuasOuMaisBancas: banca.exigeDuasOuMaisBancas,
    encerraRecursoNaPrimeiraInstancia: banca.encerraRecursoNaPrimeiraInstancia,
    tiposDeDecisaoJulgados: banca.tiposDeDecisaoJulgados.map((tipo) => tipo.codigo),
  };
}

export function comandoDeAtualizacao(
  banca: TipoBancaDto,
  form: FormGroup<BancaForm>,
): AtualizarTipoBancaCommand {
  const valor = form.getRawValue();
  return {
    id: banca.id,
    nome: valor.nome.trim(),
    faseTipica: nullIfBlank(valor.faseTipica),
    descricao: nullIfBlank(valor.descricao),
    ...papelEMarcasDaBanca(banca),
  };
}

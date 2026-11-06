import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  BaseLegalBonusRegionalDto,
  BaseLegalBonusRegionalMunicipioDto,
  CriarBaseLegalBonusRegionalCommand,
  AtualizarBaseLegalBonusRegionalCommand,
} from '@uniplus/shared-data/configuracao';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';

export interface BaseLegalForm {
  tipoInstrumento: FormControl<string>;
  identificacao: FormControl<string>;
  descricao: FormControl<string>;
}

export type ValoresDaBaseLegal = ReturnType<FormGroup<BaseLegalForm>['getRawValue']>;

/** O campo dos municípios não é um controle do formulário: a recusa do servidor o nomeia à parte. */
export type CampoDoServidor = keyof BaseLegalForm | 'municipios';

const IDENTIFICACAO_MINIMO = 3;
const IDENTIFICACAO_MAXIMO = 500;
const DESCRICAO_MINIMO = 3;
const DESCRICAO_MAXIMO = 2000;

const CAMPOS: ReadonlySet<string> = new Set<CampoDoServidor>([
  'tipoInstrumento',
  'identificacao',
  'descricao',
  'municipios',
]);

/**
 * `Validators.required`/`minLength` avaliam o valor cru, e o servidor sempre confere o texto
 * aparado: sem isso, "   " ou "ab " passariam no cliente e só voltariam como 422.
 */
function validadorTextoAparado(minimo: number): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const aparado = (control.value ?? '').trim();
    if (aparado.length === 0) {
      return { required: true };
    }
    if (aparado.length < minimo) {
      return { minlength: { requiredLength: minimo, actualLength: aparado.length } };
    }
    return null;
  };
}

export function criarFormularioDeBaseLegal(): FormGroup<BaseLegalForm> {
  return new FormGroup<BaseLegalForm>({
    tipoInstrumento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    identificacao: new FormControl('', {
      nonNullable: true,
      validators: [
        validadorTextoAparado(IDENTIFICACAO_MINIMO),
        Validators.maxLength(IDENTIFICACAO_MAXIMO),
      ],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [validadorTextoAparado(DESCRICAO_MINIMO), Validators.maxLength(DESCRICAO_MAXIMO)],
    }),
  });
}

export function valoresEmBrancoDaBaseLegal(): ValoresDaBaseLegal {
  return { tipoInstrumento: '', identificacao: '', descricao: '' };
}

export function valoresDaBaseLegal(base: BaseLegalBonusRegionalDto): ValoresDaBaseLegal {
  return {
    tipoInstrumento: base.tipoInstrumento,
    identificacao: base.identificacao,
    descricao: base.descricao,
  };
}

export function campoDoServidor(field: string): CampoDoServidor | null {
  return controlNameFromBackendField<CampoDoServidor>(field, CAMPOS);
}

export function comandoDeCriacao(
  form: FormGroup<BaseLegalForm>,
  municipios: readonly BaseLegalBonusRegionalMunicipioDto[],
): CriarBaseLegalBonusRegionalCommand {
  const valor = form.getRawValue();
  return {
    tipoInstrumento: nullIfBlank(valor.tipoInstrumento),
    identificacao: nullIfBlank(valor.identificacao),
    descricao: nullIfBlank(valor.descricao),
    municipios: municipios.map(({ codigoIbge, nome, uf }) => ({ codigoIbge, nome, uf })),
  };
}

/** O `id` do corpo reapresenta o da rota: o servidor recusa divergência entre os dois. */
export function comandoDeAtualizacao(
  id: string,
  form: FormGroup<BaseLegalForm>,
  municipios: readonly BaseLegalBonusRegionalMunicipioDto[],
): AtualizarBaseLegalBonusRegionalCommand {
  return { id, ...comandoDeCriacao(form, municipios) };
}

import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';

/**
 * Snapshot municipal da ADR-0090 tal como o formulário o mantém: código IBGE,
 * nome e UF chegam juntos da API Geo e são gravados juntos — nenhum dos três
 * nasce de digitação livre nem de constante do código.
 */
export interface MunicipioOpcao {
  readonly codigoIbge: string;
  readonly nome: string;
  readonly uf: string;
}

export interface MunicipioBuscaState {
  readonly opcoes: readonly MunicipioOpcao[];
  readonly carregando: boolean;
  readonly erro: boolean;
}

export interface DiaNaoUtilFormGroup {
  uf: FormControl<string | null>;
  codigoMunicipio: FormControl<string | null>;
  municipioNome: FormControl<string | null>;
  municipioUf: FormControl<string | null>;
  buscaMunicipio: FormControl<string>;
  abrangencia: FormControl<string>;
  data: FormControl<string>;
  descricao: FormControl<string>;
}

export interface MunicipioBuscaRequest {
  readonly grupo: FormGroup<DiaNaoUtilFormGroup>;
  readonly termo: string;
  readonly uf: string;
}

export const DATA_DUPLICADA_DATASET_CODE =
  'uniplus.configuracao.calendario_dias_uteis.data_duplicada_no_dataset';

/**
 * Prefixo dos erros que o backend devolve ao validar a referência de cidade do
 * Geo (`uniplus.cidade_referencia.*`, ADR-0090): código obrigatório/inválido,
 * nome obrigatório/longo demais, UF obrigatória/incoerente com o prefixo. É
 * prefixo, e não uma lista fechada, porque o registro cresce no backend.
 */
export const CIDADE_REFERENCIA_CODE_PREFIX = 'uniplus.cidade_referencia.';

export const DATA_DUPLICADA_MESSAGE = 'Esta data está duplicada para a mesma abrangência e região.';
export const MUNICIPIO_OBRIGATORIO_MESSAGE = 'Selecione um município na busca.';

/**
 * Prefixo do código IBGE (dois primeiros dígitos) de cada UF — a mesma
 * correspondência que `ReferenciaCidadeGeo` cobra no backend. Fica neste módulo
 * das páginas de calendário (chunk lazy) em vez do roster compartilhado, que é
 * carregado no bundle inicial do painel.
 */
export const PREFIXO_IBGE_POR_UF: Readonly<Record<string, string>> = {
  RO: '11',
  AC: '12',
  AM: '13',
  RR: '14',
  PA: '15',
  AP: '16',
  TO: '17',
  MA: '21',
  PI: '22',
  CE: '23',
  RN: '24',
  PB: '25',
  PE: '26',
  AL: '27',
  SE: '28',
  BA: '29',
  MG: '31',
  ES: '32',
  RJ: '33',
  SP: '35',
  PR: '41',
  SC: '42',
  RS: '43',
  MS: '50',
  MT: '51',
  GO: '52',
  DF: '53',
};

export const CODIGO_MUNICIPIO_PATTERN = /^(?:1[1-7]|2[1-9]|3[1-35]|4[1-3]|5[0-3])\d{5}$/;

export const DIAS_SEMANA = [
  { abrev: 'Dom', nome: 'Domingo' },
  { abrev: 'Seg', nome: 'Segunda-feira' },
  { abrev: 'Ter', nome: 'Terça-feira' },
  { abrev: 'Qua', nome: 'Quarta-feira' },
  { abrev: 'Qui', nome: 'Quinta-feira' },
  { abrev: 'Sex', nome: 'Sexta-feira' },
  { abrev: 'Sáb', nome: 'Sábado' },
] as const;

export const MUNICIPIO_BUSCA_VAZIA: MunicipioBuscaState = {
  opcoes: [],
  carregando: false,
  erro: false,
};

export const PARA_SIGLA = 'PA';

export function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function textoNormalizado(maxLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    if (value.length === 0) {
      return { required: true };
    }
    return value.length > maxLength
      ? { maxlength: { requiredLength: maxLength, actualLength: value.length } }
      : null;
  };
}

/**
 * Exige, na linha municipal, o snapshot inteiro da opção escolhida na Geo:
 * código IBGE de 7 dígitos, nome e UF cujo prefixo IBGE bate com o código. É a
 * mesma coerência que `ReferenciaCidadeGeo.Validar` cobra no backend — validada
 * aqui para que uma tripla incompleta não vire 422.
 */
export function snapshotMunicipalCoerente(control: AbstractControl): ValidationErrors | null {
  const grupo = control as FormGroup<DiaNaoUtilFormGroup>;
  if (grupo.controls.abrangencia.value !== 'MUNICIPAL') {
    return null;
  }

  const codigo = grupo.controls.codigoMunicipio.value?.trim() ?? '';
  const nome = grupo.controls.municipioNome.value?.trim() ?? '';
  const uf = grupo.controls.municipioUf.value?.trim().toUpperCase() ?? '';
  if (!CODIGO_MUNICIPIO_PATTERN.test(codigo) || nome.length === 0) {
    return { snapshotMunicipal: true };
  }

  return PREFIXO_IBGE_POR_UF[uf] === codigo.slice(0, 2) ? null : { snapshotMunicipal: true };
}

export const DATA_PATTERN = /\d{4}-\d{2}-\d{2}/;
export const MUNICIPIOS_LIMIT = 20;
export const MUNICIPIO_BUSCA_DEBOUNCE_MS = 300;

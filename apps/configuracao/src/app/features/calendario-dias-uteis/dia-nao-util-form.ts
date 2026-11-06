import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { ProblemValidationError } from '@uniplus/shared-core/http';
import type { DiaNaoUtilCommandItem } from '@uniplus/shared-data/configuracao';
import {
  controlNameFromBackendField,
  mensagemDeErroDoControle,
  nullIfBlank,
} from '../../shared/formulario';
import {
  CODIGO_MUNICIPIO_PATTERN,
  DATA_DUPLICADA_MESSAGE,
  type DiaNaoUtilFormGroup,
  MUNICIPIO_OBRIGATORIO_MESSAGE,
  type MunicipioOpcao,
  PARA_SIGLA,
  snapshotMunicipalCoerente,
  textoNormalizado,
} from './calendario-dias-uteis.util';

export type GrupoDoDia = FormGroup<DiaNaoUtilFormGroup>;

export type CampoDoDia = 'abrangencia' | 'uf' | 'codigoMunicipio' | 'data' | 'descricao';

export type ErrosDoDia = Readonly<Record<CampoDoDia, string | null>>;

const CAMPOS_DO_DIA: readonly CampoDoDia[] = [
  'abrangencia',
  'uf',
  'codigoMunicipio',
  'data',
  'descricao',
];

const REGRAS_DA_UF = [Validators.required, Validators.pattern(/^[A-Z]{2}$/)];

export function criarGrupoDeDiaNaoUtil(): GrupoDoDia {
  return new FormGroup<DiaNaoUtilFormGroup>(
    {
      abrangencia: new FormControl('ESTADUAL', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      codigoMunicipio: new FormControl(''),
      municipioNome: new FormControl(null),
      municipioUf: new FormControl(null),
      buscaMunicipio: new FormControl('', { nonNullable: true }),
      uf: new FormControl(PARA_SIGLA, { validators: REGRAS_DA_UF }),
      data: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      descricao: new FormControl('', {
        nonNullable: true,
        validators: [textoNormalizado(200)],
      }),
    },
    { validators: [snapshotMunicipalCoerente] },
  );
}

/** Código, nome e UF andam juntos: sobrar um deles seria exibir um município que já não é o escolhido. */
export function limparSnapshotMunicipal(grupo: GrupoDoDia): void {
  grupo.controls.codigoMunicipio.reset('');
  grupo.controls.municipioNome.reset(null);
  grupo.controls.municipioUf.reset(null);
}

/**
 * Ajusta o que a abrangência exige. A UF da abrangência municipal é só o filtro da busca na Geo,
 * pois a API recusa `uf` fora da estadual; a UF do município vem no snapshot.
 */
export function aplicarAbrangencia(grupo: GrupoDoDia): void {
  const { abrangencia, codigoMunicipio, uf, buscaMunicipio } = grupo.controls;
  const tipo = abrangencia.value;

  codigoMunicipio.clearValidators();
  uf.clearValidators();
  limparSnapshotMunicipal(grupo);

  if (tipo === 'MUNICIPAL' || tipo === 'ESTADUAL') {
    uf.setValue(PARA_SIGLA);
    uf.setValidators(REGRAS_DA_UF);
  } else {
    uf.reset('');
  }
  if (tipo === 'MUNICIPAL') {
    codigoMunicipio.setValidators([
      Validators.required,
      Validators.pattern(CODIGO_MUNICIPIO_PATTERN),
    ]);
  } else {
    buscaMunicipio.reset('');
  }

  codigoMunicipio.updateValueAndValidity();
  uf.updateValueAndValidity();
}

/** Trocar o estado da busca invalida o município escolhido no estado anterior. */
export function reiniciarBuscaDoMunicipio(grupo: GrupoDoDia): void {
  limparSnapshotMunicipal(grupo);
  grupo.controls.buscaMunicipio.reset('');
  grupo.controls.codigoMunicipio.updateValueAndValidity();
}

/** O único ponto que escreve o snapshot: nome e UF nunca vêm do que foi digitado. */
export function gravarOpcaoEscolhida(grupo: GrupoDoDia, opcao: MunicipioOpcao): void {
  grupo.controls.municipioNome.setValue(opcao.nome);
  grupo.controls.municipioUf.setValue(opcao.uf);
  grupo.controls.buscaMunicipio.setValue(opcao.nome, { emitEvent: false });
  grupo.updateValueAndValidity();
}

/** O snapshot já gravado na linha, independente da lista de busca vigente. */
export function municipioSelecionadoDe(grupo: GrupoDoDia): MunicipioOpcao | null {
  const codigoIbge = grupo.controls.codigoMunicipio.value?.trim();
  const nome = grupo.controls.municipioNome.value?.trim();
  const uf = grupo.controls.municipioUf.value?.trim();
  return codigoIbge && nome && uf ? { codigoIbge, nome, uf } : null;
}

export function ufDaBuscaDe(grupo: GrupoDoDia): string {
  return grupo.controls.uf.value?.trim().toUpperCase() ?? '';
}

/** Os campos regionais que não se aplicam à abrangência vão nulos: a API recusa o excesso. */
export function comandoDoDiaNaoUtil(grupo: GrupoDoDia): DiaNaoUtilCommandItem {
  const { abrangencia, data, uf, descricao } = grupo.controls;
  const municipio = abrangencia.value === 'MUNICIPAL' ? municipioSelecionadoDe(grupo) : null;
  return {
    abrangencia: abrangencia.value,
    data: data.value,
    uf: abrangencia.value === 'ESTADUAL' ? uf.value || null : null,
    municipioIbge: municipio?.codigoIbge ?? null,
    municipioNome: municipio?.nome ?? null,
    municipioUf: municipio?.uf ?? null,
    descricao: nullIfBlank(descricao.value),
  };
}

function erroDoCampoDoDia(
  grupo: GrupoDoDia,
  campo: CampoDoDia,
  dataDuplicada: boolean,
): string | null {
  const controle = grupo.controls[campo];
  if (!controle.touched && !controle.dirty) {
    return null;
  }
  if (campo === 'data' && dataDuplicada) {
    return DATA_DUPLICADA_MESSAGE;
  }
  // O snapshot incompleto é erro do grupo, pois nome e UF não têm campo próprio, mas quem o
  // resolve é a escolha no campo Município.
  if (campo === 'codigoMunicipio' && grupo.errors?.['snapshotMunicipal']) {
    return MUNICIPIO_OBRIGATORIO_MESSAGE;
  }
  return mensagemDeErroDoControle(controle);
}

export function errosDoDia(grupo: GrupoDoDia, dataDuplicada: boolean): ErrosDoDia {
  const erros = {} as Record<CampoDoDia, string | null>;
  for (const campo of CAMPOS_DO_DIA) {
    erros[campo] = erroDoCampoDoDia(grupo, campo, dataDuplicada);
  }
  return erros;
}

/** O campo do formulário que o servidor aponta com cada nome de campo do comando. */
const CONTROLE_DO_CAMPO_NO_SERVIDOR: Readonly<Record<string, CampoDoDia>> = {
  abrangencia: 'abrangencia',
  uf: 'uf',
  data: 'data',
  descricao: 'descricao',
  municipioIbge: 'codigoMunicipio',
  municipioNome: 'codigoMunicipio',
  municipioUf: 'codigoMunicipio',
};

const CAMPOS_DO_SERVIDOR: ReadonlySet<string> = new Set(Object.keys(CONTROLE_DO_CAMPO_NO_SERVIDOR));

/** A posição do dia no comando de criação (`diasNaoUteis[2].data` aponta o terceiro). */
export function indiceDoDiaNoServidor(field: string): number | null {
  const indice = /\[(\d+)\]/u.exec(field)?.[1];
  return indice === undefined ? null : Number(indice);
}

/** Marca o campo que o servidor recusou. Devolve se o erro tem campo na tela. */
export function aplicarErroNoDia(grupo: GrupoDoDia, erro: ProblemValidationError): boolean {
  const nome = controlNameFromBackendField<string>(erro.field, CAMPOS_DO_SERVIDOR);
  if (nome === null) {
    return false;
  }
  apontarRecusa(grupo.controls[CONTROLE_DO_CAMPO_NO_SERVIDOR[nome]], erro.code, erro.message);
  return true;
}

export function apontarRecusa(controle: AbstractControl, codigo: string, mensagem: string): void {
  controle.setErrors({ ...controle.errors, backend: { code: codigo, message: mensagem } });
  controle.markAsTouched();
}

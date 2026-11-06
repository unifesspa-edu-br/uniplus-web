import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AreaPesoAreaEnemDto,
  AtualizarPesoAreaEnemCommand,
  CriarPesoAreaEnemCommand,
  PesoAreaEnemAreaCommand,
  PesoAreaEnemDto,
  type GrupoAreaEnemDto,
} from '@uniplus/shared-data/configuracao';
import { nullIfBlank } from '../../shared/formulario';
import { maximoDeCasasDecimais } from './pesos-enem-campo-numerico';
import { CASAS_CORTE, CASAS_PESO, CORTE_MAXIMO, PESO_MAXIMO } from './pesos-enem-limites';

const RESOLUCAO_TAMANHO_MAXIMO = 40;
const BASE_LEGAL_TAMANHO_MAXIMO = 500;

/** Uma área dentro de um grupo: o código identifica a área (fixo, vindo da API); o
 *  operador edita só peso e corte. */
export interface AreaForm {
  codigo: FormControl<string>;
  peso: FormControl<number>;
  corte: FormControl<number | null>;
}

/** O grupo não é editável: o controle carrega código (enviado na criação) e rótulo
 *  (exibido), como a API os devolve. */
export interface PesoGrupoForm {
  grupoCurso: FormControl<GrupoAreaEnemDto>;
  areas: FormArray<FormGroup<AreaForm>>;
  baseLegal: FormControl<string>;
}

export interface PesoLoteForm {
  resolucao: FormControl<string>;
  baseLegalGlobal: FormControl<string>;
  grupos: FormArray<FormGroup<PesoGrupoForm>>;
}

export interface PesoEdicaoGrupoForm {
  id: FormControl<string>;
  grupoCurso: FormControl<GrupoAreaEnemDto>;
  areas: FormArray<FormGroup<AreaForm>>;
  baseLegal: FormControl<string>;
}

export type FormularioDeEdicao = FormArray<FormGroup<PesoEdicaoGrupoForm>>;

const validadoresDaBaseLegal = [
  Validators.required,
  Validators.minLength(1),
  Validators.maxLength(BASE_LEGAL_TAMANHO_MAXIMO),
];

export function criarFormularioDeResolucao(): FormGroup<PesoLoteForm> {
  return new FormGroup<PesoLoteForm>({
    resolucao: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(RESOLUCAO_TAMANHO_MAXIMO),
      ],
    }),
    baseLegalGlobal: new FormControl('', { nonNullable: true, validators: validadoresDaBaseLegal }),
    // Os grupos e as áreas de cada um só são montados ao abrir o drawer, quando as listas da
    // API já chegaram.
    grupos: new FormArray<FormGroup<PesoGrupoForm>>([]),
  });
}

function criarAreaForm(codigo: string, peso: number, corte: number | null): FormGroup<AreaForm> {
  return new FormGroup<AreaForm>({
    codigo: new FormControl(codigo, { nonNullable: true }),
    peso: new FormControl(peso, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(0),
        Validators.max(PESO_MAXIMO),
        maximoDeCasasDecimais(CASAS_PESO),
      ],
    }),
    // Opcional: em branco (null) é "sem corte", sem `Validators.required`.
    corte: new FormControl<number | null>(corte, {
      validators: [
        Validators.min(0),
        Validators.max(CORTE_MAXIMO),
        maximoDeCasasDecimais(CASAS_CORTE),
      ],
    }),
  });
}

/** Um grupo da criação, com uma área por item da lista da API, na ordem dela, com peso zero
 *  e sem corte. */
export function criarGrupoDeCriacao(
  grupoCurso: GrupoAreaEnemDto,
  areas: readonly AreaPesoAreaEnemDto[],
): FormGroup<PesoGrupoForm> {
  return new FormGroup<PesoGrupoForm>({
    grupoCurso: new FormControl(grupoCurso, { nonNullable: true }),
    areas: new FormArray(areas.map((area) => criarAreaForm(area.codigo, 0, null))),
    baseLegal: new FormControl('', { nonNullable: true, validators: validadoresDaBaseLegal }),
  });
}

/** As áreas da edição seguem a ordem da lista da API, não a ordem em que a linha as
 *  devolveu: o índice de cada controle é o índice que o backend usa em `areas[i]`, para o
 *  erro voltar ao campo certo. */
export function criarGrupoDeEdicao(
  linha: PesoAreaEnemDto,
  areas: readonly AreaPesoAreaEnemDto[],
): FormGroup<PesoEdicaoGrupoForm> {
  return new FormGroup<PesoEdicaoGrupoForm>({
    id: new FormControl(linha.id, { nonNullable: true }),
    grupoCurso: new FormControl(linha.grupoCurso, { nonNullable: true }),
    areas: new FormArray(
      areas.map((area) => {
        const valor = linha.areas.find((existente) => existente.codigo?.trim() === area.codigo);
        return criarAreaForm(
          area.codigo,
          valor === undefined ? 0 : valor.peso,
          valor?.corte ?? null,
        );
      }),
    ),
    baseLegal: new FormControl(linha.baseLegal, {
      nonNullable: true,
      validators: validadoresDaBaseLegal,
    }),
  });
}

function areasDoPayload(
  areas: readonly { codigo: string; peso: number; corte: number | null }[],
): PesoAreaEnemAreaCommand[] {
  return areas.map((area) => ({ codigo: area.codigo, peso: area.peso, corte: area.corte ?? null }));
}

export type ValoresDoGrupoDeCriacao = ReturnType<FormGroup<PesoGrupoForm>['getRawValue']>;
export type ValoresDoGrupoDeEdicao = ReturnType<FormGroup<PesoEdicaoGrupoForm>['getRawValue']>;

export function comandoDeCriacao(
  valores: ValoresDoGrupoDeCriacao,
  resolucao: string,
): CriarPesoAreaEnemCommand {
  return {
    resolucao: nullIfBlank(resolucao),
    grupoCurso: valores.grupoCurso.codigo,
    areas: areasDoPayload(valores.areas),
    baseLegal: nullIfBlank(valores.baseLegal),
  };
}

export function comandoDeAtualizacao(
  valores: ValoresDoGrupoDeEdicao,
): AtualizarPesoAreaEnemCommand {
  return {
    id: valores.id,
    areas: areasDoPayload(valores.areas),
    baseLegal: nullIfBlank(valores.baseLegal),
  };
}

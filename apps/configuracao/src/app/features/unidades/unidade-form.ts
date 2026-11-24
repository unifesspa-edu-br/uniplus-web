import { AbstractControl, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import {
  TipoUnidadeCodigo,
  type AtualizarUnidadeCommand,
  type CriarUnidadeCommand,
  type UnidadeDto,
} from '@uniplus/shared-data/organizacao';
import { OPCOES_DE_TIPO } from './tipos-de-unidade';
import type { CidadeRef } from '@uniplus/shared-ui/components';
import {
  controlNameFromBackendField,
  mensagemDeErroDoCampoComFormato,
  nullIfBlank,
} from '../../shared/formulario';

export interface UnidadeForm {
  nome: FormControl<string>;
  alias: FormControl<string>;
  slug: FormControl<string>;
  sigla: FormControl<string>;
  codigo: FormControl<string>;
  unidadeSuperiorId: FormControl<string>;
  tipo: FormControl<TipoUnidadeCodigo | ''>;
  unidadeAcademica: FormControl<boolean>;
  vigenciaInicio: FormControl<string>;
  vigenciaFim: FormControl<string>;
  motivoMudancaIdentificador: FormControl<string>;
}

export type ValoresDaUnidade = ReturnType<FormGroup<UnidadeForm>['getRawValue']>;

/** Limites de tamanho do Domain `Unidade` (uniplus-api). */
const NOME_TAMANHO_MINIMO = 2;
export const NOME_TAMANHO_MAXIMO = 250;
export const ALIAS_TAMANHO_MAXIMO = 100;
export const SIGLA_TAMANHO_MAXIMO = 50;
export const CODIGO_TAMANHO_MAXIMO = 50;

/** Limite da coluna do histórico de identificadores (uniplus-api), não do Domain `Unidade`. */
export const MOTIVO_TAMANHO_MAXIMO = 500;

const MENSAGEM_SEM_FORMATO = 'Valor inválido.';

const CAMPOS: ReadonlySet<string> = new Set<keyof UnidadeForm>([
  'nome',
  'alias',
  'slug',
  'sigla',
  'codigo',
  'unidadeSuperiorId',
  'tipo',
  'unidadeAcademica',
  'vigenciaInicio',
  'vigenciaFim',
  'motivoMudancaIdentificador',
]);

/** Data local, não UTC: `toISOString` adiantaria um dia à noite em fusos negativos. */
export function dataAtualIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function campoDeTexto(...validators: ValidatorFn[]): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators });
}

function campoDoNome(): FormControl<string> {
  return campoDeTexto(
    Validators.required,
    Validators.minLength(NOME_TAMANHO_MINIMO),
    Validators.maxLength(NOME_TAMANHO_MAXIMO),
  );
}

function campoObrigatorio(valorInicial: string): FormControl<string> {
  return new FormControl(valorInicial, { nonNullable: true, validators: [Validators.required] });
}

function controlesDeIdentificacao(): Pick<
  UnidadeForm,
  'nome' | 'alias' | 'slug' | 'sigla' | 'codigo' | 'unidadeSuperiorId'
> {
  return {
    nome: campoDoNome(),
    alias: campoDeTexto(Validators.maxLength(ALIAS_TAMANHO_MAXIMO)),
    slug: campoDeTexto(Validators.required),
    sigla: campoDeTexto(Validators.required, Validators.maxLength(SIGLA_TAMANHO_MAXIMO)),
    codigo: campoDeTexto(Validators.required, Validators.maxLength(CODIGO_TAMANHO_MAXIMO)),
    unidadeSuperiorId: campoDeTexto(),
  };
}

function controlesDeClassificacaoEVigencia(): Omit<
  UnidadeForm,
  keyof ReturnType<typeof controlesDeIdentificacao>
> {
  return {
    tipo: new FormControl<TipoUnidadeCodigo | ''>(TipoUnidadeCodigo.INSTITUTO, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    unidadeAcademica: new FormControl(false, { nonNullable: true }),
    vigenciaInicio: campoObrigatorio(dataAtualIso()),
    vigenciaFim: campoDeTexto(),
    motivoMudancaIdentificador: campoDeTexto(Validators.maxLength(MOTIVO_TAMANHO_MAXIMO)),
  };
}

export function criarFormularioDeUnidade(): FormGroup<UnidadeForm> {
  return new FormGroup<UnidadeForm>({
    ...controlesDeIdentificacao(),
    ...controlesDeClassificacaoEVigencia(),
  });
}

export function valoresEmBrancoDaUnidade(): ValoresDaUnidade {
  return {
    nome: '',
    alias: '',
    slug: '',
    sigla: '',
    codigo: '',
    unidadeSuperiorId: '',
    tipo: TipoUnidadeCodigo.INSTITUTO,
    unidadeAcademica: false,
    vigenciaInicio: dataAtualIso(),
    vigenciaFim: '',
    motivoMudancaIdentificador: '',
  };
}

export function valoresDaUnidade(unidade: UnidadeDto): ValoresDaUnidade {
  return {
    nome: unidade.nome,
    alias: unidade.alias ?? '',
    slug: unidade.slug,
    sigla: unidade.sigla,
    codigo: unidade.codigo,
    unidadeSuperiorId: unidade.unidadeSuperiorId ?? '',
    tipo: OPCOES_DE_TIPO.some((opcao) => opcao.value === unidade.tipo) ? unidade.tipo : '',
    unidadeAcademica: unidade.unidadeAcademica,
    vigenciaInicio: unidade.vigenciaInicio,
    vigenciaFim: unidade.vigenciaFim ?? '',
    motivoMudancaIdentificador: '',
  };
}

/** A cidade-sede que a unidade já tem, ou `null` quando não informada. */
export function cidadeDaEdicao(unidade: UnidadeDto): CidadeRef | null {
  return unidade.cidadeCodigoIbge === null
    ? null
    : {
        codigoIbge: unidade.cidadeCodigoIbge,
        nome: unidade.cidadeNome ?? '',
        uf: unidade.cidadeUf ?? '',
      };
}

export function controleDoCampoDoServidor(field: string): keyof UnidadeForm | null {
  return controlNameFromBackendField<keyof UnidadeForm>(field, CAMPOS);
}

function trioDaCidade(cidade: CidadeRef | null) {
  return {
    cidadeCodigoIbge: cidade?.codigoIbge ?? null,
    cidadeNome: cidade?.nome ?? null,
    cidadeUf: cidade?.uf ?? null,
  };
}

/** O que o pedido de criar e o de atualizar levam igual. */
function camposDoPedido(valor: ValoresDaUnidade, cidade: CidadeRef | null) {
  return {
    nome: valor.nome.trim(),
    alias: nullIfBlank(valor.alias),
    slug: valor.slug.trim(),
    sigla: valor.sigla.trim(),
    codigo: valor.codigo.trim(),
    unidadeSuperiorId: nullIfBlank(valor.unidadeSuperiorId),
    tipo: valor.tipo || null,
    unidadeAcademica: valor.unidadeAcademica,
    vigenciaFim: nullIfBlank(valor.vigenciaFim),
    ...trioDaCidade(cidade),
  };
}

export function comandoDeCriacao(
  valor: ValoresDaUnidade,
  cidade: CidadeRef | null,
): CriarUnidadeCommand {
  return { ...camposDoPedido(valor, cidade), vigenciaInicio: valor.vigenciaInicio };
}

/** A atualização não leva o início da vigência: o campo é somente leitura na edição. */
export function comandoDeAtualizacao(
  id: string,
  valor: ValoresDaUnidade,
  cidade: CidadeRef | null,
): AtualizarUnidadeCommand {
  return {
    id,
    ...camposDoPedido(valor, cidade),
    motivoMudancaIdentificador: nullIfBlank(valor.motivoMudancaIdentificador),
  };
}

/** A mensagem do campo: a do servidor, a obrigatoriedade ou a regra de tamanho violada. */
export function mensagemDoCampo(controle: AbstractControl): string | null {
  return mensagemDeErroDoCampoComFormato(controle, MENSAGEM_SEM_FORMATO);
}

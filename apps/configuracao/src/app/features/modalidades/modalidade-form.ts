import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AcaoQuandoIndeferidoToken,
  AtualizarModalidadeCommand,
  COMPOSICAO_RETIRA_DE,
  COMPOSICAO_VAGAS_DEFAULT,
  COMPOSICOES_VAGAS,
  ComposicaoVagasToken,
  CriarModalidadeCommand,
  ModalidadeDto,
  NATUREZA_LEGAL_DEFAULT,
  NaturezaLegalToken,
  RegraRemanejamentoToken,
} from '@uniplus/shared-data/configuracao';
import {
  controlNameFromBackendField,
  mensagemDeErroDoControle,
  nullIfBlank,
} from '../../shared/formulario';

const CODIGO_REGEX = /^[A-Z0-9_]+$/u;
const CODIGO_TAMANHO_MAX = 60;
const DESCRICAO_MAX = 300;
const BASE_LEGAL_MAX = 500;
const CODIGO_REFERENCIA_MAX = 60;
const VALIDADORES_DO_CODIGO = [
  Validators.required,
  Validators.maxLength(CODIGO_TAMANHO_MAX),
  Validators.pattern(CODIGO_REGEX),
];

export type RegraSelecao = RegraRemanejamentoToken | '';
export type AcaoSelecao = AcaoQuandoIndeferidoToken | '';

export interface ModalidadeForm {
  codigo: FormControl<string>;
  descricao: FormControl<string>;
  naturezaLegal: FormControl<NaturezaLegalToken>;
  composicaoVagas: FormControl<ComposicaoVagasToken>;
  composicaoOrigem: FormControl<string>;
  regraRemanejamento: FormControl<RegraSelecao>;
  remanejamentoDestino: FormControl<string>;
  remanejamentoPar: FormControl<string>;
  remanejamentoFallback: FormControl<string>;
  acaoQuandoIndeferido: FormControl<AcaoSelecao>;
  baseLegal: FormControl<string>;
}

export type ValoresDaModalidade = ReturnType<FormGroup<ModalidadeForm>['getRawValue']>;

/** As escolhas que dirigem quais campos aparecem e o que é exigido deles. */
export interface Condicionais {
  readonly natureza: NaturezaLegalToken;
  readonly composicao: ComposicaoVagasToken;
  readonly regra: RegraSelecao;
}

export const DESCRICAO_TAMANHO_MAXIMO = DESCRICAO_MAX;

const CONTROLES_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof ModalidadeForm>([
  'codigo',
  'descricao',
  'naturezaLegal',
  'composicaoVagas',
  'composicaoOrigem',
  'regraRemanejamento',
  'remanejamentoDestino',
  'remanejamentoPar',
  'remanejamentoFallback',
  'acaoQuandoIndeferido',
  'baseLegal',
]);

/** A regra de aplicabilidade não é controle do formulário: o editor a escreve fora dele. */
const CAMPO_DA_REGRA = 'regraDeAplicabilidade';

export function criarFormularioDeModalidade(): FormGroup<ModalidadeForm> {
  return new FormGroup<ModalidadeForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: VALIDADORES_DO_CODIGO,
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(DESCRICAO_MAX)],
    }),
    naturezaLegal: new FormControl<NaturezaLegalToken>(NATUREZA_LEGAL_DEFAULT, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    composicaoVagas: new FormControl<ComposicaoVagasToken>(COMPOSICAO_VAGAS_DEFAULT, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    composicaoOrigem: new FormControl('', { nonNullable: true }),
    regraRemanejamento: new FormControl<RegraSelecao>('', { nonNullable: true }),
    remanejamentoDestino: new FormControl('', { nonNullable: true }),
    remanejamentoPar: new FormControl('', { nonNullable: true }),
    remanejamentoFallback: new FormControl('', { nonNullable: true }),
    acaoQuandoIndeferido: new FormControl<AcaoSelecao>('', { nonNullable: true }),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(BASE_LEGAL_MAX)],
    }),
  });
}

export function valoresDaModalidade(dto: ModalidadeDto): ValoresDaModalidade {
  return {
    codigo: dto.codigo,
    descricao: dto.descricao ?? '',
    naturezaLegal: dto.naturezaLegal as NaturezaLegalToken,
    composicaoVagas: dto.composicaoVagas as ComposicaoVagasToken,
    composicaoOrigem: dto.composicaoOrigem ?? '',
    regraRemanejamento: (dto.regraRemanejamento ?? '') as RegraSelecao,
    remanejamentoDestino: dto.remanejamentoDestino ?? '',
    remanejamentoPar: dto.remanejamentoPar ?? '',
    remanejamentoFallback: dto.remanejamentoFallback ?? '',
    acaoQuandoIndeferido: (dto.acaoQuandoIndeferido ?? '') as AcaoSelecao,
    baseLegal: dto.baseLegal ?? '',
  };
}

export function condicionaisDe(valores: ValoresDaModalidade): Condicionais {
  return {
    natureza: valores.naturezaLegal,
    composicao: valores.composicaoVagas,
    regra: valores.regraRemanejamento,
  };
}

/**
 * Campos comuns aos comandos de criação e atualização (tudo exceto código e id), derivados
 * inteiramente dos valores do formulário. Os inaplicáveis são anulados aqui, espelhando as
 * invariantes do agregado, para não haver divergência entre o que está oculto e o que se envia.
 */
function camposComuns(
  valores: ValoresDaModalidade,
  regraDeAplicabilidade: CriarModalidadeCommand['regraDeAplicabilidade'],
): Omit<CriarModalidadeCommand, 'codigo'> {
  const retiraDe = valores.composicaoVagas === COMPOSICAO_RETIRA_DE;
  const regra = valores.naturezaLegal === 'AMPLA' ? null : nullIfBlank(valores.regraRemanejamento);
  return {
    descricao: nullIfBlank(valores.descricao),
    naturezaLegal: valores.naturezaLegal,
    composicaoVagas: valores.composicaoVagas,
    composicaoOrigem: retiraDe ? nullIfBlank(valores.composicaoOrigem) : null,
    regraRemanejamento: regra,
    remanejamentoDestino:
      regra === 'DESTINO_UNICO' ? nullIfBlank(valores.remanejamentoDestino) : null,
    remanejamentoPar: regra === 'CRUZADO' ? nullIfBlank(valores.remanejamentoPar) : null,
    remanejamentoFallback: regra === 'CRUZADO' ? nullIfBlank(valores.remanejamentoFallback) : null,
    regraDeAplicabilidade,
    acaoQuandoIndeferido: nullIfBlank(valores.acaoQuandoIndeferido),
    baseLegal: nullIfBlank(valores.baseLegal),
  };
}

export function comandoDeCriacao(
  valores: ValoresDaModalidade,
  regraDeAplicabilidade: CriarModalidadeCommand['regraDeAplicabilidade'],
): CriarModalidadeCommand {
  return {
    codigo: nullIfBlank(valores.codigo),
    ...camposComuns(valores, regraDeAplicabilidade),
  };
}

/** O código é imutável: não vai no comando de atualização. */
export function comandoDeAtualizacao(
  id: string,
  valores: ValoresDaModalidade,
  regraDeAplicabilidade: AtualizarModalidadeCommand['regraDeAplicabilidade'],
): AtualizarModalidadeCommand {
  return { id, ...camposComuns(valores, regraDeAplicabilidade) };
}

/** O controle do formulário que corresponde ao campo recusado pelo servidor, se houver. */
export function controleDoCampoDoServidor(field: string): keyof ModalidadeForm | null {
  return controlNameFromBackendField<keyof ModalidadeForm>(field, CONTROLES_DO_SERVIDOR);
}

/** Um trecho do caminho da recusa em camelCase, sem os índices de lista. */
function emCamelCase(trecho: string): string {
  const semIndices = trecho.replace(/(\[\d+\])+$/u, '');
  return semIndices.charAt(0).toLocaleLowerCase('pt-BR') + semIndices.slice(1);
}

/** A recusa é da regra quando o caminho passa por ela, até a condição (`regraDeAplicabilidade[0][1].valor`). */
export function ehDaRegra(field: string): boolean {
  return field.split('.').some((trecho) => emCamelCase(trecho) === CAMPO_DA_REGRA);
}

/** A mensagem do campo: a recusa do servidor vale mais que as regras locais, que nomeiam o formato. */
export function mensagemDoCampo(control: AbstractControl): string | null {
  const erros = control.errors;
  const exibir = control.touched || control.dirty;
  if (!exibir || erros === null || erros['backend']) return mensagemDeErroDoControle(control);
  if (erros['duplicado']) return 'Código já utilizado por outra modalidade viva.';
  if (erros['pattern']) return 'Use apenas maiúsculas, dígitos e sublinhado.';
  return mensagemDeErroDoControle(control);
}

/** Marca (ou desmarca) o código repetido, preservando os demais erros do controle. */
export function marcarCodigoRepetido(control: AbstractControl, repetido: boolean): void {
  if (repetido) {
    control.setErrors({ ...(control.errors ?? {}), duplicado: true });
    control.markAsTouched();
    return;
  }
  if (!control.hasError('duplicado')) return;
  const demais = { ...control.errors };
  delete demais['duplicado'];
  control.setErrors(Object.keys(demais).length > 0 ? demais : null);
}

export function regraDesabilitada(
  natureza: NaturezaLegalToken,
  valor: RegraRemanejamentoToken,
): boolean {
  switch (natureza) {
    case 'COTA_RESERVADA':
      return valor !== 'SEGUE_CASCATA';
    case 'ACAO_AFIRMATIVA':
      return valor === 'SEGUE_CASCATA';
    default:
      return false;
  }
}

export function dicaDaRegra(natureza: NaturezaLegalToken): string {
  switch (natureza) {
    case 'COTA_RESERVADA':
      return 'Cota da Lei 12.711 segue obrigatoriamente a cascata legal.';
    case 'ACAO_AFIRMATIVA':
      return 'Ação afirmativa não segue a cascata legal: escolha destino único ou remanejamento cruzado.';
    default:
      return 'Selecione a regra de remanejamento aplicável.';
  }
}

/**
 * Há argumentos digitados pela pessoa (destino, par, fallback) que a troca de natureza perderia —
 * só então a confirmação faz sentido. A regra, preenchida sozinha pela cota, não conta como dado dela.
 */
export function remanejamentoPreenchido(valores: ValoresDaModalidade): boolean {
  return (
    valores.remanejamentoDestino !== '' ||
    valores.remanejamentoPar !== '' ||
    valores.remanejamentoFallback !== ''
  );
}

export function naturezaCompativelComRegra(
  natureza: NaturezaLegalToken,
  regra: RegraSelecao,
): boolean {
  switch (natureza) {
    case 'AMPLA':
      return regra === '';
    case 'COTA_RESERVADA':
      return regra === 'SEGUE_CASCATA';
    default:
      return regra === 'DESTINO_UNICO' || regra === 'CRUZADO';
  }
}

function exigirSe(control: AbstractControl, aplicavel: boolean): void {
  if (aplicavel) {
    control.setValidators([Validators.required, Validators.maxLength(CODIGO_REFERENCIA_MAX)]);
  } else {
    control.clearValidators();
    control.setValue('', { emitEvent: false });
  }
  control.updateValueAndValidity({ emitEvent: false });
}

function reconciliarOrigem(controls: ModalidadeForm, composicao: ComposicaoVagasToken): void {
  exigirSe(controls.composicaoOrigem, composicao === COMPOSICAO_RETIRA_DE);
}

function reconciliarRegra(controls: ModalidadeForm, natureza: NaturezaLegalToken): void {
  const regra = controls.regraRemanejamento;
  if (natureza === 'AMPLA') {
    regra.setValue('', { emitEvent: false });
    regra.clearValidators();
  } else {
    if (natureza === 'COTA_RESERVADA') regra.setValue('SEGUE_CASCATA', { emitEvent: false });
    else if (regra.value === 'SEGUE_CASCATA') regra.setValue('', { emitEvent: false });
    regra.setValidators([Validators.required]);
  }
  regra.updateValueAndValidity({ emitEvent: false });
}

/**
 * Reconcilia validação e valores condicionais espelhando as invariantes do agregado `Modalidade`:
 * coerência natureza↔regra, composição RETIRA_DE⟺origem e argumentos por regra. Os campos
 * inaplicáveis são limpos aqui e anulados no comando, para não restar valor oculto obsoleto.
 */
export function reconciliarCondicionais(
  form: FormGroup<ModalidadeForm>,
  natureza: NaturezaLegalToken,
  composicao: ComposicaoVagasToken,
): void {
  const controls = form.controls;
  reconciliarOrigem(controls, composicao);
  reconciliarRegra(controls, natureza);
  const regra = controls.regraRemanejamento.value;
  exigirSe(controls.remanejamentoDestino, regra === 'DESTINO_UNICO');
  exigirSe(controls.remanejamentoPar, regra === 'CRUZADO');
  exigirSe(controls.remanejamentoFallback, regra === 'CRUZADO');
}

function clausulaDaComposicao(composicao: ComposicaoVagasToken, origem: string): string {
  if (composicao === COMPOSICAO_RETIRA_DE) {
    return origem
      ? `As vagas são retiradas da modalidade ${origem}.`
      : 'As vagas são retiradas de outra modalidade (informe a origem).';
  }
  const rotulo = COMPOSICOES_VAGAS.find((c) => c.value === composicao)?.label ?? composicao;
  return `Composição das vagas: ${rotulo.toLocaleLowerCase('pt-BR')}.`;
}

function clausulaDoRemanejamento(condicionais: Condicionais, valores: ValoresDaModalidade): string {
  const { natureza, regra } = condicionais;
  if (natureza === 'AMPLA') return 'Ampla concorrência não remaneja vagas ociosas.';
  if (natureza === 'COTA_RESERVADA') {
    return 'Cota da Lei 12.711: vagas ociosas seguem a cascata legal de remanejamento.';
  }
  if (regra === 'DESTINO_UNICO') {
    return valores.remanejamentoDestino
      ? `Vagas ociosas remanejam para ${valores.remanejamentoDestino}.`
      : 'Vagas ociosas remanejam para um destino único (informe o destino).';
  }
  if (regra === 'CRUZADO') {
    return valores.remanejamentoPar && valores.remanejamentoFallback
      ? `Remanejamento cruzado entre ${valores.remanejamentoPar} e ${valores.remanejamentoFallback}.`
      : 'Remanejamento cruzado (informe o par e o fallback).';
  }
  return 'Selecione a regra de remanejamento para esta modalidade.';
}

/** As frases que descrevem, em prosa, o efeito das escolhas atuais. */
export function resumoCondicional(
  condicionais: Condicionais,
  valores: ValoresDaModalidade,
): readonly string[] {
  return [
    clausulaDaComposicao(condicionais.composicao, valores.composicaoOrigem),
    clausulaDoRemanejamento(condicionais, valores),
  ];
}

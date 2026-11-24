import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AcaoQuandoIndeferidoCodigo,
  AtualizarModalidadeCommand,
  ComposicaoVagasCodigo,
  CriarModalidadeCommand,
  ModalidadeDto,
  NaturezaLegalCodigo,
  RegraRemanejamentoCodigo,
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

export type RegraSelecao = RegraRemanejamentoCodigo | '';
export type AcaoSelecao = AcaoQuandoIndeferidoCodigo | '';

export interface ModalidadeForm {
  codigo: FormControl<string>;
  descricao: FormControl<string>;
  naturezaLegal: FormControl<NaturezaLegalCodigo | ''>;
  composicaoVagas: FormControl<ComposicaoVagasCodigo | ''>;
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
  readonly natureza: NaturezaLegalCodigo | '';
  readonly composicao: ComposicaoVagasCodigo | '';
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

function controlesDeIdentificacao() {
  return {
    codigo: new FormControl('', { nonNullable: true, validators: VALIDADORES_DO_CODIGO }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(DESCRICAO_MAX)],
    }),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(BASE_LEGAL_MAX)],
    }),
  };
}

function controlesDeVagas() {
  return {
    naturezaLegal: new FormControl<NaturezaLegalCodigo | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    composicaoVagas: new FormControl<ComposicaoVagasCodigo | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    composicaoOrigem: new FormControl('', { nonNullable: true }),
    ...controlesDoRemanejamento(),
    acaoQuandoIndeferido: new FormControl<AcaoSelecao>('', { nonNullable: true }),
  };
}

function controlesDoRemanejamento() {
  return {
    regraRemanejamento: new FormControl<RegraSelecao>('', { nonNullable: true }),
    remanejamentoDestino: new FormControl('', { nonNullable: true }),
    remanejamentoPar: new FormControl('', { nonNullable: true }),
    remanejamentoFallback: new FormControl('', { nonNullable: true }),
  };
}

export function criarFormularioDeModalidade(): FormGroup<ModalidadeForm> {
  return new FormGroup<ModalidadeForm>({ ...controlesDeIdentificacao(), ...controlesDeVagas() });
}

function valoresDoRemanejamento(
  remanejamento: ModalidadeDto['remanejamento'],
): Pick<
  ValoresDaModalidade,
  'regraRemanejamento' | 'remanejamentoDestino' | 'remanejamentoPar' | 'remanejamentoFallback'
> {
  return {
    regraRemanejamento: remanejamento?.regra.codigo ?? '',
    remanejamentoDestino: remanejamento?.destino ?? '',
    remanejamentoPar: remanejamento?.par ?? '',
    remanejamentoFallback: remanejamento?.fallback ?? '',
  };
}

export function valoresDaModalidade(dto: ModalidadeDto): ValoresDaModalidade {
  return {
    codigo: dto.codigo,
    descricao: dto.descricao ?? '',
    naturezaLegal: dto.naturezaLegal.codigo,
    composicaoVagas: dto.composicaoVagas.codigo,
    composicaoOrigem: dto.composicaoOrigem ?? '',
    ...valoresDoRemanejamento(dto.remanejamento),
    acaoQuandoIndeferido: dto.acaoQuandoIndeferido?.codigo ?? '',
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
  return {
    descricao: nullIfBlank(valores.descricao),
    naturezaLegal: valores.naturezaLegal || null,
    composicaoVagas: valores.composicaoVagas || null,
    composicaoOrigem: origemDaComposicao(valores),
    remanejamento: camposDoRemanejamento(valores),
    regraDeAplicabilidade,
    acaoQuandoIndeferido: valores.acaoQuandoIndeferido || null,
    baseLegal: nullIfBlank(valores.baseLegal),
  };
}

function origemDaComposicao(valores: ValoresDaModalidade): string | null {
  const retiraDeOutraModalidade =
    valores.composicaoVagas === ComposicaoVagasCodigo.RETIRADA_DE_OUTRA_MODALIDADE;
  return retiraDeOutraModalidade ? nullIfBlank(valores.composicaoOrigem) : null;
}

function camposDoRemanejamento(
  valores: ValoresDaModalidade,
): CriarModalidadeCommand['remanejamento'] {
  const regra =
    valores.naturezaLegal === NaturezaLegalCodigo.AMPLA ? null : valores.regraRemanejamento || null;
  if (regra === null) return null;
  return {
    regra,
    ...argumentosDoRemanejamento(regra, valores),
  };
}

function argumentosDoRemanejamento(regra: RegraRemanejamentoCodigo, valores: ValoresDaModalidade) {
  return {
    destino:
      regra === RegraRemanejamentoCodigo.DESTINO_UNICO
        ? nullIfBlank(valores.remanejamentoDestino)
        : null,
    par: regra === RegraRemanejamentoCodigo.CRUZADO ? nullIfBlank(valores.remanejamentoPar) : null,
    fallback:
      regra === RegraRemanejamentoCodigo.CRUZADO
        ? nullIfBlank(valores.remanejamentoFallback)
        : null,
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
  const campos: Readonly<Record<string, keyof ModalidadeForm>> = {
    regra: 'regraRemanejamento',
    destino: 'remanejamentoDestino',
    par: 'remanejamentoPar',
    fallback: 'remanejamentoFallback',
  };
  const partes = field.split('.').map(emCamelCase);
  if (partes.includes('remanejamento')) return campos[partes.at(-1) ?? ''] ?? null;
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
  natureza: NaturezaLegalCodigo | '',
  valor: RegraRemanejamentoCodigo,
): boolean {
  switch (natureza) {
    case NaturezaLegalCodigo.COTA_RESERVADA:
      return valor !== RegraRemanejamentoCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO;
    case NaturezaLegalCodigo.ACAO_AFIRMATIVA:
      return valor === RegraRemanejamentoCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO;
    default:
      return false;
  }
}

export function dicaDaRegra(natureza: NaturezaLegalCodigo | ''): string {
  switch (natureza) {
    case NaturezaLegalCodigo.COTA_RESERVADA:
      return 'Cota da Lei 12.711 segue obrigatoriamente a cascata legal.';
    case NaturezaLegalCodigo.ACAO_AFIRMATIVA:
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
  natureza: NaturezaLegalCodigo | '',
  regra: RegraSelecao,
): boolean {
  switch (natureza) {
    case NaturezaLegalCodigo.AMPLA:
      return regra === '';
    case NaturezaLegalCodigo.COTA_RESERVADA:
      return regra === RegraRemanejamentoCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO;
    default:
      return regraDeAcaoAfirmativa(regra);
  }
}

function regraDeAcaoAfirmativa(regra: RegraSelecao): boolean {
  return (
    regra === RegraRemanejamentoCodigo.DESTINO_UNICO || regra === RegraRemanejamentoCodigo.CRUZADO
  );
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

function reconciliarOrigem(controls: ModalidadeForm, composicao: ComposicaoVagasCodigo | ''): void {
  exigirSe(
    controls.composicaoOrigem,
    composicao === ComposicaoVagasCodigo.RETIRADA_DE_OUTRA_MODALIDADE,
  );
}

function reconciliarRegra(controls: ModalidadeForm, natureza: NaturezaLegalCodigo | ''): void {
  const regra = controls.regraRemanejamento;
  if (natureza === NaturezaLegalCodigo.AMPLA) {
    regra.setValue('', { emitEvent: false });
    regra.clearValidators();
  } else {
    if (natureza === NaturezaLegalCodigo.COTA_RESERVADA)
      regra.setValue(RegraRemanejamentoCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO, { emitEvent: false });
    else if (regra.value === RegraRemanejamentoCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO)
      regra.setValue('', { emitEvent: false });
    regra.setValidators([Validators.required]);
  }
  regra.updateValueAndValidity({ emitEvent: false });
}

/**
 * Reconcilia validação e valores condicionais espelhando as invariantes do agregado `Modalidade`:
 * coerência natureza↔regra, composição RETIRADA_DE_OUTRA_MODALIDADE⟺origem e argumentos por regra. Os campos
 * inaplicáveis são limpos aqui e anulados no comando, para não restar valor oculto obsoleto.
 */
export function reconciliarCondicionais(
  form: FormGroup<ModalidadeForm>,
  natureza: NaturezaLegalCodigo | '',
  composicao: ComposicaoVagasCodigo | '',
): void {
  const controls = form.controls;
  reconciliarOrigem(controls, composicao);
  reconciliarRegra(controls, natureza);
  const regra = controls.regraRemanejamento.value;
  exigirSe(controls.remanejamentoDestino, regra === RegraRemanejamentoCodigo.DESTINO_UNICO);
  exigirSe(controls.remanejamentoPar, regra === RegraRemanejamentoCodigo.CRUZADO);
  exigirSe(controls.remanejamentoFallback, regra === RegraRemanejamentoCodigo.CRUZADO);
}

export { resumoCondicional } from './resumo-da-modalidade';

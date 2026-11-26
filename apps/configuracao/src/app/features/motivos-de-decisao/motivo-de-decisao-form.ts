import { AbstractControl, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { validadoresDoCodigo } from '../../shared/codigo-de-cadastro';
import {
  AtualizarMotivoDeDecisaoCommand,
  CriarMotivoDeDecisaoCommand,
  MotivoDeDecisaoDto,
  TipoMotivoDeDecisaoCodigo,
  FundamentoIsencao,
} from '@uniplus/shared-data/selecao';
import { codigoExigidoDoContrato } from '@uniplus/shared-data/utils';
import { textoDoFormatoDoCodigo } from '@uniplus/shared-utils';
import {
  controlNameFromBackendField,
  mensagemDeErroDoCampoComFormato,
  nullIfBlank,
} from '../../shared/formulario';

export interface MotivoForm {
  codigo: FormControl<string>;
  sentido: FormControl<CriarMotivoDeDecisaoCommand['sentido']>;
  subclassificacao: FormControl<string>;
  descricao: FormControl<string>;
}

export type ValoresDoMotivo = ReturnType<FormGroup<MotivoForm>['getRawValue']>;

export const MOTIVO_EM_BRANCO: ValoresDoMotivo = {
  codigo: '',
  sentido: null,
  subclassificacao: '',
  descricao: '',
};

const DESCRICAO_TAMANHO_MAXIMO = 500;

const MENSAGEM_DE_FORMATO = textoDoFormatoDoCodigo(50);

const CONTROLES_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof MotivoForm>([
  'codigo',
  'sentido',
  'subclassificacao',
  'descricao',
]);

const VALIDADORES_DO_CODIGO = [Validators.required, ...validadoresDoCodigo(50)];

const VALIDADORES_DA_DESCRICAO = [
  Validators.required,
  Validators.minLength(3),
  Validators.maxLength(DESCRICAO_TAMANHO_MAXIMO),
];

function controleDeTexto(validators: ValidatorFn[] = []): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators });
}

export function criarFormularioDeMotivo(): FormGroup<MotivoForm> {
  return new FormGroup<MotivoForm>({
    codigo: controleDeTexto(VALIDADORES_DO_CODIGO),
    sentido: new FormControl<CriarMotivoDeDecisaoCommand['sentido']>(null, Validators.required),
    subclassificacao: controleDeTexto(),
    descricao: controleDeTexto(VALIDADORES_DA_DESCRICAO),
  });
}

export type ModoDoMotivo = 'criar' | 'editar';

/**
 * Na criação, tipo à parte, todos os campos valem e a subclassificação só entra onde o tipo a pede;
 * na edição só a descrição muda, e o resto aparece como veio do cadastro.
 */
export function ajustarAoModo(
  form: FormGroup<MotivoForm>,
  modo: ModoDoMotivo,
  pedeSubclassificacao: boolean,
): void {
  const { codigo, sentido, subclassificacao } = form.controls;
  const criando = modo === 'criar';
  const pedida = criando && pedeSubclassificacao;
  habilitar(codigo, criando);
  habilitar(sentido, criando);
  subclassificacao.setValidators(pedida ? Validators.required : null);
  habilitar(subclassificacao, pedida);
  subclassificacao.updateValueAndValidity({ emitEvent: false });
  form.updateValueAndValidity({ emitEvent: false });
}

function habilitar(controle: AbstractControl, habilitado: boolean): void {
  if (habilitado) {
    controle.enable({ emitEvent: false });
  } else {
    controle.disable({ emitEvent: false });
  }
}

export function valoresDoMotivo(motivo: MotivoDeDecisaoDto): ValoresDoMotivo {
  return {
    codigo: motivo.codigo,
    sentido: motivo.sentido.codigo,
    subclassificacao: motivo.subclassificacao ?? '',
    descricao: motivo.descricao,
  };
}

export function controleDoCampoDoServidor(field: string): keyof MotivoForm | null {
  return controlNameFromBackendField<keyof MotivoForm>(field, CONTROLES_DO_SERVIDOR);
}

export function comandoDeCriacao(
  tipo: string,
  valores: ValoresDoMotivo,
): CriarMotivoDeDecisaoCommand {
  return {
    tipo: codigoExigidoDoContrato(TipoMotivoDeDecisaoCodigo, tipo, 'tipo de motivo'),
    codigo: valores.codigo || null,
    descricao: nullIfBlank(valores.descricao),
    subclassificacao: valores.subclassificacao.trim()
      ? codigoExigidoDoContrato(FundamentoIsencao, valores.subclassificacao.trim(), 'fundamento')
      : null,
    sentido: valores.sentido,
  };
}

/** Só a descrição muda depois da criação. */
export function comandoDeAtualizacao(
  id: string,
  valores: ValoresDoMotivo,
): AtualizarMotivoDeDecisaoCommand {
  return { id, descricao: nullIfBlank(valores.descricao) };
}

/** A mensagem do campo: a do servidor ou a obrigatoriedade; no mais, a regra de tamanho ou formato violada. */
export function mensagemDoCampo(control: AbstractControl): string | null {
  return mensagemDeErroDoCampoComFormato(control, MENSAGEM_DE_FORMATO);
}

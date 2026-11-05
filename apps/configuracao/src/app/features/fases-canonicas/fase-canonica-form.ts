import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AtualizarFaseCanonicaCommand, FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';

export const CODIGO_FASE_AVALIACAO = 'AVALIACAO';
export const CODIGOS_FASE_COM_COMPLEMENTACAO: readonly string[] = ['HOMOLOGACAO', 'RECURSOS'];
export const CODIGO_FASE_SOLICITACAO_ISENCAO = 'SOLICITACAO_ISENCAO';

export interface FaseForm {
  codigo: FormControl<string>;
  unidadeSugeridaId: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
  baseLegal: FormControl<string>;
  agrupaEtapas: FormControl<boolean>;
  permiteComplementacao: FormControl<boolean>;
  origemData: FormControl<string>;
  coletaInscricao: FormControl<boolean>;
  coletaSolicitacaoIsencao: FormControl<boolean>;
}

const CAMPOS: ReadonlySet<string> = new Set<keyof FaseForm>([
  'codigo',
  'unidadeSugeridaId',
  'nome',
  'descricao',
  'baseLegal',
  'agrupaEtapas',
  'permiteComplementacao',
  'origemData',
  'coletaInscricao',
  'coletaSolicitacaoIsencao',
]);

export function criarFormularioDeFase(): FormGroup<FaseForm> {
  return new FormGroup<FaseForm>({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    unidadeSugeridaId: new FormControl('', { nonNullable: true }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
    descricao: new FormControl('', { nonNullable: true }),
    baseLegal: new FormControl('', { nonNullable: true }),
    agrupaEtapas: new FormControl(false, { nonNullable: true }),
    permiteComplementacao: new FormControl(false, { nonNullable: true }),
    origemData: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    coletaInscricao: new FormControl(false, { nonNullable: true }),
    coletaSolicitacaoIsencao: new FormControl(false, { nonNullable: true }),
  });
}

export function valoresDaFase(fase: FaseCanonicaDto) {
  return {
    codigo: fase.codigo,
    unidadeSugeridaId: fase.unidadeSugerida?.origemId ?? '',
    nome: fase.nome,
    descricao: fase.descricao ?? '',
    baseLegal: fase.baseLegal ?? '',
    agrupaEtapas: fase.agrupaEtapas,
    permiteComplementacao: fase.permiteComplementacao,
    origemData: fase.origemData,
    coletaInscricao: fase.coletaInscricao,
    coletaSolicitacaoIsencao: fase.coletaSolicitacaoIsencao,
  };
}

export function controleDoCampoDoServidor(field: string): keyof FaseForm | null {
  return controlNameFromBackendField<keyof FaseForm>(field, CAMPOS);
}

/**
 * A marca de isenção é derivada do código, e a fase de isenção não coleta inscrição: o agregado
 * recusa as duas janelas na mesma fase.
 */
export function derivarMarcaDeIsencao(form: FormGroup<FaseForm>, codigo: string): void {
  const ehIsencao = codigo === CODIGO_FASE_SOLICITACAO_ISENCAO;
  const { coletaSolicitacaoIsencao, coletaInscricao } = form.controls;
  if (coletaSolicitacaoIsencao.value !== ehIsencao) coletaSolicitacaoIsencao.setValue(ehIsencao);
  if (ehIsencao && coletaInscricao.value) coletaInscricao.setValue(false);
}

export function comandoDeAtualizacao(
  id: string,
  form: FormGroup<FaseForm>,
): AtualizarFaseCanonicaCommand {
  const valor = form.getRawValue();
  return {
    id,
    nome: valor.nome.trim(),
    descricao: nullIfBlank(valor.descricao),
    unidadeSugeridaId: nullIfBlank(valor.unidadeSugeridaId),
    agrupaEtapas: valor.codigo === CODIGO_FASE_AVALIACAO ? valor.agrupaEtapas : false,
    permiteComplementacao: CODIGOS_FASE_COM_COMPLEMENTACAO.includes(valor.codigo)
      ? valor.permiteComplementacao
      : false,
    baseLegal: nullIfBlank(valor.baseLegal),
    origemData: valor.origemData,
    coletaInscricao: valor.coletaInscricao,
    coletaSolicitacaoIsencao: valor.coletaSolicitacaoIsencao,
  };
}

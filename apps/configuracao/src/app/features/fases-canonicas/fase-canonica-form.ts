import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarFaseCanonicaCommand,
  FaseCanonicaDto,
  OrigemDataFaseCodigo,
} from '@uniplus/shared-data/configuracao';
import {
  controlNameFromBackendField,
  controleDeMarca,
  controleDeTexto,
  nullIfBlank,
} from '../../shared/formulario';

export const CODIGO_FASE_SOLICITACAO_ISENCAO = 'SOLICITACAO_ISENCAO';

/** Quais sinalizadores de fase a tela oferece para edição. */
export interface SinalizadoresAdmitidos {
  readonly agrupaEtapas: boolean;
  readonly permiteComplementacao: boolean;
}

/**
 * Único ponto que decide a visibilidade dos campos "agrupa etapas" e "permite complementação":
 * a fase informa o que admite por `admiteAgruparEtapas` e `admiteComplementacao`. Sem fase em
 * edição, nenhum dos dois é oferecido. O comando de atualização não depende dela: devolve os
 * sinalizadores como foram lidos.
 */
export function sinalizadoresAdmitidos(fase: FaseCanonicaDto | null): SinalizadoresAdmitidos {
  return {
    agrupaEtapas: fase?.admiteAgruparEtapas ?? false,
    permiteComplementacao: fase?.admiteComplementacao ?? false,
  };
}

export interface FaseForm {
  codigo: FormControl<string>;
  unidadeSugeridaId: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
  baseLegal: FormControl<string>;
  agrupaEtapas: FormControl<boolean>;
  permiteComplementacao: FormControl<boolean>;
  origemData: FormControl<OrigemDataFaseCodigo | null>;
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
    codigo: controleDeTexto(Validators.required, Validators.maxLength(60)),
    unidadeSugeridaId: controleDeTexto(),
    nome: controleDeTexto(Validators.required, Validators.maxLength(200)),
    descricao: controleDeTexto(Validators.maxLength(300)),
    baseLegal: controleDeTexto(Validators.maxLength(500)),
    agrupaEtapas: controleDeMarca(false),
    permiteComplementacao: controleDeMarca(false),
    origemData: new FormControl<OrigemDataFaseCodigo | null>(null, Validators.required),
    coletaInscricao: controleDeMarca(false),
    coletaSolicitacaoIsencao: controleDeMarca(false),
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
    origemData: fase.origemData.codigo,
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

type ValoresDaFase = ReturnType<FormGroup<FaseForm>['getRawValue']>;

function textosAparados(valor: ValoresDaFase) {
  return {
    nome: valor.nome.trim(),
    descricao: nullIfBlank(valor.descricao),
    unidadeSugeridaId: nullIfBlank(valor.unidadeSugeridaId),
    baseLegal: nullIfBlank(valor.baseLegal),
  };
}

export function comandoDeAtualizacao(
  id: string,
  form: FormGroup<FaseForm>,
): AtualizarFaseCanonicaCommand {
  const valor = form.getRawValue();
  return {
    id,
    ...textosAparados(valor),
    agrupaEtapas: valor.agrupaEtapas,
    permiteComplementacao: valor.permiteComplementacao,
    origemData: valor.origemData,
    coletaInscricao: valor.coletaInscricao,
    coletaSolicitacaoIsencao: valor.coletaSolicitacaoIsencao,
  };
}

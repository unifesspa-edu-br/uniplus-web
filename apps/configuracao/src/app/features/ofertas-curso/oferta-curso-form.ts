import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarOfertaCursoCommand,
  CriarOfertaCursoCommand,
  OfertaCursoDto,
  PROGRAMA_DE_OFERTA_REGULAR,
  REGIME_DE_FUNCIONAMENTO_EXTENSIVO,
  REGIME_DE_TURNO_REGULAR,
  ordenarTurnosCanonicamente,
} from '@uniplus/shared-data/configuracao';
import {
  controlNameFromBackendField,
  mensagemDeErroDoControle,
  nullIfBlank,
} from '../../shared/formulario';
import { cardinalidadeDeTurnos, compatibilidadeComRegimeDeTurno } from './turnos-da-oferta';

export interface OfertaCursoForm {
  cursoId: FormControl<string>;
  localOfertaId: FormControl<string>;
  unidadeOfertanteOrigemId: FormControl<string>;
  programaDeOferta: FormControl<string>;
  formatoPedagogico: FormControl<string>;
  regimeDeTurno: FormControl<string>;
  turnos: FormControl<readonly string[]>;
  eMecCodigo: FormControl<string>;
  codigoSga: FormControl<string>;
  vagasAnuaisAutorizadas: FormControl<number | null>;
  baseLegal: FormControl<string>;
  atoAutorizacaoMec: FormControl<string>;
  regimeDeFuncionamento: FormControl<string>;
}

export type ValoresDaOferta = ReturnType<FormGroup<OfertaCursoForm>['getRawValue']>;

export const OFERTA_EM_BRANCO: ValoresDaOferta = {
  cursoId: '',
  localOfertaId: '',
  unidadeOfertanteOrigemId: '',
  programaDeOferta: PROGRAMA_DE_OFERTA_REGULAR,
  formatoPedagogico: 'PRESENCIAL',
  regimeDeTurno: REGIME_DE_TURNO_REGULAR,
  turnos: [],
  eMecCodigo: '',
  codigoSga: '',
  vagasAnuaisAutorizadas: null,
  baseLegal: '',
  atoAutorizacaoMec: '',
  regimeDeFuncionamento: REGIME_DE_FUNCIONAMENTO_EXTENSIVO,
};

const PREFIXO_DO_CODIGO = 'uniplus.configuracao.oferta_curso.';

const CAMPOS: ReadonlySet<string> = new Set<keyof OfertaCursoForm>([
  'programaDeOferta',
  'formatoPedagogico',
  'regimeDeTurno',
  'turnos',
  'eMecCodigo',
  'codigoSga',
  'vagasAnuaisAutorizadas',
  'baseLegal',
  'atoAutorizacaoMec',
  'regimeDeFuncionamento',
]);

/**
 * Recusas de domínio que se referem a um vínculo mas não trazem `errors[]` com o campo (a
 * existência de curso, local e unidade é checada fora da validação dos campos): o sufixo do
 * código de wire e o controle que mostra a mensagem. As demais recusas de campo vêm em `errors[]`.
 */
const CONTROLE_DO_CODIGO: ReadonlyMap<string, keyof OfertaCursoForm> = new Map([
  ['curso_inexistente_ou_removido', 'cursoId'],
  ['local_oferta_inexistente_ou_removido', 'localOfertaId'],
  ['unidade_ofertante_inexistente', 'unidadeOfertanteOrigemId'],
  ['unidade_ofertante_origem_obrigatoria', 'unidadeOfertanteOrigemId'],
]);

const obrigatorio = (): FormControl<string> =>
  new FormControl('', { nonNullable: true, validators: [Validators.required] });

const opcional = (maximo: number): FormControl<string> =>
  new FormControl('', { nonNullable: true, validators: [Validators.maxLength(maximo)] });

const obrigatorioCom = (valor: string): FormControl<string> =>
  new FormControl(valor, { nonNullable: true, validators: [Validators.required] });

export function criarFormularioDeOferta(): FormGroup<OfertaCursoForm> {
  return new FormGroup<OfertaCursoForm>({
    cursoId: obrigatorio(),
    localOfertaId: obrigatorio(),
    unidadeOfertanteOrigemId: obrigatorio(),
    programaDeOferta: obrigatorioCom(PROGRAMA_DE_OFERTA_REGULAR),
    formatoPedagogico: obrigatorioCom('PRESENCIAL'),
    regimeDeTurno: obrigatorioCom(REGIME_DE_TURNO_REGULAR),
    turnos: new FormControl<readonly string[]>([], {
      nonNullable: true,
      validators: [cardinalidadeDeTurnos],
    }),
    eMecCodigo: opcional(20),
    codigoSga: opcional(30),
    vagasAnuaisAutorizadas: new FormControl<number | null>(null, {
      validators: [Validators.min(0)],
    }),
    baseLegal: opcional(500),
    atoAutorizacaoMec: opcional(300),
    regimeDeFuncionamento: new FormControl(REGIME_DE_FUNCIONAMENTO_EXTENSIVO, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(30), compatibilidadeComRegimeDeTurno],
    }),
  });
}

export function valoresDaOferta(oferta: OfertaCursoDto): ValoresDaOferta {
  return {
    cursoId: oferta.cursoId,
    localOfertaId: oferta.localOfertaId,
    unidadeOfertanteOrigemId: oferta.unidadeOfertante.origemId,
    programaDeOferta: oferta.programaDeOferta,
    formatoPedagogico: oferta.formatoPedagogico,
    regimeDeTurno: oferta.regimeDeTurno,
    regimeDeFuncionamento: oferta.regimeDeFuncionamento,
    turnos: ordenarTurnosCanonicamente(oferta.turnos),
    eMecCodigo: oferta.eMecCodigo ?? '',
    codigoSga: oferta.codigoSga ?? '',
    vagasAnuaisAutorizadas: oferta.vagasAnuaisAutorizadas,
    baseLegal: oferta.baseLegal ?? '',
    atoAutorizacaoMec: oferta.atoAutorizacaoMec ?? '',
  };
}

/** O controle do formulário que corresponde ao `field` de um erro de validação da API. */
export function controleDoCampoDoServidor(field: string): keyof OfertaCursoForm | null {
  return controlNameFromBackendField<keyof OfertaCursoForm>(field, CAMPOS);
}

/** O controle que mostra a recusa de vínculo de código `code`, se ele se refere a um campo. */
export function controleDoCodigoDoServidor(code: string | undefined): keyof OfertaCursoForm | null {
  if (code === undefined || !code.startsWith(PREFIXO_DO_CODIGO)) {
    return null;
  }
  return CONTROLE_DO_CODIGO.get(code.slice(PREFIXO_DO_CODIGO.length)) ?? null;
}

function camposDaOferta(valores: ValoresDaOferta) {
  return {
    programaDeOferta: valores.programaDeOferta,
    formatoPedagogico: valores.formatoPedagogico,
    regimeDeTurno: valores.regimeDeTurno,
    turnos: ordenarTurnosCanonicamente(valores.turnos),
    eMecCodigo: nullIfBlank(valores.eMecCodigo),
    codigoSga: nullIfBlank(valores.codigoSga),
    vagasAnuaisAutorizadas: valores.vagasAnuaisAutorizadas,
    baseLegal: nullIfBlank(valores.baseLegal),
    atoAutorizacaoMec: nullIfBlank(valores.atoAutorizacaoMec),
    regimeDeFuncionamento: nullIfBlank(valores.regimeDeFuncionamento),
  };
}

export function comandoDeCriacao(valores: ValoresDaOferta): CriarOfertaCursoCommand {
  return {
    cursoId: valores.cursoId,
    localOfertaId: valores.localOfertaId,
    unidadeOfertanteOrigemId: valores.unidadeOfertanteOrigemId,
    ...camposDaOferta(valores),
  };
}

/** Os três vínculos são imutáveis depois da criação: o comando de atualização não os aceita. */
export function comandoDeAtualizacao(
  id: string,
  valores: ValoresDaOferta,
): AtualizarOfertaCursoCommand {
  return { id, ...camposDaOferta(valores) };
}

/**
 * A mensagem do campo: a do servidor, a obrigatoriedade e o tamanho vêm do formulário compartilhado;
 * as regras de turno, regime e vagas da oferta têm texto próprio.
 */
export function mensagemDeErroDaOferta(controle: AbstractControl): string | null {
  const mensagem = mensagemDeErroDoControle(controle);
  const erros = controle.errors;
  if (mensagem === null || erros === null || erros['backend'] || erros['required']) {
    return mensagem;
  }
  return erros['maxlength'] ? mensagem : (mensagemDaRegraDaOferta(erros) ?? mensagem);
}

function mensagemDaRegraDaOferta(erros: Record<string, unknown>): string | null {
  if (erros['turnosObrigatorios']) {
    return 'Marque ao menos um turno — nenhum formato pedagógico dispensa o turno.';
  }
  if (erros['cardinalidadeTurnos']) {
    const { regime, exigidos } = erros['cardinalidadeTurnos'] as {
      regime: string;
      exigidos: number;
    };
    return exigidos === 1
      ? `O regime ${regime} exige exatamente um turno.`
      : `O regime ${regime} exige exatamente ${exigidos} turnos distintos.`;
  }
  if (erros['turnoRepetido']) return 'Os turnos devem ser distintos entre si.';
  if (erros['min']) return 'Valor não pode ser negativo.';
  const incompativel = erros['regimeFuncionamentoIncompativelRegimeTurno'] as
    | { regimeDeTurno: string }
    | undefined;
  return incompativel
    ? `A oferta INTENSIVO exige regime de turno INTEGRAL; foi declarado ${incompativel.regimeDeTurno}.`
    : null;
}

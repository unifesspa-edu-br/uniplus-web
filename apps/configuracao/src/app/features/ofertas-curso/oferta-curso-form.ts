import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarOfertaCursoCommand,
  CriarOfertaCursoCommand,
  OfertaCursoDto,
  ProgramaDeOfertaCodigo,
  FormatoPedagogicoCodigo,
  RegimeDeFuncionamentoCodigo,
  RegimeDeTurnoCodigo,
  TurnoOfertaCodigo,
} from '@uniplus/shared-data/configuracao';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';
import {
  controlNameFromBackendField,
  mensagemDeErroDoControle,
  nullIfBlank,
} from '../../shared/formulario';
import {
  cardinalidadeDeTurnos,
  compatibilidadeComRegimeDeTurno,
  ordenarTurnos,
} from './turnos-da-oferta';

export interface OfertaCursoForm {
  codigo: FormControl<string>;
  cursoId: FormControl<string>;
  localOfertaId: FormControl<string>;
  unidadeOfertanteOrigemId: FormControl<string>;
  programaDeOferta: FormControl<ProgramaDeOfertaCodigo>;
  formatoPedagogico: FormControl<FormatoPedagogicoCodigo>;
  regimeDeTurno: FormControl<RegimeDeTurnoCodigo>;
  turnos: FormControl<readonly TurnoOfertaCodigo[]>;
  codigoEmec: FormControl<string>;
  codigoNoSistemaAcademico: FormControl<string>;
  vagasAnuaisAutorizadas: FormControl<number | null>;
  baseLegal: FormControl<string>;
  atoAutorizacaoMec: FormControl<string>;
  regimeDeFuncionamento: FormControl<RegimeDeFuncionamentoCodigo>;
}

export type ValoresDaOferta = ReturnType<FormGroup<OfertaCursoForm>['getRawValue']>;

export const OFERTA_EM_BRANCO: ValoresDaOferta = {
  codigo: '',
  cursoId: '',
  localOfertaId: '',
  unidadeOfertanteOrigemId: '',
  programaDeOferta: ProgramaDeOfertaCodigo.REGULAR,
  formatoPedagogico: FormatoPedagogicoCodigo.PRESENCIAL,
  regimeDeTurno: RegimeDeTurnoCodigo.REGULAR,
  turnos: [],
  codigoEmec: '',
  codigoNoSistemaAcademico: '',
  vagasAnuaisAutorizadas: null,
  baseLegal: '',
  atoAutorizacaoMec: '',
  regimeDeFuncionamento: RegimeDeFuncionamentoCodigo.EXTENSIVO,
};

const PREFIXO_DO_CODIGO = 'uniplus.configuracao.oferta_curso.';

const CAMPOS: ReadonlySet<string> = new Set<keyof OfertaCursoForm>([
  'codigo',
  'programaDeOferta',
  'formatoPedagogico',
  'regimeDeTurno',
  'turnos',
  'codigoEmec',
  'codigoNoSistemaAcademico',
  'vagasAnuaisAutorizadas',
  'baseLegal',
  'atoAutorizacaoMec',
  'regimeDeFuncionamento',
]);

/**
 * Recusas de domínio que se referem a um campo mas não trazem `errors[]` com ele (a existência de
 * curso, local e unidade e a unicidade do código são checadas fora da validação dos campos): o
 * sufixo do código de wire e o controle que mostra a mensagem. As demais recusas de campo vêm em
 * `errors[]`.
 */
const CONTROLE_DO_CODIGO: ReadonlyMap<string, keyof OfertaCursoForm> = new Map([
  ['curso_inexistente_ou_removido', 'cursoId'],
  ['local_oferta_inexistente_ou_removido', 'localOfertaId'],
  ['unidade_ofertante_inexistente', 'unidadeOfertanteOrigemId'],
  ['unidade_ofertante_origem_obrigatoria', 'unidadeOfertanteOrigemId'],
  ['codigo_obrigatorio', 'codigo'],
  ['codigo_formato_invalido', 'codigo'],
  ['codigo_ja_em_uso', 'codigo'],
]);

const obrigatorio = (): FormControl<string> =>
  new FormControl('', { nonNullable: true, validators: [Validators.required] });

const opcional = (maximo: number): FormControl<string> =>
  new FormControl('', { nonNullable: true, validators: [Validators.maxLength(maximo)] });

const obrigatorioCom = <T extends string>(valor: T): FormControl<T> =>
  new FormControl<T>(valor, { nonNullable: true, validators: [Validators.required] });

export function criarFormularioDeOferta(): FormGroup<OfertaCursoForm> {
  return new FormGroup<OfertaCursoForm>({
    ...controlesDeIdentificacao(),
    ...controlesDoRegime(),
    ...controlesComplementares(),
  });
}

function controlesDeIdentificacao() {
  return {
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO),
        Validators.pattern(CODIGO_CADASTRO_FORMATO),
      ],
    }),
    cursoId: obrigatorio(),
    localOfertaId: obrigatorio(),
    unidadeOfertanteOrigemId: obrigatorio(),
  };
}

function controlesDoRegime() {
  return {
    programaDeOferta: obrigatorioCom<ProgramaDeOfertaCodigo>(ProgramaDeOfertaCodigo.REGULAR),
    formatoPedagogico: obrigatorioCom<FormatoPedagogicoCodigo>(FormatoPedagogicoCodigo.PRESENCIAL),
    regimeDeTurno: obrigatorioCom<RegimeDeTurnoCodigo>(RegimeDeTurnoCodigo.REGULAR),
    ...controlesDeTurnos(),
  };
}

function controlesDeTurnos() {
  return {
    turnos: new FormControl<readonly TurnoOfertaCodigo[]>([], {
      nonNullable: true,
      validators: [cardinalidadeDeTurnos],
    }),
    regimeDeFuncionamento: new FormControl<RegimeDeFuncionamentoCodigo>(
      RegimeDeFuncionamentoCodigo.EXTENSIVO,
      { nonNullable: true, validators: [Validators.required, compatibilidadeComRegimeDeTurno] },
    ),
  };
}

function controlesComplementares() {
  return {
    codigoEmec: opcional(20),
    codigoNoSistemaAcademico: opcional(30),
    vagasAnuaisAutorizadas: new FormControl<number | null>(null, {
      validators: [Validators.min(0)],
    }),
    baseLegal: opcional(500),
    atoAutorizacaoMec: opcional(300),
  };
}

export function valoresDaOferta(oferta: OfertaCursoDto): ValoresDaOferta {
  return {
    codigo: oferta.codigo,
    cursoId: oferta.cursoId,
    localOfertaId: oferta.localOfertaId,
    unidadeOfertanteOrigemId: oferta.unidadeOfertante.origemId,
    ...valoresDoRegime(oferta),
    codigoEmec: oferta.codigoEmec ?? '',
    codigoNoSistemaAcademico: oferta.codigoNoSistemaAcademico ?? '',
    vagasAnuaisAutorizadas: oferta.vagasAnuaisAutorizadas,
    baseLegal: oferta.baseLegal ?? '',
    atoAutorizacaoMec: oferta.atoAutorizacaoMec ?? '',
  };
}

function valoresDoRegime(oferta: OfertaCursoDto) {
  return {
    programaDeOferta: oferta.programaDeOferta.codigo,
    formatoPedagogico: oferta.formatoPedagogico.codigo,
    regimeDeTurno: oferta.regimeDeTurno.codigo,
    regimeDeFuncionamento: oferta.regimeDeFuncionamento.codigo,
    turnos: ordenarTurnos(oferta.turnos.map((turno) => turno.codigo)),
  };
}

/** O controle do formulário que corresponde ao `field` de um erro de validação da API. */
export function controleDoCampoDoServidor(field: string): keyof OfertaCursoForm | null {
  return controlNameFromBackendField<keyof OfertaCursoForm>(field, CAMPOS);
}

/** O controle que mostra a recusa de código `code`, se ele se refere a um campo. */
export function controleDoCodigoDoServidor(code: string | undefined): keyof OfertaCursoForm | null {
  if (code === undefined || !code.startsWith(PREFIXO_DO_CODIGO)) {
    return null;
  }
  return CONTROLE_DO_CODIGO.get(code.slice(PREFIXO_DO_CODIGO.length)) ?? null;
}

function camposDaOferta(valores: ValoresDaOferta) {
  return {
    codigo: valores.codigo.trim(),
    programaDeOferta: valores.programaDeOferta,
    formatoPedagogico: valores.formatoPedagogico,
    regimeDeTurno: valores.regimeDeTurno,
    turnos: ordenarTurnos(valores.turnos),
    codigoEmec: nullIfBlank(valores.codigoEmec),
    codigoNoSistemaAcademico: nullIfBlank(valores.codigoNoSistemaAcademico),
    vagasAnuaisAutorizadas: valores.vagasAnuaisAutorizadas,
    baseLegal: nullIfBlank(valores.baseLegal),
    atoAutorizacaoMec: nullIfBlank(valores.atoAutorizacaoMec),
    regimeDeFuncionamento: valores.regimeDeFuncionamento,
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

const MENSAGEM_DE_FORMATO_DO_CODIGO =
  'Formato inválido. Use letras maiúsculas, números e sublinhado, iniciando por letra, de 2 a 50 caracteres (ex.: ENGENHARIA_CIVIL_MARABA).';

function mensagemDaRegraDaOferta(erros: Record<string, unknown>): string | null {
  if (erros['pattern']) return MENSAGEM_DE_FORMATO_DO_CODIGO;
  if (erros['min']) return 'Valor não pode ser negativo.';
  return erros['regimeFuncionamentoIncompativelRegimeTurno']
    ? 'O regime de funcionamento selecionado exige dois turnos distintos.'
    : mensagemDosTurnos(erros);
}

function mensagemDosTurnos(erros: Record<string, unknown>): string | null {
  if (erros['turnosObrigatorios']) {
    return 'Marque ao menos um turno — nenhum formato pedagógico dispensa o turno.';
  }
  if (erros['cardinalidadeTurnos']) {
    const { exigidos } = erros['cardinalidadeTurnos'] as {
      exigidos: number;
    };
    return exigidos === 1
      ? 'O regime selecionado exige exatamente um turno.'
      : `O regime selecionado exige exatamente ${exigidos} turnos distintos.`;
  }
  return erros['turnoRepetido'] ? 'Os turnos devem ser distintos entre si.' : null;
}

import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  TipoDocumentoDto,
  type AtualizarTipoDocumentoCommand,
  type CriarTipoDocumentoCommand,
} from '@uniplus/shared-data/configuracao';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';
import {
  controlNameFromBackendField,
  mensagemDeErroDoCampoComFormato,
  nullIfBlank,
} from '../../shared/formulario';

export type FormatoAceitoChave = 'formatoPdf' | 'formatoJpeg' | 'formatoPng' | 'formatoTiff';

interface FormatoAceitoOpcao {
  readonly key: FormatoAceitoChave;
  readonly extensao: string;
  readonly label: string;
}

/**
 * Roster fechado de formatos de arquivo aceitos (caixas do formulário), serializados para a
 * string orientativa `"pdf,jpg,png"` que o servidor guarda em `formatosAceitos`. A extensão `jpg`
 * (não `jpeg`) é a canônica de serialização.
 */
export const FORMATOS_ACEITOS_OPCOES: readonly FormatoAceitoOpcao[] = [
  { key: 'formatoPdf', extensao: 'pdf', label: 'PDF' },
  { key: 'formatoJpeg', extensao: 'jpg', label: 'JPEG' },
  { key: 'formatoPng', extensao: 'png', label: 'PNG' },
  { key: 'formatoTiff', extensao: 'tiff', label: 'TIFF' },
];

export interface TipoDocumentoForm {
  codigo: FormControl<string>;
  categoria: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
  tipoEquivalente: FormControl<string>;
  formatoPdf: FormControl<boolean>;
  formatoJpeg: FormControl<boolean>;
  formatoPng: FormControl<boolean>;
  formatoTiff: FormControl<boolean>;
  tamanhoMaximoMb: FormControl<number | null>;
  classificacaoProtecao: FormControl<string>;
  hipoteseLegal: FormControl<string>;
  finalidadeTratamento: FormControl<string>;
}

export type ValoresDoTipoDocumento = ReturnType<FormGroup<TipoDocumentoForm>['getRawValue']>;

/** Limites dos campos editáveis (Domain `TipoDocumento`, uniplus-api). */
const CODIGO_TAMANHO_MINIMO = 2;
const NOME_TAMANHO_MINIMO = 2;
export const NOME_TAMANHO_MAXIMO = 200;
export const DESCRICAO_TAMANHO_MAXIMO = 1000;
export const FINALIDADE_TAMANHO_MAXIMO = 500;
/** O servidor só exige `> 0` no tamanho máximo; não há teto superior no contrato. */
const TAMANHO_MAXIMO_MB_MINIMO = 1;

const MENSAGEM_DE_FORMATO =
  'Use caixa alta, começando por letra, com letras, números e sublinhado.';
const MENSAGEM_DO_TAMANHO_MINIMO = 'Deve ser um inteiro positivo (≥ 1).';
const MENSAGEM_DA_AUTO_EQUIVALENCIA = 'O tipo equivalente não pode ser igual ao próprio código.';

/** Erro do grupo: o tipo equivalente repete o código do próprio tipo. */
const IGUAL_AO_CODIGO = 'tipoEquivalenteIgualAoCodigo';

const CAMPOS: ReadonlySet<string> = new Set<keyof TipoDocumentoForm>([
  'codigo',
  'categoria',
  'nome',
  'descricao',
  'tipoEquivalente',
  'tamanhoMaximoMb',
  'classificacaoProtecao',
  'hipoteseLegal',
  'finalidadeTratamento',
]);

/**
 * O tipo equivalente repetir o código do próprio tipo é recusado pelo servidor (comparação
 * ordinal com o código já em caixa alta). O erro fica no grupo, e não no campo, porque depende dos
 * dois valores e o código também muda por sugestão, sem evento.
 */
function tipoEquivalenteDiferenteDoCodigo(grupo: AbstractControl): ValidationErrors | null {
  const equivalente = String(grupo.get('tipoEquivalente')?.value ?? '').trim();
  const codigo = String(grupo.get('codigo')?.value ?? '')
    .trim()
    .toLocaleUpperCase('pt-BR');
  return equivalente.length > 0 && equivalente === codigo ? { [IGUAL_AO_CODIGO]: true } : null;
}

export function criarFormularioDeTipoDocumento(): FormGroup<TipoDocumentoForm> {
  return new FormGroup<TipoDocumentoForm>(
    { ...controlesDoDocumento(), ...controlesDeFormato(), ...controlesDaProtecao() },
    { validators: [tipoEquivalenteDiferenteDoCodigo] },
  );
}

const textoOpcional = (maximo: number): FormControl<string> =>
  new FormControl('', { nonNullable: true, validators: [Validators.maxLength(maximo)] });
const caixa = (): FormControl<boolean> => new FormControl(false, { nonNullable: true });

function controlesDoDocumento() {
  return {
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(CODIGO_TAMANHO_MINIMO),
        Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO),
        Validators.pattern(CODIGO_CADASTRO_FORMATO),
      ],
    }),
    categoria: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(NOME_TAMANHO_MINIMO),
        Validators.maxLength(NOME_TAMANHO_MAXIMO),
      ],
    }),
    descricao: textoOpcional(DESCRICAO_TAMANHO_MAXIMO),
    tipoEquivalente: textoOpcional(CODIGO_CADASTRO_TAMANHO_MAXIMO),
  };
}

function controlesDeFormato() {
  return {
    formatoPdf: caixa(),
    formatoJpeg: caixa(),
    formatoPng: caixa(),
    formatoTiff: caixa(),
    tamanhoMaximoMb: new FormControl<number | null>(null, {
      validators: [Validators.min(TAMANHO_MAXIMO_MB_MINIMO)],
    }),
  };
}

function controlesDaProtecao() {
  return {
    classificacaoProtecao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    hipoteseLegal: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    finalidadeTratamento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(FINALIDADE_TAMANHO_MAXIMO)],
    }),
  };
}

export function valoresEmBrancoDoTipoDocumento(): ValoresDoTipoDocumento {
  return {
    codigo: '',
    categoria: '',
    nome: '',
    descricao: '',
    tipoEquivalente: '',
    formatoPdf: false,
    formatoJpeg: false,
    formatoPng: false,
    formatoTiff: false,
    tamanhoMaximoMb: null,
    classificacaoProtecao: '',
    hipoteseLegal: '',
    finalidadeTratamento: '',
  };
}

export function valoresDoTipoDocumento(tipo: TipoDocumentoDto): ValoresDoTipoDocumento {
  return {
    codigo: tipo.codigo,
    categoria: tipo.categoria,
    nome: tipo.nome,
    descricao: tipo.descricao ?? '',
    tipoEquivalente: tipo.tipoEquivalente ?? '',
    ...desserializarFormatosAceitos(tipo.formatosAceitos),
    tamanhoMaximoMb: tipo.tamanhoMaximoMb,
    classificacaoProtecao: tipo.classificacaoProtecao,
    hipoteseLegal: tipo.hipoteseLegal,
    finalidadeTratamento: tipo.finalidadeTratamento,
  };
}

export function controleDoCampoDoServidor(field: string): keyof TipoDocumentoForm | null {
  return controlNameFromBackendField<keyof TipoDocumentoForm>(field, CAMPOS);
}

export function comandoDeCriacao(form: FormGroup<TipoDocumentoForm>): CriarTipoDocumentoCommand {
  const valor = form.getRawValue();
  return {
    codigo: nullIfBlank(valor.codigo),
    nome: nullIfBlank(valor.nome),
    categoria: nullIfBlank(valor.categoria),
    descricao: nullIfBlank(valor.descricao),
    formatosAceitos: serializarFormatosAceitos(valor),
    tamanhoMaximoMb: valor.tamanhoMaximoMb,
    tipoEquivalente: nullIfBlank(valor.tipoEquivalente),
    classificacaoProtecao: valor.classificacaoProtecao,
    hipoteseLegal: valor.hipoteseLegal,
    finalidadeTratamento: valor.finalidadeTratamento.trim(),
  };
}

export function comandoDeAtualizacao(
  id: string,
  form: FormGroup<TipoDocumentoForm>,
): AtualizarTipoDocumentoCommand {
  return { id, ...comandoDeCriacao(form) };
}

/** Serializa as caixas marcadas para a string orientativa `"pdf,jpg,png"`. */
export function serializarFormatosAceitos(
  valor: Record<FormatoAceitoChave, boolean>,
): string | null {
  const extensoes = FORMATOS_ACEITOS_OPCOES.filter((opcao) => valor[opcao.key]).map(
    (opcao) => opcao.extensao,
  );
  return extensoes.length > 0 ? extensoes.join(',') : null;
}

/** Desserializa a string guardada (ex.: `"pdf,jpg,png"`) para o estado das quatro caixas. */
export function desserializarFormatosAceitos(
  valor: string | null | undefined,
): Record<FormatoAceitoChave, boolean> {
  const extensoes = new Set(
    (valor ?? '')
      .split(',')
      .map((item) => item.trim().toLocaleLowerCase('pt-BR'))
      .filter((item) => item.length > 0),
  );
  return {
    formatoPdf: extensoes.has('pdf'),
    formatoJpeg: extensoes.has('jpg') || extensoes.has('jpeg'),
    formatoPng: extensoes.has('png'),
    formatoTiff: extensoes.has('tiff') || extensoes.has('tif'),
  };
}

/** A mensagem do campo: a do servidor ou a obrigatoriedade; no mais, a regra violada. */
export function mensagemDoCampo(controle: AbstractControl): string | null {
  const exibe = controle.touched || controle.dirty;
  if (exibe && controle.errors?.['min'] && !controle.errors['backend']) {
    return MENSAGEM_DO_TAMANHO_MINIMO;
  }
  return mensagemDeErroDoCampoComFormato(controle, 'Valor inválido.');
}

/** A mensagem do código, com a regra de formato do cadastro. */
export function mensagemDoCodigo(controle: FormControl<string>): string | null {
  return mensagemDeErroDoCampoComFormato(controle, MENSAGEM_DE_FORMATO);
}

/**
 * A mensagem do tipo equivalente: a do campo, ou a da auto-equivalência assim que a pessoa mexeu
 * no código ou nele.
 */
export function mensagemDoTipoEquivalente(form: FormGroup<TipoDocumentoForm>): string | null {
  const { codigo, tipoEquivalente } = form.controls;
  const doCampo = mensagemDoCampo(tipoEquivalente);
  if (doCampo !== null || !form.hasError(IGUAL_AO_CODIGO)) return doCampo;
  const mexeu = tipoEquivalente.touched || tipoEquivalente.dirty || codigo.dirty || codigo.touched;
  return mexeu ? MENSAGEM_DA_AUTO_EQUIVALENCIA : null;
}

import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarCondicaoAtendimentoCommand,
  CondicaoAtendimentoDto,
  CriarCondicaoAtendimentoCommand,
} from '@uniplus/shared-data/configuracao';
import {
  controlNameFromBackendField,
  mensagemDeErroDoCampoComFormato,
  nullIfBlank,
} from '../../shared/formulario';

/** Código reservado: a regra de oferta de atendimento o referencia, então não é editável nem removível. */
export const CODIGO_RESERVADO = 'PCD';

export interface CondicaoAtendimentoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
}

export type ValoresDaCondicao = ReturnType<FormGroup<CondicaoAtendimentoForm>['getRawValue']>;

export const CONDICAO_EM_BRANCO: ValoresDaCondicao = { codigo: '', nome: '', descricao: '' };

const MENSAGEM_DE_FORMATO =
  'Formato inválido. Use letras maiúsculas, números e sublinhado, iniciando por letra (ex.: DISLEXIA, TDAH).';

const CONTROLES_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof CondicaoAtendimentoForm>([
  'codigo',
  'nome',
  'descricao',
]);

export function criarFormularioDeCondicao(): FormGroup<CondicaoAtendimentoForm> {
  return new FormGroup<CondicaoAtendimentoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern('^[A-Z][A-Z0-9_]{1,49}$'),
      ],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });
}

export function valoresDaCondicao(condicao: CondicaoAtendimentoDto): ValoresDaCondicao {
  return {
    codigo: condicao.codigo,
    nome: condicao.nome,
    descricao: condicao.descricao ?? '',
  };
}

export function controleDoCampoDoServidor(field: string): keyof CondicaoAtendimentoForm | null {
  return controlNameFromBackendField<keyof CondicaoAtendimentoForm>(field, CONTROLES_DO_SERVIDOR);
}

export function comandoDeCriacao(valores: ValoresDaCondicao): CriarCondicaoAtendimentoCommand {
  return {
    codigo: nullIfBlank(valores.codigo),
    nome: nullIfBlank(valores.nome),
    descricao: nullIfBlank(valores.descricao),
  };
}

export function comandoDeAtualizacao(
  id: string,
  valores: ValoresDaCondicao,
): AtualizarCondicaoAtendimentoCommand {
  return { id, ...comandoDeCriacao(valores) };
}

/** A mensagem do campo: a do servidor ou a obrigatoriedade; no mais, a regra de tamanho ou formato violada. */
export function mensagemDoCampo(control: AbstractControl): string | null {
  return mensagemDeErroDoCampoComFormato(control, MENSAGEM_DE_FORMATO);
}

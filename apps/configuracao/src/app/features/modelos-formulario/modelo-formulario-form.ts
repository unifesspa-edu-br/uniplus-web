import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { validadoresDoCodigo } from '../../shared/codigo-de-cadastro';
import {
  CriarModeloFormularioCommand,
  type FinalidadeFormularioCodigo,
} from '@uniplus/shared-data/configuracao';
import { conteudoInicial } from '@uniplus/shared-inscricao/formulario';
import { textoDoFormatoDoCodigo } from '@uniplus/shared-utils';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { conteudoParaOModelo } from './conteudo-do-modelo';

export interface CriacaoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
  finalidade: FormControl<FinalidadeFormularioCodigo | null>;
  tipoProcessoCodigo: FormControl<string>;
}

export type CampoDaCriacao = keyof CriacaoForm;

const CAMPOS: readonly CampoDaCriacao[] = [
  'codigo',
  'nome',
  'descricao',
  'finalidade',
  'tipoProcessoCodigo',
];

function campoDeTexto(...validators: ValidatorFn[]): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators });
}

export function criarFormularioDeModelo(): FormGroup<CriacaoForm> {
  return new FormGroup<CriacaoForm>({
    codigo: campoDeTexto(Validators.required, ...validadoresDoCodigo(60)),
    nome: campoDeTexto(Validators.required, Validators.maxLength(200)),
    descricao: campoDeTexto(Validators.maxLength(1000)),
    finalidade: new FormControl<FinalidadeFormularioCodigo | null>(null, Validators.required),
    tipoProcessoCodigo: campoDeTexto(...validadoresDoCodigo(80)),
  });
}

/** O comando de criação: o modelo nasce com o conteúdo inicial e é montado na edição. */
export function comandoDeCriacao(form: FormGroup<CriacaoForm>): CriarModeloFormularioCommand {
  const valores = form.getRawValue();
  if (valores.finalidade === null) throw new Error('Finalidade obrigatória.');
  return {
    codigo: valores.codigo,
    finalidade: valores.finalidade,
    descritivo: {
      nome: valores.nome.trim(),
      descricao: valores.descricao.trim() || null,
      tipoProcessoCodigo: valores.tipoProcessoCodigo || null,
    },
    conteudo: conteudoParaOModelo(conteudoInicial()),
  };
}

/** O campo do drawer a que a recusa se refere, pelo último segmento; nulo quando é do conteúdo. */
export function campoDaRecusa(campo: string): CampoDaCriacao | null {
  const ultimo = (campo.split('.').at(-1) ?? campo).replace(/^./u, (letra) =>
    letra.toLocaleLowerCase('pt-BR'),
  );
  const encontrado = CAMPOS.find((nome) => nome === ultimo);
  return encontrado !== undefined && !/conteudo/iu.test(campo) ? encontrado : null;
}

/** A mensagem do campo; o formato do código tem texto próprio. */
export function mensagemDoCampo(controle: FormControl<string | null>, limite = 60): string | null {
  const mensagem = mensagemDeErroDoControle(controle);
  if (mensagem === null || controle.errors === null) return mensagem;
  if (controle.errors['backend'] || controle.errors['required']) return mensagem;
  return controle.errors['pattern'] ? textoDoFormatoDoCodigo(limite) : mensagem;
}

import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CriarModeloFormularioCommand } from '@uniplus/shared-data/configuracao';
import { conteudoInicial } from '@uniplus/shared-ui/components';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';
import { mensagemDeErroDoControle } from '../../shared/formulario';

export interface CriacaoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
  finalidade: FormControl<string>;
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

export function criarFormularioDeModelo(): FormGroup<CriacaoForm> {
  return new FormGroup<CriacaoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO),
        Validators.pattern(CODIGO_CADASTRO_FORMATO),
      ],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    finalidade: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tipoProcessoCodigo: new FormControl('', { nonNullable: true }),
  });
}

/** O comando de criação: o modelo nasce com o conteúdo inicial e é montado na edição. */
export function comandoDeCriacao(form: FormGroup<CriacaoForm>): CriarModeloFormularioCommand {
  const valores = form.getRawValue();
  return {
    codigo: valores.codigo.trim(),
    nome: valores.nome.trim(),
    descricao: valores.descricao.trim() || null,
    finalidade: valores.finalidade,
    tipoProcessoCodigo: valores.tipoProcessoCodigo || null,
    conteudo: conteudoInicial(),
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
export function mensagemDoCampo(controle: FormControl<string>): string | null {
  const mensagem = mensagemDeErroDoControle(controle);
  if (mensagem === null || controle.errors === null) return mensagem;
  if (controle.errors['backend'] || controle.errors['required']) return mensagem;
  return controle.errors['pattern']
    ? 'Use caixa alta, começando por letra, com letras, números e sublinhado.'
    : mensagem;
}

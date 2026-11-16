import { FormControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { sugerirCodigoDeCadastro } from '@uniplus/shared-utils';

/** Os dois campos do cadastro que o código acompanha. */
export interface CamposDoCodigoDeCadastro {
  readonly nome: FormControl<string>;
  readonly codigo: FormControl<string>;
}

/** O que a tela faz com a ligação: zerá-la ao abrir o formulário de novo. */
export interface CodigoDeCadastroLigado {
  /** Esquece a última sugestão, para o formulário recém-aberto voltar a sugerir. */
  reiniciar(): void;
}

/**
 * Mantém o código em caixa alta no modelo, sem reescrever a view (`emitModelToViewChange: false`),
 * para não reposicionar o cursor; a apresentação em caixa alta fica por conta do `text-transform`
 * do campo. Chamar em contexto de injeção: a inscrição termina com a tela.
 */
export function manterEmCaixaAlta(codigo: FormControl<string>): void {
  codigo.valueChanges.pipe(takeUntilDestroyed()).subscribe((valor) => {
    const emCaixaAlta = valor.toLocaleUpperCase('pt-BR');
    if (emCaixaAlta === valor) return;
    codigo.setValue(emCaixaAlta, { emitEvent: false, emitModelToViewChange: false });
  });
}

/**
 * Sugere o código a partir do nome enquanto o que está no campo é obra da própria sugestão:
 * o operador que troca o código por outro encerra a sugestão.
 */
function criarSugestorDeCodigo(codigo: FormControl<string>): CodigoDeCadastroLigado & {
  sugerirPara(nome: string): void;
} {
  let ultimaSugestao = '';
  return {
    sugerirPara(nome: string): void {
      if (codigo.value !== '' && codigo.value !== ultimaSugestao) return;
      ultimaSugestao = sugerirCodigoDeCadastro(nome);
      codigo.setValue(ultimaSugestao, { emitEvent: false });
    },
    reiniciar(): void {
      ultimaSugestao = '';
    },
  };
}

/**
 * Liga o código de cadastro ao nome, como a convenção do código informado pelo operador pede:
 *
 * - **sugestão:** na criação, o código acompanha o nome enquanto o que está nele é obra da
 *   própria sugestão, e para no instante em que o operador troca o código por outro. Fora da
 *   criação, nunca escreve: o código vigente é do registro;
 * - **caixa alta:** o código é normalizado no modelo sem reescrever a view
 *   (`emitModelToViewChange: false`), para não reposicionar o cursor; a apresentação em caixa
 *   alta fica por conta do `text-transform` do campo.
 *
 * Chamar em contexto de injeção (construtor ou inicialização de campo): as inscrições terminam
 * com a tela.
 */
export function ligarCodigoDeCadastro(
  campos: CamposDoCodigoDeCadastro,
  emCriacao: () => boolean,
): CodigoDeCadastroLigado {
  const sugestor = criarSugestorDeCodigo(campos.codigo);
  campos.nome.valueChanges.pipe(takeUntilDestroyed()).subscribe((nome) => {
    if (emCriacao()) sugestor.sugerirPara(nome);
  });
  manterEmCaixaAlta(campos.codigo);
  return sugestor;
}

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
 * Sugere o código a partir do nome enquanto o que está no campo é obra da própria sugestão:
 * o operador que troca o código por outro encerra a sugestão.
 */
function criarSugestorDeCodigo(codigo: FormControl<string>): CodigoDeCadastroLigado & {
  sugerirPara(nome: string): void;
} {
  let ultimaSugestao = '';
  function sugerirPara(nome: string): void {
    if (codigo.value !== '' && codigo.value !== ultimaSugestao) return;
    ultimaSugestao = sugerirCodigoDeCadastro(nome);
    codigo.setValue(ultimaSugestao, { emitEvent: false });
    if (codigo.hasError('maxlength')) codigo.markAsDirty();
  }
  return { sugerirPara, reiniciar: () => void (ultimaSugestao = '') };
}

/**
 * Liga o código de cadastro ao nome, como a convenção do código informado pelo operador pede:
 *
 * - **sugestão:** na criação, o código acompanha o nome enquanto o que está nele é obra da
 *   própria sugestão, e para no instante em que o operador troca o código por outro. Fora da
 *   criação, nunca escreve: o código vigente é do registro;
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
  return sugestor;
}

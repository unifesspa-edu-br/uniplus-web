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
  let ultimaSugestao = '';

  campos.nome.valueChanges.pipe(takeUntilDestroyed()).subscribe((nome) => {
    if (!emCriacao()) return;
    const codigoAtual = campos.codigo.value;
    if (codigoAtual !== '' && codigoAtual !== ultimaSugestao) return;
    ultimaSugestao = sugerirCodigoDeCadastro(nome);
    campos.codigo.setValue(ultimaSugestao, { emitEvent: false });
  });

  campos.codigo.valueChanges.pipe(takeUntilDestroyed()).subscribe((codigo) => {
    const emCaixaAlta = codigo.toLocaleUpperCase('pt-BR');
    if (emCaixaAlta === codigo) return;
    campos.codigo.setValue(emCaixaAlta, { emitEvent: false, emitModelToViewChange: false });
  });

  return {
    reiniciar: () => {
      ultimaSugestao = '';
    },
  };
}

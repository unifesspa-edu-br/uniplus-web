import type { ValidationErrors } from '@angular/forms';

export type CampoDoFormulario =
  | 'tipoAtoCodigo'
  | 'numero'
  | 'dataPublicacao'
  | 'assinante'
  | 'atoCorrigidoId'
  | 'motivoDaCorrecao'
  | 'politicaDeDivulgacaoConfirmada';

const CAMPOS: ReadonlySet<string> = new Set<CampoDoFormulario>([
  'tipoAtoCodigo',
  'numero',
  'dataPublicacao',
  'assinante',
  'atoCorrigidoId',
  'motivoDaCorrecao',
  'politicaDeDivulgacaoConfirmada',
]);

/** O controle do formulário que o campo citado pelo servidor (`PascalCase`, às vezes com caminho) nomeia. */
export function campoDoServidor(campo: string): CampoDoFormulario | null {
  const ultimo = campo.split('.').at(-1)?.replace(/\[\d+\]$/u, '') ?? campo;
  const camelCase = ultimo.charAt(0).toLocaleLowerCase('pt-BR') + ultimo.slice(1);
  return CAMPOS.has(camelCase) ? (camelCase as CampoDoFormulario) : null;
}

/** A mensagem que a pessoa lê para o erro do campo: a do servidor, quando ele recusou, ou a da tela. */
export function mensagemDoErroDoCampo(campo: CampoDoFormulario, erros: ValidationErrors): string {
  const doServidor = erros['servidor'] as { readonly mensagem: string } | undefined;
  if (doServidor !== undefined) return doServidor.mensagem;
  if (campo === 'politicaDeDivulgacaoConfirmada') {
    return 'Confirme que o documento segue a política de divulgação do certame.';
  }
  if (erros['required']) return 'Campo obrigatório.';
  if (erros['maxlength']) return 'O texto passa do tamanho permitido.';
  return 'Valor inválido.';
}

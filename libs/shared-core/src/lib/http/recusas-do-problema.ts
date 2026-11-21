import { separarCausas, type CausaGeral } from './causas-do-problema';
import { paginaDoErro } from './pagina-do-erro';
import type {
  IdentificadorDoItem,
  ProblemDetails,
  ProblemValidationError,
} from './problem-details';

/**
 * A recusa que a API fez a um campo: o nome do campo no servidor, a mensagem e o código dela, a
 * página que explica o código, a posição da recusa em `errors[]` e os identificadores dos itens
 * de lista que o campo atravessa, vazios quando a API não os deu.
 */
export interface RecusaDoProblema {
  readonly campo: string;
  readonly codigo: string;
  readonly mensagem: string;
  readonly pagina: string | null;
  readonly ordem: number;
  readonly identificadores: readonly IdentificadorDoItem[];
}

/** As recusas do problema: as que apontam um campo e as gerais, que não apontam nenhum. */
export interface RecusasDoProblema {
  readonly deCampo: readonly RecusaDoProblema[];
  readonly gerais: readonly CausaGeral[];
}

/** Os identificadores dos itens que a causa atravessa; vazios quando a API não os deu. */
export function identificadoresDoErro(
  erro: ProblemValidationError,
): readonly IdentificadorDoItem[] {
  return erro.identificadores ?? [];
}

/**
 * As causas (`errors[]`) do problema separadas entre as que apontam um campo, cada uma com a
 * página que explica o código e a posição que tinha em `errors[]`, e as gerais. O problema sem
 * `errors[]` devolve as duas listas vazias.
 */
export function recusasDoProblema(problema: ProblemDetails): RecusasDoProblema {
  const erros = problema.errors ?? [];
  const { deCampo, gerais } = separarCausas(erros);
  return {
    deCampo: deCampo.map((erro) => ({
      campo: erro.field,
      codigo: erro.code,
      mensagem: erro.message,
      pagina: paginaDoErro(problema, erro.code),
      ordem: erros.indexOf(erro),
      identificadores: identificadoresDoErro(erro),
    })),
    gerais,
  };
}

import { quemCita } from './citacoes';
import { nomeDoFato } from './codigos';
import { ConteudoDoFormulario, ResultadoDaEdicao } from './tipos';

export function acrescentarPressuposto(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
): ConteudoDoFormulario {
  return { ...conteudo, pressupostos: [...(conteudo.pressupostos ?? []), fatoCodigo] };
}

/** Remove o pressuposto. Recusa quando uma regra o cita: a condição ficaria sobre fato desconhecido. */
export function removerPressuposto(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  const recusa = recusaDaRetiradaDoPressuposto(conteudo, fatoCodigo, nomes);
  if (recusa !== null) return { ok: false, recusa };
  return { ok: true, conteudo: conteudoSemOPressuposto(conteudo, fatoCodigo) };
}

function recusaDaRetiradaDoPressuposto(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
  nomes: ReadonlyMap<string, string>,
): string | null {
  const quem = quemCita(conteudo, fatoCodigo)[0];
  return quem === undefined
    ? null
    : `Não é possível retirar “${nomeDoFato(nomes, fatoCodigo)}”: ${quem.descricao} cita esse fato.`;
}

export function conteudoSemOPressuposto(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
): ConteudoDoFormulario {
  return {
    ...conteudo,
    pressupostos: (conteudo.pressupostos ?? []).filter((fato) => fato !== fatoCodigo),
  };
}

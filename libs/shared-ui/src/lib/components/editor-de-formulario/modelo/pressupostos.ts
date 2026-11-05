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
  const quem = quemCita(conteudo, fatoCodigo)[0];
  if (quem !== undefined) {
    return {
      ok: false,
      recusa: `Não é possível retirar “${nomeDoFato(nomes, fatoCodigo)}”: ${quem.descricao} cita esse fato.`,
    };
  }
  return {
    ok: true,
    conteudo: {
      ...conteudo,
      pressupostos: (conteudo.pressupostos ?? []).filter((fato) => fato !== fatoCodigo),
    },
  };
}

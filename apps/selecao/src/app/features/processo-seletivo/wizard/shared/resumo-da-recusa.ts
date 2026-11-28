import { separarCausas, type CausaDeCampo, type ProblemDetails } from '@uniplus/shared-core/http';

type Explicar = (erro: CausaDeCampo) => string | null;

/**
 * O resumo de uma recusa do servidor: cada causa de campo que a tela explica, com o texto dela, uma
 * vez só; a mensagem de cada causa geral, que não aponta campo, também uma vez só; e o título da
 * raiz quando há causa de campo que ela não explica, ou nenhuma causa e a raiz também sem
 * explicação, e também quando uma causa geral veio sem mensagem. Sem causa nenhuma, a raiz é
 * explicada pelo próprio `code`. Uma causa geral igual ao texto de um campo não some: a deduplicação vale dentro de cada grupo.
 */
export function resumoDaRecusa(
  problema: ProblemDetails,
  explicar: Explicar,
  tituloDaRaiz: () => string,
): string[] {
  const { deCampo, gerais } = separarCausas(problema.errors);
  const semCausa = deCampo.length === 0 && gerais.length === 0;
  const causas = semCausa ? [raizDoProblema(problema)] : deCampo;
  const mensagens = mensagensDasGerais(gerais);
  const explicadas = [...semRepeticao(textosDe(causas, explicar)), ...semRepeticao(mensagens)];
  const semExplicacao = semCausa
    ? explicadas.length === 0
    : mensagens.length < gerais.length || causas.some((causa) => explicar(causa) === null);
  return [...explicadas, ...(semExplicacao ? [tituloDaRaiz()] : [])];
}

function textosDe(causas: readonly CausaDeCampo[], explicar: Explicar): string[] {
  return causas.flatMap((causa) => explicar(causa) ?? []);
}

/** A mensagem de cada causa geral que a trouxe; a vazia ou só de espaços não informa nada. */
function mensagensDasGerais(gerais: readonly Pick<CausaDeCampo, 'message'>[]): string[] {
  return gerais.filter((causa) => causa.message?.trim()).map((causa) => causa.message);
}

/** Mensagem idêntica repetida não informa nada ao leitor; só se descarta a igual da mesma origem. */
function semRepeticao(mensagens: readonly string[]): string[] {
  return [...new Set(mensagens)];
}

function raizDoProblema(problema: ProblemDetails): CausaDeCampo {
  return { field: '', code: problema.code, message: problema.title };
}

import type { ValorJson } from './interpretador/regras-do-formulario';

/** Um fato que o sistema calcula das respostas: o valor e como ele aparece ao candidato. */
export interface DerivadoDoSistema {
  readonly fatoCodigo: string;
  readonly valor: ValorJson;
  readonly exibicao: string;
}

/**
 * Os fatos que o servidor calcula na submissão, calculados aqui só para mostrar e para as regras que os
 * citam: a idade na data de referência dos fatos, e a UF e o município do endereço residencial. O
 * servidor é a autoridade — confere o endereço no Geo e recalcula tudo.
 */
export function derivadosDoSistema(
  respostas: Readonly<Record<string, ValorJson>>,
  dataReferenciaFatos: string | null | undefined,
): DerivadoDoSistema[] {
  const derivados: DerivadoDoSistema[] = [];

  const nascimento = respostas['DATA_NASCIMENTO'];
  if (typeof nascimento === 'string' && dataReferenciaFatos) {
    const idade = idadeEmAnos(nascimento, dataReferenciaFatos);
    if (idade !== null)
      derivados.push({ fatoCodigo: 'FAIXA_ETARIA', valor: idade, exibicao: `${idade} anos` });
  }

  const cidade = cidadeDo(respostas['ENDERECO_RESIDENCIAL']);
  if (cidade) {
    derivados.push({ fatoCodigo: 'UF_RESIDENCIA', valor: cidade.uf, exibicao: cidade.uf });
    derivados.push({
      fatoCodigo: 'MUNICIPIO_RESIDENCIA',
      valor: cidade.codigoIbge,
      exibicao: cidade.nome ? `${cidade.nome} (${cidade.uf})` : cidade.codigoIbge,
    });
  }

  return derivados;
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Anos completos na data de referência — nunca na de hoje. */
function idadeEmAnos(nascimento: string, referencia: string): number | null {
  const n = DATA_ISO.exec(nascimento);
  const r = DATA_ISO.exec(referencia);
  if (!n || !r) return null;
  const [anoN, mesN, diaN] = [Number(n[1]), Number(n[2]), Number(n[3])];
  const [anoR, mesR, diaR] = [Number(r[1]), Number(r[2]), Number(r[3])];
  const fezAniversario = mesR > mesN || (mesR === mesN && diaR >= diaN);
  return anoR - anoN - (fezAniversario ? 0 : 1);
}

interface Cidade {
  readonly codigoIbge: string;
  readonly nome: string | null;
  readonly uf: string;
}

function cidadeDo(endereco: ValorJson | undefined): Cidade | null {
  if (endereco === null || typeof endereco !== 'object' || Array.isArray(endereco)) return null;
  const cidade = (endereco as { readonly [chave: string]: ValorJson })['cidade'];
  if (cidade === null || typeof cidade !== 'object' || Array.isArray(cidade)) return null;
  const { codigoIbge, nome, uf } = cidade as { readonly [chave: string]: ValorJson };
  return typeof codigoIbge === 'string' && codigoIbge !== '' && typeof uf === 'string' && uf !== ''
    ? { codigoIbge, nome: typeof nome === 'string' ? nome : null, uf }
    : null;
}

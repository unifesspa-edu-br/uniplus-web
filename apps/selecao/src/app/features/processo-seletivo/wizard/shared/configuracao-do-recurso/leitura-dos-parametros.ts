import type { LeituraDoRecurso, ParametrosDoRecurso } from './parametros-do-recurso';

/** Os parâmetros do recurso como a consulta os lê, cada valor com o nome que a API devolveu. */
export interface ParametrosEmTexto {
  readonly prazo: string | null;
  readonly admiteInstanciaSuperior: boolean | null;
  readonly efeitoSuspensivo: string | null;
  readonly guardaDaVaga: string | null;
  readonly prazoDaSegundaInstancia: string | null;
}

/** O nome que a leitura deu ao código; sem ele, o próprio código; sem código, nada. */
function nomeDoCodigo(codigo: string, rotulo: string | undefined): string | null {
  return codigo === '' ? null : (rotulo ?? codigo);
}

/** O prazo em texto: o valor e o nome da unidade. Sem valor e sem unidade, nada. */
function prazoEmTexto(valor: string, unidade: string | null): string | null {
  const quantidade = valor.trim();
  if (quantidade === '') return unidade;
  return unidade === null ? quantidade : `${quantidade} — ${unidade}`;
}

function prazosEmTexto(
  parametros: ParametrosDoRecurso,
  { rotulos }: LeituraDoRecurso,
): Pick<ParametrosEmTexto, 'prazo' | 'prazoDaSegundaInstancia'> {
  const { prazoValor, prazoUnidade, prazoSegundaInstanciaValor, prazoSegundaInstanciaUnidade } =
    parametros;
  return {
    prazo: prazoEmTexto(prazoValor, nomeDoCodigo(prazoUnidade, rotulos.prazoUnidade)),
    prazoDaSegundaInstancia: prazoEmTexto(
      prazoSegundaInstanciaValor,
      nomeDoCodigo(prazoSegundaInstanciaUnidade, rotulos.prazoSegundaInstanciaUnidade),
    ),
  };
}

function escolhasEmTexto(
  { efeitoSuspensivo, guardaDaVaga }: ParametrosDoRecurso,
  { rotulos }: LeituraDoRecurso,
): Pick<ParametrosEmTexto, 'efeitoSuspensivo' | 'guardaDaVaga'> {
  return {
    efeitoSuspensivo: nomeDoCodigo(efeitoSuspensivo, rotulos.efeitoSuspensivo),
    guardaDaVaga: nomeDoCodigo(guardaDaVaga, rotulos.guardaDaVaga),
  };
}

export function parametrosEmTexto(
  parametros: ParametrosDoRecurso,
  leitura: LeituraDoRecurso,
): ParametrosEmTexto {
  return {
    ...prazosEmTexto(parametros, leitura),
    admiteInstanciaSuperior: parametros.admiteInstanciaSuperior,
    ...escolhasEmTexto(parametros, leitura),
  };
}

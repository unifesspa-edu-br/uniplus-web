import type { DefinicaoGrupo, DefinicaoItem, Obrigatoriedade } from './definicao-do-formulario';
import { lerItem } from './leitura-do-item';
import { lerExibicaoEObrigatoriedade } from './leitura-do-predicado';
import { booleano, codigo, ehObjeto, lista, numero, Recusa } from './leitura-dos-valores';
import { fatosCitadosPor, type Predicado } from './predicado';
import type { GrupoDasRegras, OcorrenciasDoGrupoDasRegras } from './regras-do-formulario';

type ContagemDoGrupo = Pick<DefinicaoGrupo, 'minimo' | 'maximo' | 'incluiCandidato'>;

export function lerGrupo(grupo: GrupoDasRegras, caminho: string): DefinicaoGrupo {
  const codigoDoGrupo = codigo(grupo.codigo, `${caminho}.codigo`);
  const dono = `grupo '${codigoDoGrupo}'`;
  const regras = lerExibicaoEObrigatoriedade(grupo.regras, `${caminho}.regras`, dono);
  const subitens = lista(grupo.subitens, `${caminho}.subitens`, lerItem);
  return {
    codigo: codigoDoGrupo,
    ...regras,
    ...lerOcorrencias(grupo.ocorrencias, `${caminho}.ocorrencias`),
    subitens,
    fatosDoCandidatoCitados: fatosDoCandidatoCitados(regras, subitens),
  };
}

/** Os fatos de fora das ocorrências de que o grupo depende, pela exibição, pela obrigatoriedade e pelos subitens. */
function fatosDoCandidatoCitados(
  regras: { exibicao: Predicado | null; obrigatoriedade: Obrigatoriedade },
  subitens: readonly DefinicaoItem[],
): string[] {
  const dosSubitens = new Set(subitens.map((s) => s.fatoCodigo));
  return [
    ...new Set([
      ...fatosCitadosPor(regras.exibicao),
      ...fatosCitadosPor(regras.obrigatoriedade.predicado),
      ...subitens.flatMap((s) => s.fatosCitados).filter((f) => !dosSubitens.has(f)),
    ]),
  ];
}

function lerOcorrencias(
  ocorrencias: OcorrenciasDoGrupoDasRegras | null | undefined,
  caminho: string,
): ContagemDoGrupo {
  if (!ehObjeto(ocorrencias)) throw new Recusa(caminho, 'As ocorrências do grupo são um objeto.');
  const minimo = numero(ocorrencias.minimo, `${caminho}.minimo`) ?? 0;
  const maximo = numero(ocorrencias.maximo, `${caminho}.maximo`);
  conferirContagem(minimo, maximo, caminho);
  const incluiCandidato = booleano(ocorrencias.incluiCandidato, `${caminho}.incluiCandidato`);
  return { minimo, maximo, incluiCandidato };
}

function conferirContagem(minimo: number, maximo: number | null, caminho: string): void {
  if (!Number.isInteger(minimo) || minimo < 0)
    throw new Recusa(`${caminho}.minimo`, 'O mínimo de ocorrências é um inteiro não negativo.');
  if (maximo !== null && (!Number.isInteger(maximo) || maximo < Math.max(minimo, 1))) {
    throw new Recusa(
      `${caminho}.maximo`,
      'O máximo de ocorrências é um inteiro, ao menos 1 e não menor que o mínimo.',
    );
  }
}

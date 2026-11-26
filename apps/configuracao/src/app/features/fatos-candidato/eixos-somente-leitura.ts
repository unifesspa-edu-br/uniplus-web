import type { FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { eixosDoTipo, type TipoDoFato } from './fato-candidato.regras';

/** Um eixo da definição que o fato não edita, com o valor que tem e de onde ele vem. */
export interface EixoSomenteLeitura {
  readonly rotulo: string;
  readonly valor: string;
  readonly origem: string;
}

const EIXOS = [
  { campo: 'dominio', rotulo: 'Tipo de dado' },
  { campo: 'cardinalidade', rotulo: 'Quantos valores' },
  { campo: 'fonteValores', rotulo: 'De onde vêm os valores' },
  { campo: 'formato', rotulo: 'Formato do texto' },
  { campo: 'escopo', rotulo: 'De quem é o dado' },
] as const;

function valoresDosEixos({
  definicao,
}: FatoCandidatoDto): Record<(typeof EIXOS)[number]['campo'], string> {
  return {
    dominio: definicao.dominio.rotulo,
    cardinalidade: definicao.cardinalidade.rotulo,
    fonteValores: definicao.valores.fonte?.rotulo ?? '',
    formato: definicao.formato?.rotulo ?? '',
    escopo: definicao.escopo.rotulo,
  };
}

function origemDoEixo(tipo: TipoDoFato): string {
  return tipo === 'AGREGADO' ? 'vem do fato de membro' : 'vem do tipo de dado';
}

/** Os eixos que o derivado e o agregado herdam em vez de escolher. */
export function eixosSomenteLeitura(
  fato: FatoCandidatoDto | null,
  tipo: TipoDoFato,
): readonly EixoSomenteLeitura[] {
  if (fato === null || tipo === 'DECLARADO') return [];
  const doTipo = eixosDoTipo(tipo);
  const valores = valoresDosEixos(fato);
  return EIXOS.filter(({ campo }) => !doTipo[campo] && valores[campo]).map(({ campo, rotulo }) => ({
    rotulo,
    valor: valores[campo],
    origem: origemDoEixo(tipo),
  }));
}

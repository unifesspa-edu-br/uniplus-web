import type { FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { rotuloDe } from '../../shared/protecao-do-catalogo';
import {
  CARDINALIDADES,
  DOMINIOS,
  ESCOPOS,
  FONTES_DE_VALORES,
  FORMATOS_DE_TEXTO,
  eixosDoTipo,
  type TipoDoFato,
} from './fato-candidato.regras';

/** Um eixo da definição que o fato não edita, com o valor que tem e de onde ele vem. */
export interface EixoSomenteLeitura {
  readonly rotulo: string;
  readonly valor: string;
  readonly origem: string;
}

const EIXOS = [
  { campo: 'dominio', rotulo: 'Tipo de dado', vocabulario: DOMINIOS },
  { campo: 'cardinalidade', rotulo: 'Quantos valores', vocabulario: CARDINALIDADES },
  { campo: 'fonteValores', rotulo: 'De onde vêm os valores', vocabulario: FONTES_DE_VALORES },
  { campo: 'formato', rotulo: 'Formato do texto', vocabulario: FORMATOS_DE_TEXTO },
  { campo: 'escopo', rotulo: 'De quem é o dado', vocabulario: ESCOPOS },
] as const;

/** Os eixos que o derivado e o agregado herdam em vez de escolher. */
export function eixosSomenteLeitura(
  fato: FatoCandidatoDto | null,
  tipo: TipoDoFato,
): readonly EixoSomenteLeitura[] {
  if (fato === null || tipo === 'DECLARADO') return [];
  const doTipo = eixosDoTipo(tipo);
  const origem = tipo === 'AGREGADO' ? 'vem do fato de membro' : 'vem do tipo de dado';
  return EIXOS.filter(({ campo }) => !doTipo[campo] && fato[campo]).map(
    ({ campo, rotulo, vocabulario }) => ({
      rotulo,
      valor: rotuloDe(vocabulario, fato[campo] as string),
      origem,
    }),
  );
}

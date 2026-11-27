import {
  AreaPesoAreaEnemDto,
  GrupoAreaEnemDto,
  PesoAreaEnemDto,
} from '@uniplus/shared-data/configuracao';

export const BASE = 'http://localhost:5000';
export const LIST_URL = `${BASE}/api/configuracao/pesos-area-enem`;
export const AREAS_URL = `${BASE}/api/configuracao/pesos-area-enem/areas`;
export const ESCRITA = `${BASE}/api/configuracao/admin/pesos-area-enem`;
export const GRUPOS_URL = `${BASE}/api/configuracao/vocabularios/grupos-area-enem`;

/** As cinco áreas como a API as devolve: código, rótulo oficial e ordem canônica. */
export const AREAS: readonly AreaPesoAreaEnemDto[] = [
  { codigo: 'REDACAO', rotulo: 'Redação' },
  { codigo: 'CIENCIAS_DA_NATUREZA', rotulo: 'Ciências da Natureza e suas Tecnologias' },
  { codigo: 'CIENCIAS_HUMANAS', rotulo: 'Ciências Humanas e suas Tecnologias' },
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens e suas Tecnologias' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
];

/** Os grupos de área do ENEM como a API os devolve: código, rótulo e ordem. */
export const GRUPOS: readonly GrupoAreaEnemDto[] = [
  { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
  { codigo: 'HUMANISTICA_I', rotulo: 'Humanística I' },
  { codigo: 'HUMANISTICA_II', rotulo: 'Humanística II' },
  { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' },
];

export function grupo(codigo: string): GrupoAreaEnemDto {
  const encontrado = GRUPOS.find((g) => g.codigo === codigo);
  if (!encontrado) throw new Error(`grupo ${codigo} ausente dos fixtures`);
  return encontrado;
}

/** Pesos padrão por código; a Redação tem corte 400, as demais não têm corte. */
const PESOS_PADRAO: Readonly<Record<string, number>> = {
  REDACAO: 1,
  CIENCIAS_DA_NATUREZA: 1.5,
  CIENCIAS_HUMANAS: 1,
  LINGUAGENS: 1,
  MATEMATICA: 2.5,
};

export function linha(
  overrides: Partial<PesoAreaEnemDto> & Pick<PesoAreaEnemDto, 'id' | 'resolucao' | 'grupoCurso'>,
): PesoAreaEnemDto {
  return {
    areas: AREAS.map((area) => ({
      codigo: area.codigo,
      rotulo: area.rotulo,
      peso: PESOS_PADRAO[area.codigo] ?? 1,
      corte: area.codigo === 'REDACAO' ? 400 : null,
    })),
    baseLegal: 'Res. 805/2024 Anexo I',
    criadoEm: '2026-06-24T12:00:00Z',
    ...overrides,
  };
}

/** Peso de uma área numa linha de `registros`. */
export function pesoDe(
  dto: PesoAreaEnemDto | undefined,
  codigo: string,
): number | string | undefined {
  return dto?.areas.find((area) => area.codigo === codigo)?.peso;
}

export const RES_805 = 'Res. 805/2024';
export const RES_750 = 'Res. 750/2022';

export const linhas805: readonly PesoAreaEnemDto[] = [
  linha({
    id: '01960000-0000-7000-0000-0000000000a1',
    resolucao: RES_805,
    grupoCurso: grupo('TECNOLOGICA'),
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000a2',
    resolucao: RES_805,
    grupoCurso: grupo('HUMANISTICA_I'),
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000a3',
    resolucao: RES_805,
    grupoCurso: grupo('HUMANISTICA_II'),
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000a4',
    resolucao: RES_805,
    grupoCurso: grupo('SAUDE_E_BIOLOGICAS'),
  }),
];

export const linhas750: readonly PesoAreaEnemDto[] = [
  linha({
    id: '01960000-0000-7000-0000-0000000000b1',
    resolucao: RES_750,
    grupoCurso: grupo('TECNOLOGICA'),
    criadoEm: '2025-01-10T12:00:00Z',
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000b2',
    resolucao: RES_750,
    grupoCurso: grupo('HUMANISTICA_I'),
    criadoEm: '2025-01-10T12:00:00Z',
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000b3',
    resolucao: RES_750,
    grupoCurso: grupo('HUMANISTICA_II'),
    criadoEm: '2025-01-10T12:00:00Z',
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000b4',
    resolucao: RES_750,
    grupoCurso: grupo('SAUDE_E_BIOLOGICAS'),
    criadoEm: '2025-01-10T12:00:00Z',
  }),
];

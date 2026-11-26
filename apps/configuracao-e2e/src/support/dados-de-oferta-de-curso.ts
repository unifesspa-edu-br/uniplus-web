import type { JsonDaApi } from '@uniplus/shared-e2e';
import type { Page } from '@playwright/test';
import type { LocalOfertaDto, OfertaCursoDto } from '@uniplus/shared-data/configuracao';

/** Os dados do cadastro de Oferta de curso que os specs de fluxo compartilham. */

export const CURSO = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG_CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const LOCAL: JsonDaApi<LocalOfertaDto> = {
  id: '01960000-0000-7000-0000-0000000000e1',
  tipo: { codigo: 'CAMPUS_SEDE', rotulo: 'Campus sede' },
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  codigoEmec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const UNIDADE = {
  id: '01960000-0000-7000-0000-0000000000f1',
  nome: 'Instituto de Geociências e Engenharias',
  alias: null,
  slug: 'ige',
  sigla: 'IGE',
  codigo: 'IGE',
  unidadeSuperiorId: null,
  tipo: 'Instituto',
  unidadeAcademica: true,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
};

/** A identidade da oferta: letras maiúsculas e algarismos, com sublinhado entre palavras, até 50 caracteres. */
export const CODIGO_DA_OFERTA = 'ENGENHARIA_CIVIL_MARABA';

export const OFERTA: JsonDaApi<OfertaCursoDto> = {
  id: '01960000-0000-7000-0000-0000000000d1',
  codigo: CODIGO_DA_OFERTA,
  cursoId: CURSO.id,
  localOfertaId: LOCAL.id,
  unidadeOfertante: {
    origemId: UNIDADE.id,
    sigla: 'IGE',
    nome: UNIDADE.nome,
    tipo: 'Instituto',
  },
  programaDeOferta: { codigo: 'REGULAR', rotulo: 'Regular' },
  formatoPedagogico: { codigo: 'PRESENCIAL', rotulo: 'Presencial' },
  regimeDeFuncionamento: { codigo: 'EXTENSIVO', rotulo: 'Extensivo' },
  regimeDeTurno: { codigo: 'REGULAR', rotulo: 'Regular' },
  turnos: [{ codigo: 'MATUTINO', rotulo: 'Matutino' }],
  codigoEmec: '123456',
  codigoNoSistemaAcademico: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: null,
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

/** Nome acessível das ações da linha de `OFERTA`: curso, unidade, local, programa e turnos. */
export const IDENTIFICADOR_DA_OFERTA =
  'Engenharia Civil · IGE · Campus sede — Marabá · Regular · Matutino';

/** Escolhe os vínculos e o turno que o cadastro exige, sem tocar no código da oferta. */
export async function escolherVinculosETurno(page: Page): Promise<void> {
  await page.locator('#cfg-oferta-curso-id').selectOption(CURSO.id);
  await page.locator('#cfg-oferta-local-id').selectOption(LOCAL.id);
  await page.locator('#cfg-oferta-unidade-id').selectOption(UNIDADE.id);
  await page.locator('label.checkbox', { hasText: 'Matutino' }).click();
}

export async function preencherCodigoDaOferta(page: Page, codigo: string): Promise<void> {
  await page.locator('input[formcontrolname="codigo"]').fill(codigo);
}

/** O cadastro completo: o código e tudo o que a oferta exige. */
export async function preencherCadastroDaOferta(page: Page): Promise<void> {
  await preencherCodigoDaOferta(page, CODIGO_DA_OFERTA);
  await escolherVinculosETurno(page);
}

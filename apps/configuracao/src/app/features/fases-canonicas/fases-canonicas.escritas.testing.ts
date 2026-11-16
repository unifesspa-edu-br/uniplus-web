import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { expect } from 'vitest';
import {
  BASE,
  CenaDaPagina,
  URL_DAS_UNIDADES,
  URL_DA_LISTA,
  montarPagina,
  propagar,
} from './fases-canonicas.testing';

export const ESCRITA = `${BASE}/api/configuracao/admin/fases-canonicas/f1`;

export const fase: FaseCanonicaDto = {
  id: 'f1',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: true,
  permiteComplementacao: false,
  admiteAgruparEtapas: true,
  admiteComplementacao: false,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: 'NO_EDITAL',
  criadoEm: '2026-06-10T12:00:00Z',
};

export async function montarPaginaComFase(): Promise<CenaDaPagina> {
  const cena = montarPagina();
  cena.controller.expectOne((r) => r.url === URL_DA_LISTA).flush([fase]);
  cena.controller.match((r) => r.url === URL_DAS_UNIDADES).forEach((r) => r.flush([]));
  await propagarRenderizando(cena);
  return cena;
}

export async function propagarRenderizando(cena: CenaDaPagina): Promise<void> {
  await propagar(cena);
  cena.fixture.detectChanges();
}

export function elemento<T extends HTMLElement>(cena: CenaDaPagina, seletor: string): T {
  const encontrado = cena.fixture.nativeElement.querySelector(seletor) as T | null;
  expect(encontrado, seletor).not.toBeNull();
  return encontrado as T;
}

export async function abrirEdicao(cena: CenaDaPagina): Promise<void> {
  elemento<HTMLButtonElement>(cena, 'button[aria-label="Editar fase canônica AVALIACAO"]').click();
  await propagarRenderizando(cena);
}

export async function confirmarRemocao(cena: CenaDaPagina): Promise<void> {
  elemento<HTMLButtonElement>(cena, 'button[aria-label="Remover fase canônica AVALIACAO"]').click();
  await propagarRenderizando(cena);
  elemento<HTMLButtonElement>(cena, '[data-testid="confirm-dialog-confirm"]').click();
  await propagarRenderizando(cena);
}

export async function concluirRecarga(cena: CenaDaPagina): Promise<void> {
  await propagarRenderizando(cena);
  cena.controller.expectOne((r) => r.url === URL_DA_LISTA).flush([fase]);
  await propagarRenderizando(cena);
}

export const botaoSalvar = (cena: CenaDaPagina): HTMLButtonElement =>
  elemento(cena, 'button[form="cfg-fase-canonica-form"]');

export const statusDaPagina = (cena: CenaDaPagina): string =>
  elemento(cena, ':scope > span.sr-only[role="status"]').textContent ?? '';

export const botaoPorTexto = (cena: CenaDaPagina, texto: string): HTMLButtonElement | undefined =>
  [...(cena.fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
    (botao) => botao.textContent?.trim() === texto,
  );

export const problema = (status: number, corpo: object) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    {
      status,
      statusText: 'Erro',
      headers: { 'content-type': 'application/problem+json' },
    },
  ] as const;

export const recusaDeNome = () =>
  problema(422, {
    code: 'uniplus.validacao',
    errors: [
      {
        field: 'Nome',
        code: 'uniplus.configuracao.fase_canonica.invalido',
        message: 'Nome recusado.',
      },
    ],
  });

export const falhaDoServidor = () => problema(500, { code: 'uniplus.erro' });

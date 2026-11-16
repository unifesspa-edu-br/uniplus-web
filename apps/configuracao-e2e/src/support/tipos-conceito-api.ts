import type { Page } from '@playwright/test';
import type { TipoConceitoDto } from '@uniplus/shared-data/configuracao';
import { servirLeitura } from './escritas-retidas';

/** Os tipos de conceito que o formulário de tipo de etapa oferece como admitidos. */
export const PARECER_FINAL: TipoConceitoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'PARECER_FINAL',
  nome: 'Parecer final',
  descricao: null,
  natureza: 'categorico',
  ativo: true,
  numerico: null,
  valores: [
    { codigo: 'APTO', rotulo: 'Apto', contaComoAprovacao: true },
    { codigo: 'INAPTO', rotulo: 'Inapto', contaComoAprovacao: false },
  ],
};

export const TIPOS_DE_CONCEITO: readonly TipoConceitoDto[] = [PARECER_FINAL];

/**
 * O formulário só grava depois de ler o catálogo de conceitos; sem esta rota a leitura falha e o
 * envio fica recusado com "Aguarde os tipos de conceito carregarem".
 */
export async function mockTiposDeConceito(page: Page): Promise<void> {
  await servirLeitura(page, /\/api\/configuracao\/tipos-conceito(\?.*)?$/, TIPOS_DE_CONCEITO);
}

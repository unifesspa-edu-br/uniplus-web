import type { InscricaoDoProcessoDto, OfertaEscolhidaDto } from '@uniplus/shared-data/selecao';
import { INSCRICAO_ENVIADA } from './situacoes-da-inscricao.testing';

export const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const OFERTA_MEDICINA = '01960000-0000-7000-0000-00000000aaa1';

export const PROCESSO = { id: PROCESSO_ID, nome: 'PSR 2027' };
export const MEDICINA = 'Medicina (Bacharelado) — Faculdade de Medicina — INTEGRAL';
export const DIREITO = 'Direito (Bacharelado) — Faculdade de Direito — Noturno';

export const oferta = (ordem: number, nome: string | null): OfertaEscolhidaDto => ({
  id: `${OFERTA_MEDICINA.slice(0, -1)}${ordem}`,
  nome,
  ordem,
});

export const FERNANDA: InscricaoDoProcessoDto = {
  id: 'insc-fernanda',
  processo: PROCESSO,
  numeroInscricao: '2027-000101',
  situacao: INSCRICAO_ENVIADA,
  ofertas: [oferta(1, MEDICINA), oferta(2, DIREITO)],
  nome: { valor: 'Fernanda Laura Nicole Drumond' },
  cpf: { valor: '***.598.363-**', podeRevelar: false },
  enviadaEm: '2026-12-10T15:00:00Z',
};

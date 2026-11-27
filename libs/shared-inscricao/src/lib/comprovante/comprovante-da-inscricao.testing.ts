import type { ComprovanteDaInscricaoDto } from '@uniplus/shared-data/selecao';

export const FUSO = { id: 'America/Belem', nome: 'Belém (PA)' };

/** O envio 2 de 2 (o que vale) de Fernanda Drumond, persona fictícia do portal de documentação. */
const COMPROVANTE: ComprovanteDaInscricaoDto = {
  inscricao: {
    inscricaoId: '0199e000-0000-7000-8000-0000000000e1',
    numero: 2,
    total: 2,
    vale: true,
    numeroAnterior: 1,
    numeroSeguinte: null,
    envio: {
      numeroInscricao: '2027-000042',
      enviadoEm: '2026-12-11T13:30:00Z',
      fusoHorario: FUSO,
      hashIntegridade: 'a'.repeat(64),
    },
    cancelamento: null,
    prazoDaCorrecao: { fim: '2026-12-20T02:59:00Z', fusoHorario: FUSO, aberto: true },
  },
  processo: {
    processoSeletivoId: '0199e000-0000-7000-8000-0000000000d1',
    nomeDoProcesso: 'Medicina 2027',
    identificadorDoProcesso: 'Edital 001/2026',
    unidadeAdministradora: 'Centro de Processos Seletivos',
  },
  candidato: {
    nomeCivil: 'Fernanda Laura Nicole Drumond',
    nomeSocial: null,
    usaNomeSocial: false,
    cpfMascarado: '***.598.363-**',
  },
  escolhasDeCurso: {
    numeroDeOpcoesDeCurso: 1,
    opcoesDeCurso: [{ ordem: 1, nome: 'Direito — Campus Marabá', modalidades: null }],
  },
  formulario: { secoes: [], derivados: [], termosAceitos: [], documentos: [] },
};

export const comprovanteBase = (): ComprovanteDaInscricaoDto => structuredClone(COMPROVANTE);

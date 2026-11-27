import { PROCESSO_PUBLICADO_COMPLETO } from './processo-publicado-completo';
import { regraDaExigencia } from './regra-de-comprovacao-do-servidor';

export const NOMES_DOS_DOCUMENTOS = ['RG', 'CIN', 'Passaporte'] as const;

export const REGRAS_DE_IDENTIFICACAO = NOMES_DOS_DOCUMENTOS.map((nome, indice) =>
  regraDaExigencia({
    id: `01a0d640-0000-7000-8000-000000000a${indice + 31}`,
    faseId: PROCESSO_PUBLICADO_COMPLETO.cronogramaFases[0].id,
    tipoDocumento: {
      id: `01a0d640-0000-7000-8000-000000000b${indice + 31}`,
      codigo: nome.toUpperCase(),
      nome,
    },
    obrigatorio: true,
    consequenciaDoDescumprimento: 'ELIMINA_DO_PROCESSO',
  }),
);

export const TIPOS_DE_IDENTIFICACAO = REGRAS_DE_IDENTIFICACAO.map((regra) => ({
  ...regra.documento?.tipoDocumento,
  descricao: null,
  formatosAceitos: 'pdf',
  tamanhoMaximoMb: 10,
  tipoEquivalente: null,
  protecaoAprovada: true,
  criadoEm: '2026-08-30T12:00:00Z',
}));

import { conteudoInicial } from '@uniplus/shared-ui/components';

import { FaseDoCronograma, WizardDraft } from '../../processo-seletivo.models';
import { umaFaseDoCronograma } from '../../shared/fase-do-cronograma.testing';

export const DOCUMENTO_ID = '01960000-0000-7000-0000-000000000518';

export function draftVazio(): WizardDraft {
  return {
    tipoProcesso: { selected: '', rotulo: '', codigo: '' },
    pagamento: { cobra: null, valor: '', fundamentos: [] },
    identificacao: {
      nome: '',
      identificadorLegivel: '',
      unidadeAdministradoraId: '',
      origemCandidatos: '',
      localidade: null,
      uploads: [],
    },
    opcoesDeCurso: { numero: '' },
    vagas: { ofertas: [], cascata: null },
    cronograma: { fases: [], etapas: [], algoritmoContagemCodigo: '', algoritmoContagemVersao: '' },
    classificacao: {
      regraCalculoCodigo: '',
      regraCalculoVersao: '',
      regraArredondamentoCodigo: '',
      regraArredondamentoVersao: '',
      casasArredondamento: '',
      regraOrdemAlocacaoCodigo: '',
      regraOrdemAlocacaoVersao: '',
      baseadoEmEnem: false,
      escalaNotaFinal: '',
      resolucaoPesoAreaEnem: '',
      regrasEliminacao: [],
      edicoesEnem: [],
    },
    bonus: {
      aplica: false,
      regraCodigo: '',
      regraVersao: '',
      fator: '',
      teto: '',
      baseLegalBonusRegionalId: '',
      fatoElegibilidadeCodigo: '',
    },
    desempate: [],
    documentos: { raizes: [], emTodasAsFases: [] },
    formulario: {
      faseCodigo: '',
      conteudo: conteudoInicial(),
      referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
      derivacao: [],
      outrasFinalidades: [],
    },
    atendimento: { condicoes: [], recursos: [], tiposDeficiencia: [] },
    publicacao: {
      numero: '',
      periodoInscricaoInicio: '',
      periodoInscricaoFim: '',
      ato: { orgao: '', serie: '', ano: '', dataDoAto: '', assinante: '', tipoAtoCodigo: '' },
      anexos: [],
    },
  };
}

export function fase(parcial: Partial<FaseDoCronograma> & { ordem: number }): FaseDoCronograma {
  return umaFaseDoCronograma({
    faseCanonicaId: `fase-${parcial.ordem}`,
    codigo: `FASE-${parcial.ordem}`,
    ...parcial,
  });
}

export function atoCompleto(): WizardDraft['publicacao']['ato'] {
  return {
    orgao: 'Reitoria',
    serie: '1',
    ano: '2027',
    dataDoAto: '2027-01-15',
    assinante: 'Reitor',
    tipoAtoCodigo: 'PORTARIA',
  };
}

export const congeladosBase = {
  origemData: '',
  agrupaEtapas: false,
  coletaInscricao: false,
  permiteComplementacao: false,
  coletaSolicitacaoIsencao: false,
  bancas: [],
};

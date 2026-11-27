import { FaseDoCronograma, WizardDraft } from '../../processo-seletivo.models';
import { rascunhoInicial } from '../../rascunho-inicial';
import { umaFaseDoCronograma } from '../../shared/fase-do-cronograma.testing';

export const DOCUMENTO_ID = '01960000-0000-7000-0000-000000000518';

export function draftVazio(): WizardDraft {
  const rascunho = rascunhoInicial();
  return { ...rascunho, fada: { ...rascunho.fada, aplica: false } };
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

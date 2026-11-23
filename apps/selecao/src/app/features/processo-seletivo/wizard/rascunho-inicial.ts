import { conteudoInicial } from '@uniplus/shared-inscricao/formulario';

import type {
  CalculoDaClassificacao,
  RegrasDaClassificacao,
  WizardDraft,
} from './processo-seletivo.models';
import { exigenciasVazias } from './shared/exigencias/exigencias-documentais';

/**
 * O rascunho de um processo novo. Nada nasce semeado: cada campo vazio é decisão que quem
 * configura precisa tomar, e semear inventaria configuração que ninguém declarou.
 *
 * Os documentos exigidos, em particular, dependem do cadastro de Configuração, que cresce sem
 * deploy: uma lista local envelheceria junto com ele.
 * A classificação importada não tem etapa pontuada, portanto o cronograma nasce sem etapas.
 */
export function rascunhoInicial(): WizardDraft {
  return {
    tipoProcesso: { selected: '', rotulo: '', codigo: '' },
    identificacao: identificacaoInicial(),
    pagamento: { cobra: null, valor: '', fundamentos: [] },
    provaPresencial: { temProvaPresencial: null, municipios: [] },
    ...ofertaInicial(),
    cronograma: { fases: [], etapas: [], algoritmoContagemCodigo: '', algoritmoContagemVersao: '' },
    ...regrasDaClassificacaoIniciais(),
    documentos: exigenciasVazias(),
    formulario: formularioInicial(),
    atendimento: { condicoes: [], recursos: [], tiposDeficiencia: [] },
    publicacao: publicacaoInicial(),
  };
}

function ofertaInicial(): Pick<WizardDraft, 'opcoesDeCurso' | 'vagas'> {
  return { opcoesDeCurso: { numero: '' }, vagas: { ofertas: [], cascata: null } };
}

export function regrasDaClassificacaoIniciais(): RegrasDaClassificacao {
  return { classificacao: classificacaoInicial(), bonus: bonusInicial(), desempate: [] };
}

function identificacaoInicial(): WizardDraft['identificacao'] {
  return {
    nome: '',
    identificadorLegivel: '',
    unidadeAdministradoraId: '',
    origemCandidatos: '',
    localidade: null,
    uploads: [],
  };
}

export function classificacaoInicial(): WizardDraft['classificacao'] {
  return {
    ...calculoInicial(),
    regraOrdemAlocacaoCodigo: '',
    regraOrdemAlocacaoVersao: '',
    baseadoEmEnem: false,
    escalaNotaFinal: '',
    resolucaoPesoAreaEnem: '',
    regrasEliminacao: [],
    edicoesEnem: [],
  };
}

export function calculoInicial(): CalculoDaClassificacao {
  return {
    regraCalculoCodigo: '',
    regraCalculoVersao: '',
    regraArredondamentoCodigo: '',
    regraArredondamentoVersao: '',
    casasArredondamento: '',
  };
}

export function bonusInicial(): WizardDraft['bonus'] {
  return {
    aplica: null,
    regraCodigo: '',
    regraVersao: '',
    fator: '',
    teto: '',
    baseLegalBonusRegionalId: '',
    fatoElegibilidadeCodigo: '',
  };
}

/**
 * O formulário nasce só com a revisão e aceite; a seção dos dados básicos vem da API quando ele é
 * criado.
 */
function formularioInicial(): WizardDraft['formulario'] {
  return {
    faseCodigo: '',
    conteudo: conteudoInicial(),
    referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
    derivacao: [],
    outrasFinalidades: [],
  };
}

function publicacaoInicial(): WizardDraft['publicacao'] {
  return {
    numero: '',
    periodoInscricaoInicio: '',
    periodoInscricaoFim: '',
    ato: { orgao: '', serie: '', ano: '', dataDoAto: '', assinante: '', tipoAtoCodigo: '' },
    anexos: [],
  };
}

import { OrigemDataFaseCodigo } from '@uniplus/shared-data/configuracao';
import { CaraterEtapaCodigo } from '@uniplus/shared-data/selecao';
import {
  type EtapaPontuada,
  type FaseDoCronograma,
  type ProdutoDaFase,
} from '../../processo-seletivo.models';
import {
  problemasDoCronograma,
  type CatalogosDaConferencia,
  type CronogramaConferido,
} from './cronograma-do-certame';
import { type ExigenciaDeclarada } from './conferencia-das-exigencias-declaradas';
import { type TipoDeEtapaDoCatalogo } from './regras-da-etapa';
import { type FaseCanonicaDto, type PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';
import { type AtoDoCatalogo } from '../fase/configuracao-da-fase';
import { umaFaseDoCronograma } from '../../shared/fase-do-cronograma.testing';

/** O catálogo de atos não descreve nenhum destes códigos: o servidor arbitra. */
export const SEM_CATALOGO: ReadonlyMap<string, AtoDoCatalogo> = new Map();
export const nomeDaBanca = (id: string): string => id;

/**
 * Tipo de etapa que admite qualquer caráter — o caso comum dos cenários de outro assunto. Quem
 * testa o recorte do cadastro passa o seu por `problemasDoCronograma` diretamente.
 */
export const tipoQueAdmiteTudo = (): TipoDeEtapaDoCatalogo => ({
  nome: 'Prova objetiva',
  avaliacao: { admitePontuacao: true, admiteEliminacao: true, notaDeOrigemNoEnem: false },
});

/** Os catálogos da conferência: fases do teste, sem precedência nem ato, e tipo de etapa que admite tudo. */
export function catalogosDeTeste(
  parcial: Partial<CatalogosDaConferencia> = {},
): CatalogosDaConferencia {
  return {
    fasePorId: catalogoDeFases,
    precedencias: [],
    atoPorCodigo: SEM_CATALOGO,
    nomeDaBanca,
    tipoDaEtapa: tipoQueAdmiteTudo,
    ...parcial,
  };
}

/** A conferência do cronograma, com os catálogos que ela consulta. */
export function problemasDe(
  fases: CronogramaConferido['fases'],
  etapas: CronogramaConferido['etapas'],
  fasePorId: CatalogosDaConferencia['fasePorId'],
  precedencias: CatalogosDaConferencia['precedencias'],
): readonly string[] {
  const catalogos = catalogosDeTeste({ fasePorId, precedencias });
  return problemasDoCronograma({ fases, etapas, exigencias: [], catalogos });
}

export const ORIGEM_NO_EDITAL = {
  codigo: OrigemDataFaseCodigo.NO_EDITAL,
  rotulo: 'Origem no edital',
};
export const ORIGEM_NA_EXECUCAO = {
  codigo: OrigemDataFaseCodigo.NA_EXECUCAO,
  rotulo: 'Origem na execução',
};

const FASE_CANONICA_PADRAO = {
  id: 'fase-1',
  codigo: 'INSCRICAO',
  nome: 'Inscrição',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: false,
  permiteComplementacao: false,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: ORIGEM_NO_EDITAL,
  criadoEm: '2026-08-30T12:00:00Z',
};

export function faseCanonica(parcial: Partial<FaseCanonicaDto>): FaseCanonicaDto {
  return { ...FASE_CANONICA_PADRAO, ...parcial } as FaseCanonicaDto;
}

export function fase(parcial: Partial<FaseDoCronograma>): FaseDoCronograma {
  return umaFaseDoCronograma({ codigo: 'INSCRICAO', ...parcial });
}

export function aresta(parcial: Partial<PrecedenciaFaseDto>): PrecedenciaFaseDto {
  return {
    id: 'aresta-1',
    antecessoraCodigo: 'INSCRICAO',
    sucessoraCodigo: 'HOMOLOGACAO',
    permiteSobreposicao: false,
    criadoEm: '2026-08-30T12:00:00Z',
    ...parcial,
  } as PrecedenciaFaseDto;
}

/**
 * Espalhar um `Partial` faz o TypeScript aceitar o objeto mesmo sem as propriedades
 * obrigatórias, então o fixture as declara todas à mão: uma etapa sem `recursos` faria a
 * conferência que percorre a coleção estourar no teste em vez de reprovar de verdade.
 */
const ETAPA_PADRAO: EtapaPontuada = {
  id: null,
  nome: 'Prova Objetiva',
  carater: CaraterEtapaCodigo.classificatoria,
  tipoEtapaOrigemId: 'tipo-1',
  peso: '2',
  notaMinima: '',
  ordem: 1,
  faseCodigo: '',
  produtos: [],
  inicio: '',
  fim: '',
  emiteParecerIndividual: false,
  bancas: [],
  recursos: [],
  tiposDeDecisao: [],
};

export function etapa(parcial: Partial<EtapaPontuada>): EtapaPontuada {
  return { ...ETAPA_PADRAO, ...parcial };
}

/**
 * Uma exigência declarada, ancorada e conforme — os testes de norma partem daqui e mexem só
 * no que estão medindo. Montar o objeto à mão deixava `faseViva` indefinido, e a conferência
 * de ancoragem acusava "fase que saiu do cronograma" em teste que falava de outra coisa.
 */
export function exigenciaDeclarada(parcial: Partial<ExigenciaDeclarada>): ExigenciaDeclarada {
  return {
    nome: 'Documento',
    decideResultado: false,
    normaResolvida: false,
    faseCodigo: 'AVALIACAO',
    faseViva: true,
    alcancaModalidade: true,
    reenvioSemComplementacao: false,
    semFormulario: false,
    problemasDeGatilho: [],
    problemasDeFase: [],
    ...parcial,
  };
}

export const PRELIMINAR: ProdutoDaFase = { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' };
export const DEFINITIVO: ProdutoDaFase = { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' };
export const AVISO: ProdutoDaFase = { atoCodigo: 'COMUNICADO', papel: null };

export const tipoDoEnem = (): TipoDeEtapaDoCatalogo => ({
  nome: 'Nota do ENEM',
  avaliacao: { admitePontuacao: true, admiteEliminacao: true, notaDeOrigemNoEnem: true },
});

export const AVALIACAO = faseCanonica({
  id: 'id-avaliacao',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  agrupaEtapas: true,
  origemData: ORIGEM_NO_EDITAL,
});
export const RESULTADO = faseCanonica({
  id: 'id-resultado',
  codigo: 'RESULTADO_PRELIMINAR',
  nome: 'Resultado preliminar',
  origemData: ORIGEM_NA_EXECUCAO,
});
export const catalogoDeFases = new Map([
  [AVALIACAO.id, AVALIACAO],
  [RESULTADO.id, RESULTADO],
]);

export const etapaValida = etapa({
  nome: 'Prova',
  carater: CaraterEtapaCodigo.classificatoria,
  tipoEtapaOrigemId: 'tipo-1',
  peso: '1',
});
export const faseDeAvaliacao = fase({
  faseCanonicaId: AVALIACAO.id,
  codigo: 'AVALIACAO',
  inicio: '2026-03-01T08:00:00-03:00',
  fim: '2026-03-02T18:00:00-03:00',
});

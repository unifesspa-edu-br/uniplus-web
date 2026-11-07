import { CaraterEtapa } from '@uniplus/shared-data/selecao';
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

/** O catálogo de atos não descreve nenhum destes códigos: o servidor arbitra. */
export const SEM_CATALOGO: ReadonlyMap<string, AtoDoCatalogo> = new Map();
export const nomeDaBanca = (id: string): string => id;

/**
 * Tipo de etapa que admite qualquer caráter — o caso comum dos cenários de outro assunto. Quem
 * testa o recorte do cadastro passa o seu por `problemasDoCronograma` diretamente.
 */
export const tipoQueAdmiteTudo = (): TipoDeEtapaDoCatalogo => ({
  nome: 'Prova objetiva',
  admitePontuacao: true,
  admiteEliminacao: true,
  notaDeOrigemNoEnem: false,
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
  return problemasDoCronograma({
    fases,
    etapas,
    exigencias: [],
    catalogos: {
      fasePorId,
      precedencias,
      atoPorCodigo: SEM_CATALOGO,
      nomeDaBanca,
      tipoDaEtapa: tipoQueAdmiteTudo,
    },
  });
}

export function faseCanonica(parcial: Partial<FaseCanonicaDto>): FaseCanonicaDto {
  return {
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
    origemData: 'NO_EDITAL',
    criadoEm: '2026-08-30T12:00:00Z',
    ...parcial,
  } as FaseCanonicaDto;
}

export function fase(parcial: Partial<FaseDoCronograma>): FaseDoCronograma {
  return {
    faseCanonicaId: 'id-1',
    codigo: 'INSCRICAO',
    ordem: 1,
    inicio: null,
    fim: null,
    unidadeResponsavelId: null,
    produtos: [],
    faseConcluinteCodigo: null,
    emiteParecerIndividual: false,
    bancasRequeridas: [],
    regraRecurso: null,
    congelados: null,
    ...parcial,
  };
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
 * obrigatórias, então o fixture as declara todas à mão: antes disto ele devolvia uma etapa
 * sem `recursos`, e qualquer conferência que percorresse a coleção estourava no teste em vez
 * de reprovar de verdade.
 */
export function etapa(parcial: Partial<EtapaPontuada>): EtapaPontuada {
  return {
    id: null,
    nome: 'Prova Objetiva',
    carater: CaraterEtapa.classificatoria,
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
    ...parcial,
  };
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
  admitePontuacao: true,
  admiteEliminacao: true,
  notaDeOrigemNoEnem: true,
});

export const AVALIACAO = faseCanonica({
  id: 'id-avaliacao',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  agrupaEtapas: true,
  origemData: 'NO_EDITAL',
});
export const RESULTADO = faseCanonica({
  id: 'id-resultado',
  codigo: 'RESULTADO_PRELIMINAR',
  nome: 'Resultado preliminar',
  origemData: 'NA_EXECUCAO',
});
export const catalogoDeFases = new Map([
  [AVALIACAO.id, AVALIACAO],
  [RESULTADO.id, RESULTADO],
]);

export const etapaValida = etapa({
  nome: 'Prova',
  carater: CaraterEtapa.classificatoria,
  tipoEtapaOrigemId: 'tipo-1',
  peso: '1',
});
export const faseDeAvaliacao = fase({
  faseCanonicaId: AVALIACAO.id,
  codigo: 'AVALIACAO',
  inicio: '2026-03-01T08:00:00-03:00',
  fim: '2026-03-02T18:00:00-03:00',
});

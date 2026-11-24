import type { CriterioDesempateConfigurado } from '../../processo-seletivo.models';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000008aa';
export const RESOLUCAO = 'Resolução nº 805/2024/Consepe';
export const OUTRA_RESOLUCAO = 'Resolução nº 900/2026/Consepe';
export const ROTA_PESOS = '/api/configuracao/pesos-area-enem';
export const ROTA_AREAS = '/api/configuracao/pesos-area-enem/areas';
export const ROTA_DESEMPATE = `/api/selecao/processos-seletivos/${PROCESSO_ID}/criterios-desempate`;
export const ROTA_DETALHE = `/api/selecao/processos-seletivos/${PROCESSO_ID}`;
export const REGRA_POR_AREA = 'DESEMPATE_MAIOR_NOTA_AREA_ENEM|1';

export const ERRO_500 = {
  corpo: { type: 'about:blank', title: 'Erro interno.', status: 500, code: 'x', traceId: 't' },
  opcoes: { status: 500, statusText: 'Internal Server Error' },
};

/**
 * A lista canônica que `GET …/pesos-area-enem/areas` publica — a ordem de qualquer quadro. Não tem
 * a área de um grupo só: o rótulo dela na tela só pode ter vindo do quadro.
 */
export const AREAS_CANONICAS = [
  { codigo: 'REDACAO', rotulo: 'Redação' },
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática' },
];

export const TECNOLOGICA = { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' };
export const SAUDE = { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' };

export function area(codigo: string, rotulo: string) {
  return { codigo, rotulo, peso: 1, corte: null };
}

export function linha(resolucao: string, grupo: typeof TECNOLOGICA, areas: unknown[]) {
  return {
    id: `${resolucao}-${grupo.codigo}`,
    resolucao,
    grupoCurso: grupo,
    areas,
    baseLegal: 'Anexo I',
    criadoEm: '2026-09-01T00:00:00Z',
  };
}

/**
 * A Tecnológica tem uma área que a Saúde não tem, e as áreas chegam fora da ordem canônica, para a
 * tela mostrar a ordem da lista canônica.
 */
export const PESOS = [
  linha(RESOLUCAO, TECNOLOGICA, [
    area('MATEMATICA', 'Matemática'),
    area('AREA_SO_DE_UM_GRUPO', 'Área de um grupo só'),
    area('REDACAO', 'Redação'),
  ]),
  linha(RESOLUCAO, SAUDE, [area('REDACAO', 'Redação'), area('MATEMATICA', 'Matemática')]),
  linha(OUTRA_RESOLUCAO, TECNOLOGICA, [
    area('MATEMATICA', 'Matemática'),
    area('LINGUAGENS', 'Linguagens'),
  ]),
  linha(OUTRA_RESOLUCAO, SAUDE, [
    area('MATEMATICA', 'Matemática'),
    area('LINGUAGENS', 'Linguagens'),
  ]),
];

/**
 * A cópia que a gravação da classificação congelou: só Linguagens, em todos os grupos — uma área
 * que o cadastro de nenhuma das duas resoluções tem, para a tela só poder tê-la tirado da cópia.
 */
export const QUADRO_CONGELADO = [
  { grupoAreaEnem: TECNOLOGICA, baseLegal: 'Anexo I', areas: [area('LINGUAGENS', 'Linguagens')] },
  { grupoAreaEnem: SAUDE, baseLegal: 'Anexo I', areas: [area('LINGUAGENS', 'Linguagens')] },
];

/** Uma cópia com Linguagens e Redação em todos os grupos: Linguagens é comum à outra resolução. */
export const COPIA_COM_LINGUAGENS_E_REDACAO = [TECNOLOGICA, SAUDE].map((grupo) => ({
  grupoAreaEnem: grupo,
  baseLegal: 'Anexo I',
  areas: [area('LINGUAGENS', 'Linguagens'), area('REDACAO', 'Redação')],
}));

export const CLASSIFICACAO_COM_QUADRO = {
  regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
  regraCalculoVersao: '1.0',
  baseadoEmEnem: true,
  resolucaoPesoAreaEnem: RESOLUCAO,
};

export function criterio(areas: string[]): CriterioDesempateConfigurado {
  return {
    regraCodigo: 'DESEMPATE_MAIOR_NOTA_AREA_ENEM',
    regraVersao: '1',
    etapaRef: '',
    idadeMinima: '',
    fato: '',
    operador: '',
    valor: '',
    areas,
  };
}

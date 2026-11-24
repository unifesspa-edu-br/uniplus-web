import type { Page } from '@playwright/test';

/** Os vocabulários de configuração que as telas pedem à API, com os códigos do contrato. */
const CODIGOS_POR_VOCABULARIO: Readonly<Record<string, readonly string[]>> = {
  'abrangencias-dia-nao-util': ['NACIONAL', 'ESTADUAL', 'MUNICIPAL', 'INSTITUCIONAL'],
  'acoes-quando-indeferido': ['RECLASSIFICA_AC', 'RECLASSIFICA_CONFORME_EDITAL'],
  'composicoes-vagas': [
    'RESTANTE_DAS_VAGAS_OFERTADAS',
    'DENTRO_DA_RESERVA_LEGAL',
    'RETIRADA_DE_OUTRA_MODALIDADE',
    'SUPLEMENTAR_AO_TOTAL',
  ],
  'formas-aceite': ['A_DEFINIR', 'REGISTRO_SEM_ENDERECO_IP', 'REGISTRO_COM_ENDERECO_IP'],
  'formatos-pedagogicos': ['PRESENCIAL', 'SEMIPRESENCIAL', 'EAD'],
  'naturezas-legais': ['COTA_RESERVADA', 'AMPLA', 'ACAO_AFIRMATIVA'],
  'origens-data-fase': ['NO_EDITAL', 'NA_EXECUCAO'],
  'regras-remanejamento': ['SEGUE_ORDEM_DE_REMANEJAMENTO', 'DESTINO_UNICO', 'CRUZADO'],
  'tipos-local-oferta': [
    'CAMPUS_SEDE',
    'CAMPUS_FORA_DE_SEDE',
    'CURSO_FORA_DE_SEDE',
    'POLO_DE_EDUCACAO_A_DISTANCIA',
    'CONVENIO_DE_INTERIORIZACAO',
    'OUTRO',
  ],
  'programas-oferta': [
    'REGULAR',
    'FORMA_PARA',
    'PARFOR',
    'PRONERA',
    'PEPETI',
    'CONVENIO_OUTRO',
    'OUTRO',
  ],
  'regimes-funcionamento': ['INTENSIVO', 'EXTENSIVO', 'ALTERNANCIA_PEDAGOGICA'],
  'regimes-turno': ['REGULAR', 'INTEGRAL'],
  'turnos-oferta': ['MATUTINO', 'VESPERTINO', 'NOTURNO'],
};

/** O rótulo de teste: o código em palavras, só para a tela ter o que mostrar. */
const rotuloDeTeste = (codigo: string): string => {
  const palavras = codigo.toLowerCase().replaceAll('_', ' ');
  return `${palavras.charAt(0).toUpperCase()}${palavras.slice(1)}`;
};

/**
 * Responde os vocabulários de configuração com os códigos do contrato. É registrado antes das
 * rotas de cada teste, que a sobrepõem quando precisam de uma lista própria.
 */
export async function mockVocabulariosDeConfiguracao(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/vocabularios\/([a-z-]+)(\?.*)?$/, async (route) => {
    const nome = /vocabularios\/([a-z-]+)/.exec(route.request().url())?.[1] ?? '';
    const codigos = CODIGOS_POR_VOCABULARIO[nome];
    if (codigos === undefined) return route.fallback();
    const corpo = codigos.map((codigo) => ({ codigo, rotulo: rotuloDeTeste(codigo) }));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(corpo),
    });
  });
}

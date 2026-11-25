import { describe, expect, it } from 'vitest';

import { passoDoPonteiro, type DestinoDoPonteiro } from './passo-do-ponteiro';

describe('passoDoPonteiro', () => {
  it.each<[string, DestinoDoPonteiro]>([
    ['/identificacao/tipoProcessoCodigo', { passo: 'Tipo do processo' }],
    ['/identificacao/tipoProcessoNome', { passo: 'Tipo do processo' }],
    ['/identificacao/nome', { passo: 'Identificação' }],
    ['/identificacao/localidadeCodigoIbge', { passo: 'Identificação' }],
    ['/identificacao', { passo: 'Identificação' }],
    ['/identificacao/algoritmoContagemPrazo/codigo', { passo: 'Cronograma' }],
    ['/taxaDeInscricao/valor', { passo: 'Pagamento' }],
    ['/opcoesDeCurso/numero', { passo: 'Vagas' }],
    ['/distribuicaoVagas/0/percentualDaReservaLegal', { passo: 'Vagas' }],
    ['/ordemDeRemanejamento/destinos/2/ordem', { passo: 'Vagas' }],
    ['/cronograma/fases/1/inicio', { passo: 'Cronograma', detalhe: 'fase' }],
    ['/cronograma', { passo: 'Cronograma' }],
    ['/etapas/0/peso', { passo: 'Cronograma', detalhe: 'etapa' }],
    ['/documentosExigidos/exigencias/0/finalidade', { passo: 'Cronograma', detalhe: 'documentos' }],
    ['/motivos/3', { passo: 'Cronograma', detalhe: 'decisoes' }],
    ['/classificacao/regraCalculo/codigo', { passo: 'Fórmula e precisão' }],
    ['/classificacao/escalaNotaFinal', { passo: 'Fórmula e precisão' }],
    ['/classificacao/resolucaoPesoAreaEnem', { passo: 'Fórmula e precisão' }],
    ['/classificacao', { passo: 'Fórmula e precisão' }],
    ['/classificacao/regrasEliminacao/0/parametros/etapaChave', { passo: 'Eliminação' }],
    ['/classificacao/criteriosDeDesempate/1/parametros/areas/0', { passo: 'Desempate' }],
    ['/fada/fator', { passo: 'FADA' }],
    ['/atendimento/condicoes/0/condicaoCodigo', { passo: 'Atend. especial' }],
    ['/formularios/0/itens/2/rotulo', { passo: 'Formulários' }],
    ['/coleta/calculosDosDados/0', { passo: 'Formulários' }],
  ])('leva %s ao passo certo', (ponteiro, esperado) => {
    expect(passoDoPonteiro(ponteiro)).toEqual(esperado);
  });

  it.each([
    '/provaPresencial/municipios/0',
    '/importacao/relatorios',
    '/divulgacao/camposPublicos',
  ])('trata %s como parte do documento sem tela', (ponteiro) => {
    expect(passoDoPonteiro(ponteiro)).toEqual({ passo: null, motivo: 'documentoSemTela' });
  });

  it.each(['', '/', '/formato', '/id', '/desconhecido/campo', 'identificacao/nome', '/a/~2'])(
    'trata "%s" como fora do mapa, sem inventar passo',
    (ponteiro) => {
      expect(passoDoPonteiro(ponteiro)).toEqual({ passo: null, motivo: 'foraDoMapa' });
    },
  );

  it('lê o segmento decodificado: `~1` é parte do nome e não separa a seção do campo', () => {
    expect(passoDoPonteiro('/taxaDeInscricao~1valor')).toEqual({
      passo: null,
      motivo: 'foraDoMapa',
    });
  });
});

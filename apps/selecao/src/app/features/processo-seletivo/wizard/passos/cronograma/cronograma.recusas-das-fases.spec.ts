import { describe, expect, it } from 'vitest';

import { ID_AVALIACAO, ID_RESULTADO } from './cronograma.testing';

import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDeRecusasDasFases,
  PAGINAS_DE_ERRO,
} from './cronograma-recusas-das-fases.testing';

const FASE_FORA_DO_CATALOGO = '01960000-0000-7000-0000-0000000000aa';
const RECUSADA_NOS_CAMPOS =
  'A gravação do cronograma foi recusada. A mensagem de cada recusa está no campo a que ela se refere.';
const QUORUM = 'uniplus.selecao.banca.quorum_fora_do_intervalo';
const RECORTE = 'uniplus.selecao.banca.recorte_em_banca_de_recursos';
const TIPO_INVALIDO = 'uniplus.selecao.motivo_de_decisao.tipo_invalido';
const PROCEDIMENTO = 'uniplus.selecao.regra_recurso_fase.procedimento_para_decisao_nao_declarada';
const SEM_PRODUTO = 'uniplus.selecao.produto_da_fase.ato_nao_encontrado_no_catalogo';
const GERAL = 'uniplus.selecao.fase_cronograma.cronograma_incompleto';

function textoNoResumo(mensagem: string, codigo: string): string {
  return `${mensagem} (código ${codigo}; entenda a recusa em ${PAGINAS_DE_ERRO}${codigo})`;
}

describe('CronogramaPassoComponent: recusas da gravação das fases', () => {
  let comFases: ContextoDoCronograma['comFases'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];
  let recusarFases: AjudantesDeRecusasDasFases['recusarFases'];
  let bloco: AjudantesDeRecusasDasFases['bloco'];

  usarCronograma((tela) => {
    ({ comFases, comEtapasEmFases } = tela);
    ({ recusarFases, bloco } = new AjudantesDeRecusasDasFases(tela));
  });

  it('leva a recusa da regra da banca ao bloco das bancas, com mensagem, código e página', async () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    await recusarFases([
      {
        field: 'fases[0].bancasRequeridas[0].regraDeDeliberacao.quorum',
        code: QUORUM,
        message: 'O quórum fica entre 1 e o número de integrantes.',
      },
    ]);

    expect(bloco('fase-AVALIACAO-bancas-erro')).toContain('O quórum fica entre 1 e o número');
    expect(bloco('fase-AVALIACAO-bancas-erro')).toContain(QUORUM);
    expect(document.querySelector(`a[href="${PAGINAS_DE_ERRO}${QUORUM}"]`)).not.toBeNull();
  });

  it('mostra a recusa recorte_em_banca_de_recursos pela mensagem da API', async () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    await recusarFases([
      {
        field: 'fases[0].bancasRequeridas[0]',
        code: RECORTE,
        message: 'A banca de recursos não declara a categoria de documento.',
      },
    ]);

    expect(bloco('fase-AVALIACAO-bancas-erro')).toContain(
      'A banca de recursos não declara a categoria',
    );
  });

  it('põe no topo da fase a recusa que a tela não liga a um controle', async () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    const resultado = await recusarFases([
      { field: 'fases[0].tiposDeDecisao[0]', code: TIPO_INVALIDO, message: 'Tipo desconhecido.' },
    ]);

    expect(bloco('fase-AVALIACAO-recusas')).toContain('Tipo desconhecido.');
    expect(resultado.messages).toEqual([RECUSADA_NOS_CAMPOS]);
  });

  it('põe no bloco da regra de recurso a recusa dela, mesmo sem regra declarada', async () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    await recusarFases([
      { field: 'fases[0].regraRecurso', code: PROCEDIMENTO, message: 'Marque o tipo de novo.' },
    ]);

    expect(bloco('fase-AVALIACAO-recurso-recusa')).toContain('Marque o tipo de novo.');
  });

  it('abre a fase que recebeu a recusa, e só ela', async () => {
    comFases(ID_AVALIACAO, ID_RESULTADO);
    comEtapasEmFases(['AVALIACAO']);

    await recusarFases([{ field: 'fases[1].produtos[0]', code: SEM_PRODUTO, message: 'Sem ato.' }]);

    expect(bloco('fase-RESULTADO_FINAL-produtos-erro')).toContain('Sem ato.');
    expect(bloco('fase-AVALIACAO-produtos-erro')).toBeNull();
  });

  it('resume, com mensagem, código e página, a recusa de fase que o envio não tinha', async () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    const resultado = await recusarFases([
      { field: 'fases[5].produtos[0]', code: SEM_PRODUTO, message: 'Sem ato.' },
    ]);

    expect(resultado.messages).toEqual([
      `Sem ato. (código ${SEM_PRODUTO}; entenda a recusa em ${PAGINAS_DE_ERRO}${SEM_PRODUTO})`,
    ]);
  });

  it('diz só que a gravação foi recusada quando toda recusa achou o campo dela', async () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    const resultado = await recusarFases([
      { field: 'fases[0].produtos[0]', code: SEM_PRODUTO, message: 'Sem ato.' },
      { field: 'fases[0].inicio', code: 'uniplus.x', message: 'Início inválido.' },
    ]);

    expect(bloco('fase-AVALIACAO-produtos-erro')).toContain('Sem ato.');
    expect(resultado.messages).toEqual([RECUSADA_NOS_CAMPOS]);
  });

  it('resume a causa geral com mensagem, código e página', async () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    const resultado = await recusarFases([
      { code: GERAL, message: 'O cronograma está incompleto.' },
    ]);

    expect(resultado.messages).toEqual([textoNoResumo('O cronograma está incompleto.', GERAL)]);
  });

  it('resume só a recusa sem lugar e a causa geral quando a resposta traz também recusa de campo', async () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    const resultado = await recusarFases([
      { field: 'fases[0].produtos[0]', code: SEM_PRODUTO, message: 'Sem ato.' },
      { field: 'fases[5].produtos[0]', code: SEM_PRODUTO, message: 'Fase que o envio não tinha.' },
      { code: GERAL, message: 'O cronograma está incompleto.' },
    ]);

    expect(bloco('fase-AVALIACAO-produtos-erro')).toContain('Sem ato.');
    expect(resultado.messages).toEqual([
      textoNoResumo('Fase que o envio não tinha.', SEM_PRODUTO),
      textoNoResumo('O cronograma está incompleto.', GERAL),
    ]);
  });

  it('resume o início e o fim recusados quando o período da fase não é obrigatório na tela', async () => {
    comFases(ID_RESULTADO);
    comEtapasEmFases(['RESULTADO_FINAL']);

    const resultado = await recusarFases([
      { field: 'fases[0].inicio', code: 'uniplus.x', message: 'Início inválido.' },
      { field: 'fases[0].fim', code: 'uniplus.y', message: 'Fim inválido.' },
    ]);

    expect(bloco('cr-inicio-erro-0')).toBeNull();
    expect(bloco('cr-fim-erro-0')).toBeNull();
    expect(resultado.messages).toEqual([
      textoNoResumo('Início inválido.', 'uniplus.x'),
      textoNoResumo('Fim inválido.', 'uniplus.y'),
    ]);
  });

  it('resume a unidade recusada quando a tela não mostra o que a fase exige', async () => {
    comFases(FASE_FORA_DO_CATALOGO);

    const resultado = await recusarFases([
      { field: 'fases[0].unidadeResponsavelId', code: 'uniplus.x', message: 'Unidade inválida.' },
    ]);

    expect(bloco('cr-unidade-erro-0')).toBeNull();
    expect(resultado.messages).toEqual([textoNoResumo('Unidade inválida.', 'uniplus.x')]);
  });

  it('continua mostrando no campo o início recusado quando o período é obrigatório', async () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    const resultado = await recusarFases([
      { field: 'fases[0].inicio', code: 'uniplus.x', message: 'Início inválido.' },
    ]);

    expect(bloco('cr-inicio-erro-0')).toContain('Início inválido.');
    expect(resultado.messages).toEqual([RECUSADA_NOS_CAMPOS]);
  });
});

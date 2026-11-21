import { describe, expect, it } from 'vitest';

import { umRecursoDaEtapa } from '../../shared/etapa-do-cronograma.testing';
import { PAGINAS_DE_ERRO } from './cronograma-recusas-das-fases.testing';
import { RECUSA_MOSTRADA_NOS_CAMPOS } from '../../shared/recusas/texto-da-recusa-no-resumo';
import { ID_AVALIACAO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDeRecusasDasEtapas,
  recusaDaEtapa,
} from './cronograma-recusas-das-etapas.testing';

describe('CronogramaPassoComponent: recusas das etapas no campo', () => {
  let cronograma: ContextoDoCronograma['cronograma'];
  let expansao: ContextoDoCronograma['expansao'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];
  let nativo: ContextoDoCronograma['nativo'];
  let detectar: ContextoDoCronograma['detectar'];
  let comFases: ContextoDoCronograma['comFases'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let recusarEtapas: AjudantesDeRecusasDasEtapas['recusarEtapas'];
  let bloco: AjudantesDeRecusasDasEtapas['bloco'];

  usarCronograma((tela) => {
    ({ cronograma, expansao, nativo, detectar, comFases, comEtapasEmFases, proximoPasso } = tela);
    ({ recusarEtapas, bloco } = new AjudantesDeRecusasDasEtapas(tela));
  });

  /** Uma etapa de nota com um recurso válido, fechada: a recusa é que a abre. */
  function etapaFechadaComRecurso(): void {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    const recurso = umRecursoDaEtapa({ ancora: 'cienciaIndividual', atoAncoraCodigo: '' });
    cronograma.etapas.at(0).controls.recursos.setValue([recurso]);
    expansao.alternarFase(0);
    detectar();
  }

  const focoDepoisDeRecusar = async (...campos: string[]): Promise<string | undefined> => {
    await recusarEtapas(campos.map((campo) => recusaDaEtapa(campo)));
    await proximoPasso();
    detectar();
    return document.activeElement?.id;
  };

  it('abre a etapa fechada que recebeu a recusa e mostra a mensagem sob o campo', async () => {
    etapaFechadaComRecurso();
    expect(expansao.etapaAberta(0)).toBe(false);

    await recusarEtapas([recusaDaEtapa('etapas[0].notaMaxima', 'A nota máxima não serve.')]);

    expect(expansao.etapaAberta(0)).toBe(true);
    expect(bloco('cr-etapa-nota-maxima-erro-0')).toContain('A nota máxima não serve.');
    expect(bloco('cr-etapa-nota-maxima-erro-0')).toContain('uniplus.selecao.etapa_processo');
  });

  it('descreve só pelo campo o que o campo recusou, e não pelas recusas dos outros', async () => {
    etapaFechadaComRecurso();

    await recusarEtapas([recusaDaEtapa('etapas[0].notaMaxima')]);

    const maxima = nativo.querySelector('#cr-etapa-nota-maxima-0');
    const minima = nativo.querySelector('#cr-etapa-nota-0');
    expect(maxima?.getAttribute('aria-invalid')).toBe('true');
    expect(maxima?.getAttribute('aria-describedby')).toBe('cr-etapa-nota-maxima-erro-0');
    expect(minima?.getAttribute('aria-invalid')).not.toBe('true');
    expect(minima?.getAttribute('aria-describedby') ?? '').not.toContain('cr-etapa-nota-maxima');
  });

  it('leva o foco ao controle da primeira recusa que a API deu, não ao mais alto da tela', async () => {
    etapaFechadaComRecurso();

    const foco = await focoDepoisDeRecusar('etapas[0].notaMaxima', 'etapas[0].notaMinima');

    expect(foco).toBe('cr-etapa-nota-maxima-0');
  });

  it('abre o bloco dos recursos e leva o foco ao controle do recurso recusado', async () => {
    etapaFechadaComRecurso();
    expect(expansao.blocoAberto(0, 'recursos')).toBe(false);

    const foco = await focoDepoisDeRecusar('etapas[0].recursos[0].prazoValor');

    expect(expansao.blocoAberto(0, 'recursos')).toBe(true);
    expect(foco).toBe('cr-rec-prazo-0-0');
    expect(bloco('cr-rec-recusa-prazoValor-0-0')).toContain(
      'Recusa de etapas[0].recursos[0].prazoValor.',
    );
  });

  const invalido = (id: string) => nativo.querySelector(`#${id}`)?.getAttribute('aria-invalid');
  const descricaoDe = (id: string) =>
    nativo.querySelector(`#${id}`)?.getAttribute('aria-describedby') ?? '';

  it.each([
    ['prazoValor', 'cr-rec-prazo-0-0', 'prazoUnidade', 'cr-rec-un-0-0'],
    ['prazoUnidade', 'cr-rec-un-0-0', 'prazoValor', 'cr-rec-prazo-0-0'],
    [
      'suspensividadePrimeiraInstanciaValor',
      'cr-rec-susp1-val-0-0',
      'suspensividadePrimeiraInstanciaUnidade',
      'cr-rec-susp1-un-0-0',
    ],
    [
      'suspensividadePrimeiraInstanciaUnidade',
      'cr-rec-susp1-un-0-0',
      'suspensividadePrimeiraInstanciaValor',
      'cr-rec-susp1-val-0-0',
    ],
  ])(
    'marca e descreve só o controle recusado (%s), e não o do par (%s)',
    async (campo, id, outro, idDoOutro) => {
      etapaFechadaComRecurso();

      await recusarEtapas([recusaDaEtapa(`etapas[0].recursos[0].${campo}`)]);

      expect(invalido(id)).toBe('true');
      expect(descricaoDe(id)).toContain(`cr-rec-recusa-${campo}-0-0`);
      expect(invalido(idDoOutro)).not.toBe('true');
      expect(descricaoDe(idDoOutro)).not.toContain(`cr-rec-recusa-${campo}-0-0`);
      expect(bloco(`cr-rec-recusa-${outro}-0-0`)).toBeNull();
    },
  );

  it('descreve a suspensividade da 2ª instância controle a controle', async () => {
    etapaFechadaComRecurso();
    cronograma.etapas.at(0).controls.recursos.setValue([
      umRecursoDaEtapa({
        ancora: 'cienciaIndividual',
        atoAncoraCodigo: '',
        admiteInstanciaSuperior: true,
      }),
    ]);
    detectar();

    await recusarEtapas([
      recusaDaEtapa('etapas[0].recursos[0].suspensividadeSegundaInstanciaUnidade'),
    ]);

    expect(invalido('cr-rec-susp2-un-0-0')).toBe('true');
    expect(invalido('cr-rec-susp2-val-0-0')).not.toBe('true');
  });

  it('leva o foco ao controle recusado do par, e não ao primeiro dele', async () => {
    etapaFechadaComRecurso();

    const foco = await focoDepoisDeRecusar('etapas[0].recursos[0].prazoUnidade');

    expect(foco).toBe('cr-rec-un-0-0');
  });

  it('leva o foco à primeira regra de consolidação oferecida quando nenhuma está marcada', async () => {
    etapaFechadaComRecurso();
    cronograma.etapas.at(0).controls.formaDeAvaliacao.setValue('HUMANA');
    detectar();
    expansao.abrirEtapas([0]);
    detectar();
    const primeira = nativo.querySelector('input[name="cr-etapa-regra-0"]');

    const foco = await focoDepoisDeRecusar('etapas[0].regraConsolidacao');

    expect(primeira).not.toBeNull();
    expect(foco).toBe(primeira?.id);
    expect(foco).toMatch(/^cr-etapa-regra-opcao-0-/);
  });

  it('leva ao resumo a recusa do campo que a etapa não conhece, com mensagem, código e página', async () => {
    etapaFechadaComRecurso();

    const resultado = await recusarEtapas([recusaDaEtapa('etapas[0].id')]);

    expect(resultado.messages).toEqual([
      `Recusa de etapas[0].id. (código uniplus.selecao.etapa_processo.recusa_de_teste; entenda a recusa em ${PAGINAS_DE_ERRO}uniplus.selecao.etapa_processo.recusa_de_teste)`,
    ]);
    expect(nativo.querySelector('#cr-etapa-recusas-0')).toBeNull();
  });

  it('leva ao resumo a recusa do campo que o recurso não conhece', async () => {
    etapaFechadaComRecurso();

    const resultado = await recusarEtapas([
      recusaDaEtapa('etapas[0].recursos[0].campoQueNaoExiste'),
    ]);

    expect(resultado.messages).toHaveLength(1);
    expect(bloco('cr-rec-recusa-recurso-0-0')).toBeNull();
  });

  it('leva o foco ao bloco das recusas do recurso quando a recusa é do recurso inteiro', async () => {
    etapaFechadaComRecurso();

    const foco = await focoDepoisDeRecusar('etapas[0].recursos[0]');

    expect(foco).toBe('cr-rec-recusa-recurso-0-0');
  });

  it('mostra no topo da etapa o campo dela que não tem controle na tela', async () => {
    etapaFechadaComRecurso();

    const foco = await focoDepoisDeRecusar('etapas[0].peso');

    expect(bloco('cr-etapa-recusas-0')).toContain('Recusa de etapas[0].peso.');
    expect(foco).toBe('cr-etapa-recusas-0');
  });

  it('leva ao resumo a recusa do recurso que a etapa não tem, com mensagem e código', async () => {
    etapaFechadaComRecurso();

    const resultado = await recusarEtapas([recusaDaEtapa('etapas[0].recursos[5].prazoValor')]);

    expect(resultado.messages).toEqual([
      `Recusa de etapas[0].recursos[5].prazoValor. (código uniplus.selecao.etapa_processo.recusa_de_teste; entenda a recusa em ${PAGINAS_DE_ERRO}uniplus.selecao.etapa_processo.recusa_de_teste)`,
    ]);
  });

  it('leva ao resumo a recusa da etapa que não existe mais no formulário', async () => {
    etapaFechadaComRecurso();

    const resultado = await recusarEtapas([recusaDaEtapa('etapas[3].notaMaxima')]);

    expect(resultado.messages).toHaveLength(1);
    expect(resultado.messages?.[0]).toContain('etapa_processo.recusa_de_teste');
  });

  it('leva ao resumo a recusa do campo que a etapa não mostra mais', async () => {
    etapaFechadaComRecurso();

    const resultado = await recusarEtapas([recusaDaEtapa('etapas[0].passoDoLancamento')]);

    expect(nativo.querySelector('#cr-etapa-passo-0')).toBeNull();
    expect(resultado.messages).toHaveLength(1);
    expect(resultado.messages?.[0]).toContain('Recusa de etapas[0].passoDoLancamento.');
  });

  it('não deixa o resumo vazio quando toda recusa achou o campo dela', async () => {
    etapaFechadaComRecurso();

    const resultado = await recusarEtapas([recusaDaEtapa('etapas[0].notaMaxima')]);

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toEqual([RECUSA_MOSTRADA_NOS_CAMPOS]);
  });
});

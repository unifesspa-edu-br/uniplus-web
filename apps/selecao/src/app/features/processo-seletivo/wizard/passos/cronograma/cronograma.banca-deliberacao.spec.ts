import type { FormGroup } from '@angular/forms';
import type { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  ATO_INDIVIDUAL,
  COLEGIADA,
  comRegra,
} from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { RECUSA_MOSTRADA_NOS_CAMPOS } from '../../shared/recusas/texto-da-recusa-no-resumo';
import { CatalogoDeBancas } from './catalogos/catalogo-de-bancas.service';
import type { EtapaForm } from './cronograma-form';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import { ID_AVALIACAO, ID_BANCA_HETERO } from './cronograma.testing';
import { AjudantesDeRecusasDasEtapas } from './cronograma-recusas-das-etapas.testing';

const BANCAS = [
  { id: ID_BANCA_HETERO, nome: 'Heteroidentificação' },
  { id: 'outra-banca', nome: 'Redação' },
] as TipoBancaDto[];

const CAMINHO_DA_REGRA = 'etapas[0].bancas[0].regraDeDeliberacao';

describe('CronogramaPassoComponent: regra de deliberação da banca da etapa', () => {
  let raiz: ContextoDoCronograma['raiz'];
  let expansao: ContextoDoCronograma['expansao'];
  let edicao: ContextoDoCronograma['edicao'];
  let recusas: ContextoDoCronograma['recusas'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let detectar: ContextoDoCronograma['detectar'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let nativo: ContextoDoCronograma['nativo'];
  let comFases: ContextoDoCronograma['comFases'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];
  let recusarEtapas: AjudantesDeRecusasDasEtapas['recusarEtapas'];
  let bloco: AjudantesDeRecusasDasEtapas['bloco'];

  usarCronograma((tela) => {
    ({
      raiz,
      expansao,
      edicao,
      recusas,
      cronograma,
      store,
      detectar,
      proximoPasso,
      nativo,
      comFases,
      comEtapasEmFases,
    } = tela);
    ({ recusarEtapas, bloco } = new AjudantesDeRecusasDasEtapas(tela));
  });

  function etapaAberta(): FormGroup<EtapaForm> {
    raiz.injector.get(CatalogoDeBancas).bancas.set(BANCAS);
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    expansao.alternarFase(0);
    expansao.alternarEtapa(0);
    detectar();
    return cronograma.etapas.at(0);
  }

  const campo = <T extends HTMLElement>(sufixo: string) =>
    nativo.querySelector<T>(`#etapa-0-banca-${ID_BANCA_HETERO}-${sufixo}`);
  const escolher = (sufixo: string, valor: string) => {
    const select = campo<HTMLSelectElement>(sufixo);
    if (select === null) throw new Error(`Seletor ${sufixo} não está na tela.`);
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    detectar();
  };
  const digitar = (sufixo: string, valor: string) => {
    const input = campo<HTMLInputElement>(sufixo);
    if (input === null) throw new Error(`Campo ${sufixo} não está na tela.`);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    detectar();
  };
  const regraDa = (etapa: FormGroup<EtapaForm>, posicao = 0) =>
    edicao.bancasDaEtapa(etapa)[posicao]?.regraDeDeliberacao;

  const recusarRegra = (field: string, code: string, message = 'detalhe do servidor') =>
    recusarEtapas([{ field, code, message }]);

  it('mostra o editor da regra só para a banca que a etapa declara', () => {
    const etapa = etapaAberta();
    expect(campo('modo')).toBeNull();

    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
    detectar();

    expect(campo<HTMLSelectElement>('modo')?.value).toBe('');
    expect(campo('integrantes')).toBeNull();

    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, false);
    detectar();

    expect(campo('modo')).toBeNull();
  });

  it('declara a regra da banca da etapa campo a campo', () => {
    const etapa = etapaAberta();
    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
    detectar();

    escolher('modo', ModoDeDeliberacao.colegiadaComVotacao);
    digitar('integrantes', '5');
    digitar('suplentes', '2');
    escolher('encerramento', 'presidenciaNoQuorum');
    digitar('quorum', '3');
    escolher('criterio', 'maioriaSimples');
    escolher('desempate', 'votoDaPresidencia');

    expect(regraDa(etapa)).toEqual(COLEGIADA);
    expect(etapa.controls.bancas.dirty).toBe(true);
  });

  it('cobra sob o campo o que a regra declarada ainda não tem', () => {
    const etapa = etapaAberta();
    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
    edicao.declararRegraDaBancaDaEtapa(etapa, ID_BANCA_HETERO, comRegra({ criterio: '' }));
    detectar();

    expect(campo('criterio-erro')?.textContent).toContain('Escolha o critério');
    expect(campo('criterio')?.getAttribute('aria-invalid')).toBe('true');
    expect(campo('quorum-erro')).toBeNull();
  });

  it('mostra a regra inválida já declarada mesmo com o cadastro de bancas vazio', () => {
    const etapa = etapaAberta();
    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
    edicao.declararRegraDaBancaDaEtapa(etapa, ID_BANCA_HETERO, comRegra({ criterio: '' }));
    raiz.injector.get(CatalogoDeBancas).bancas.set([]);
    detectar();

    expect(nativo.textContent).toContain('Nenhum tipo de banca no cadastro.');
    expect(campo('criterio-erro')?.textContent).toContain('Escolha o critério');
    expect(campo('criterio')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('explica a falha de carga do cadastro de bancas em vez de esconder a regra declarada', () => {
    const etapa = etapaAberta();
    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
    edicao.declararRegraDaBancaDaEtapa(etapa, ID_BANCA_HETERO, comRegra({ criterio: '' }));
    raiz.injector.get(CatalogoDeBancas).erro.set('Não foi possível carregar as bancas.');
    detectar();

    expect(nativo.querySelector('ui-alert .alert__title')?.textContent).toBe(
      'Não foi possível carregar os catálogos',
    );
    expect(nativo.textContent).toContain('bancas');
  });

  it('mantém a regra da banca quando outra é marcada ou desmarcada', () => {
    const etapa = etapaAberta();
    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
    edicao.declararRegraDaBancaDaEtapa(etapa, ID_BANCA_HETERO, COLEGIADA);

    edicao.alternarBancaDaEtapa(etapa, 'outra-banca', true);
    edicao.alternarBancaDaEtapa(etapa, 'outra-banca', false);

    expect(edicao.bancasDaEtapa(etapa)).toEqual([
      {
        id: null,
        identificadorLocal: 'banca-1',
        copiaDoTipo: null,
        tipoBancaId: ID_BANCA_HETERO,
        regraDeDeliberacao: COLEGIADA,
      },
    ]);
  });

  it('declara a regra só da banca que o tipo nomeia', () => {
    const etapa = etapaAberta();
    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
    edicao.alternarBancaDaEtapa(etapa, 'outra-banca', true);

    edicao.declararRegraDaBancaDaEtapa(etapa, 'outra-banca', COLEGIADA);

    expect(regraDa(etapa, 0)).toBeNull();
    expect(regraDa(etapa, 1)).toEqual(COLEGIADA);
  });

  it('não aceita edição da regra com a edição suspensa', () => {
    const etapa = etapaAberta();
    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
    edicao.declararRegraDaBancaDaEtapa(etapa, ID_BANCA_HETERO, COLEGIADA);
    store.salvando.set(true);
    detectar();

    expect(campo<HTMLSelectElement>('modo')?.disabled).toBe(true);
    expect(campo<HTMLInputElement>('integrantes')?.disabled).toBe(true);
  });

  describe('recusa do servidor', () => {
    function comRegraGravada(): FormGroup<EtapaForm> {
      const etapa = etapaAberta();
      edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
      edicao.declararRegraDaBancaDaEtapa(etapa, ID_BANCA_HETERO, COLEGIADA);
      detectar();
      return etapa;
    }

    const blocoDasBancas = () => bloco('cr-etapa-bancas-erro-0');
    const blocoDo = (sufixo: string, banca = ID_BANCA_HETERO) =>
      bloco(`etapa-0-banca-${banca}-${sufixo}`);
    const doQuorum = (
      posicao = 0,
      message = 'O quórum precisa ficar entre 1 e o número de integrantes.',
    ) => ({
      field: `etapas[0].bancas[${posicao}].regraDeDeliberacao.quorum`,
      code: `uniplus.selecao.banca.quorum_${posicao}`,
      message,
    });

    it('aparece sob o campo da regra, com mensagem, código e página, quando o caminho o nomeia', async () => {
      comRegraGravada();

      await recusarRegra(
        `${CAMINHO_DA_REGRA}.quorum`,
        'uniplus.selecao.banca.quorum_fora_do_intervalo',
        'O quórum precisa ficar entre 1 e o número de integrantes.',
      );

      expect(blocoDo('quorum-recusas')).toContain('entre 1 e o número de integrantes');
      expect(blocoDo('quorum-recusas')).toContain('uniplus.selecao.banca.quorum_fora_do_intervalo');
      expect(
        nativo.querySelector(
          `#etapa-0-banca-${ID_BANCA_HETERO}-quorum-recusas a[href$="uniplus.selecao.banca.quorum_fora_do_intervalo"]`,
        ),
      ).not.toBeNull();
    });

    it('marca como inválido e descreve só o campo recusado, e não o bloco das bancas', async () => {
      comRegraGravada();

      await recusarEtapas([doQuorum()]);

      expect(campo('quorum')?.getAttribute('aria-invalid')).toBe('true');
      expect(campo('quorum')?.getAttribute('aria-describedby')).toBe(
        `etapa-0-banca-${ID_BANCA_HETERO}-quorum-recusas`,
      );
      expect(campo('criterio')?.getAttribute('aria-invalid')).toBeNull();
      expect(blocoDasBancas()).toBeNull();
    });

    it('mostra sob o modo a recusa à regra inteira', async () => {
      comRegraGravada();

      await recusarRegra(
        CAMINHO_DA_REGRA,
        'uniplus.selecao.banca.regra_obrigatoria',
        'Declare a regra.',
      );

      expect(blocoDo('modo-recusas')).toContain('Declare a regra.');
      expect(campo('modo')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('mostra sob o modo a recusa ao campo que a tela não mostra para a regra de agora', async () => {
      const etapa = comRegraGravada();
      edicao.declararRegraDaBancaDaEtapa(etapa, ID_BANCA_HETERO, ATO_INDIVIDUAL);
      detectar();

      await recusarEtapas([doQuorum()]);

      expect(campo('quorum')).toBeNull();
      expect(blocoDo('modo-recusas')).toContain('entre 1 e o número de integrantes');
      expect(campo('modo')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('aparece sob o bloco das bancas quando a banca ficou sem regra na publicação', async () => {
      const etapa = comRegraGravada();
      edicao.declararRegraDaBancaDaEtapa(etapa, ID_BANCA_HETERO, null);
      detectar();

      await recusarRegra(
        'etapas[0].bancas[0]',
        'uniplus.selecao.banca.regra_de_deliberacao_obrigatoria',
        'Declare a regra de deliberação da banca.',
      );

      expect(blocoDasBancas()).toContain('Declare a regra de deliberação');
    });

    it('mostra o mínimo de integrantes que o servidor informa, sob os integrantes', async () => {
      comRegraGravada();

      await recusarRegra(
        `${CAMINHO_DA_REGRA}.integrantes`,
        'uniplus.selecao.banca.integrantes_abaixo_do_minimo',
        'A banca precisa de ao menos 7 integrantes.',
      );

      expect(blocoDo('integrantes-recusas')).toContain('ao menos 7 integrantes');
      expect(campo('integrantes')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('não repete no resumo da gravação a mensagem que já está sob o campo', async () => {
      comRegraGravada();

      const resultado = await recusarRegra(
        `${CAMINHO_DA_REGRA}.criterio`,
        'uniplus.selecao.banca.criterio_obrigatorio',
        'Escolha o critério da votação.',
      );

      expect(resultado.messages).toEqual([RECUSA_MOSTRADA_NOS_CAMPOS]);
    });

    it('marca o grupo das bancas como descrito pela recusa à banca inteira', async () => {
      comRegraGravada();

      await recusarRegra('etapas[0].bancas[0]', 'uniplus.selecao.banca.recorte_obrigatorio');

      const grupo = nativo.querySelector(
        '[role="group"][aria-labelledby="cr-etapa-bancas-titulo-0"]',
      );
      expect(grupo?.getAttribute('aria-describedby')).toBe('cr-etapa-bancas-erro-0');
    });

    it('leva o foco ao campo recusado da regra', async () => {
      comRegraGravada();
      await recusarEtapas([doQuorum()]);

      await proximoPasso();
      detectar();

      expect(document.activeElement?.id).toBe(`etapa-0-banca-${ID_BANCA_HETERO}-quorum`);
    });

    it('leva a recusa da segunda banca junto com ela quando a primeira é retirada, e some a da retirada', async () => {
      const etapa = comRegraGravada();
      edicao.alternarBancaDaEtapa(etapa, 'outra-banca', true);
      edicao.declararRegraDaBancaDaEtapa(etapa, 'outra-banca', COLEGIADA);
      detectar();
      await recusarEtapas([doQuorum(0, 'Quórum da primeira.'), doQuorum(1, 'Quórum da segunda.')]);
      expect(blocoDo('quorum-recusas', 'outra-banca')).toContain('Quórum da segunda.');

      edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, false);
      detectar();

      expect(blocoDo('quorum-recusas', 'outra-banca')).toContain('Quórum da segunda.');
      expect(nativo.textContent).not.toContain('Quórum da primeira.');
    });

    it('fica a conferir de novo quando qualquer campo da etapa muda, e não volta ao desfazer', async () => {
      const etapa = comRegraGravada();
      await recusarEtapas([doQuorum()]);
      expect(recusas.recusasDoCampo(etapa, 'bancas.0.quorum')[0].aConferir).toBe(false);

      etapa.controls.notaMaxima.setValue('10');
      etapa.controls.notaMaxima.setValue('');
      detectar();

      expect(recusas.recusasDoCampo(etapa, 'bancas.0.quorum')[0].aConferir).toBe(true);
      expect(blocoDo('quorum-recusas')).toContain('conferida de novo');
      expect(campo('quorum')?.hasAttribute('aria-invalid')).toBe(false);
    });

    it('passa a conferir de novo quando as bancas mudam', async () => {
      const etapa = comRegraGravada();
      await recusarEtapas([doQuorum()]);

      edicao.alternarBancaDaEtapa(etapa, 'outra-banca', true);
      detectar();

      expect(recusas.recusasDoCampo(etapa, 'bancas.0.quorum')[0].aConferir).toBe(true);
      expect(blocoDo('quorum-recusas')).toContain('conferida de novo');
    });
  });
});

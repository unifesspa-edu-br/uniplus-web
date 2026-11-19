import type { FormGroup } from '@angular/forms';
import type { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { COLEGIADA, comRegra } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { CatalogoDeBancas } from './catalogos/catalogo-de-bancas.service';
import type { EtapaForm } from './cronograma-form';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  ID_AVALIACAO,
  ID_BANCA_HETERO,
  PROBLEM_JSON,
  PROCESSO_ID,
  ROTA_ETAPAS,
  ROTA_FASES,
} from './cronograma.testing';

const BANCAS = [
  { id: ID_BANCA_HETERO, nome: 'Heteroidentificação' },
  { id: 'outra-banca', nome: 'Redação' },
] as TipoBancaDto[];

const CAMINHO_DA_REGRA = 'etapas[0].bancas[0].regraDeDeliberacao';

describe('CronogramaPassoComponent: regra de deliberação da banca da etapa', () => {
  let componente: ContextoDoCronograma['componente'];
  let raiz: ContextoDoCronograma['raiz'];
  let expansao: ContextoDoCronograma['expansao'];
  let edicao: ContextoDoCronograma['edicao'];
  let recusas: ContextoDoCronograma['recusas'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let comFases: ContextoDoCronograma['comFases'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];

  usarCronograma((tela) => {
    ({
      componente,
      raiz,
      expansao,
      edicao,
      recusas,
      cronograma,
      store,
      controller,
      detectar,
      nativo,
      proximoPasso,
      comFases,
      comEtapasEmFases,
    } = tela);
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

  async function recusarRegra(field: string, code: string, message = 'detalhe do servidor') {
    store.processoSeletivoId.set(PROCESSO_ID);
    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(
      {
        type: 'about:blank',
        title: 'Validação',
        status: 422,
        code: 'uniplus.validacao',
        traceId: '00000000000000000000000000000009',
        errors: [{ field, code, message }],
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    const resultado = await gravacao;
    detectar();
    return resultado;
  }

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
      { tipoBancaId: ID_BANCA_HETERO, regraDeDeliberacao: COLEGIADA },
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

    it('aparece sob o campo da regra que o caminho nomeia', async () => {
      comRegraGravada();

      await recusarRegra(
        `${CAMINHO_DA_REGRA}.quorum`,
        'uniplus.selecao.banca.quorum_fora_do_intervalo',
      );

      expect(campo('quorum-erro')?.textContent).toContain('entre 1 e o número de integrantes');
      expect(campo('quorum')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('aparece sob o modo quando a banca ficou sem regra na publicação', async () => {
      const etapa = comRegraGravada();
      edicao.declararRegraDaBancaDaEtapa(etapa, ID_BANCA_HETERO, null);
      detectar();

      await recusarRegra(
        'etapas[0].bancas[0]',
        'uniplus.selecao.banca.regra_de_deliberacao_obrigatoria',
      );

      expect(campo('modo-erro')?.textContent).toContain('Declare a regra de deliberação');
    });

    it('mostra o mínimo de integrantes que o servidor informa', async () => {
      comRegraGravada();

      await recusarRegra(
        `${CAMINHO_DA_REGRA}.integrantes`,
        'uniplus.selecao.banca.integrantes_abaixo_do_minimo',
        'A banca precisa de ao menos 7 integrantes.',
      );

      expect(campo('integrantes-erro')?.textContent).toContain('ao menos 7 integrantes');
    });

    it('vai também ao resumo da gravação, nomeando a etapa', async () => {
      comRegraGravada();

      const resultado = await recusarRegra(
        `${CAMINHO_DA_REGRA}.criterio`,
        'uniplus.selecao.banca.criterio_obrigatorio',
      );

      expect(resultado.messages?.join(' ')).toContain('Etapa 1: Escolha o critério da votação.');
    });

    it('chega ao resumo quando o servidor a recusa na gravação das fases', async () => {
      comRegraGravada();
      store.processoSeletivoId.set(PROCESSO_ID);

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(
        {
          type: 'about:blank',
          title: 'Validação',
          status: 422,
          code: 'uniplus.validacao',
          traceId: '00000000000000000000000000000009',
          errors: [
            {
              field: 'fases[0].bancasRequeridas[0]',
              code: 'uniplus.selecao.banca.integrantes_abaixo_do_minimo',
              message: 'A banca precisa de ao menos 7 integrantes.',
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
      );
      const resultado = await gravacao;

      expect(resultado.valid).toBe(false);
      expect(resultado.messages).toEqual(['Fase 1: A banca precisa de ao menos 7 integrantes.']);
    });

    it('persiste a uma edição que não é das bancas e some quando elas mudam', async () => {
      const etapa = comRegraGravada();
      await recusarRegra(
        `${CAMINHO_DA_REGRA}.quorum`,
        'uniplus.selecao.banca.quorum_fora_do_intervalo',
      );

      etapa.controls.notaMaxima.setValue('10');
      expect(recusas.recusaDoCampo(etapa, 'bancas.0.quorum')).not.toBeNull();

      edicao.alternarBancaDaEtapa(etapa, 'outra-banca', true);
      expect(recusas.recusaDoCampo(etapa, 'bancas.0.quorum')).toBeNull();
    });

    it('não leva consigo a recusa da nota quando as bancas mudam', async () => {
      const etapa = comRegraGravada();
      await recusarRegra(
        'etapas[0].notaMaxima',
        'uniplus.selecao.etapa_processo.nota_maxima_invalida',
      );

      edicao.alternarBancaDaEtapa(etapa, 'outra-banca', true);

      expect(recusas.recusaDoCampo(etapa, 'notaMaxima')).not.toBeNull();
    });

    it('dura até a banca da etapa mudar', async () => {
      const etapa = comRegraGravada();
      await recusarRegra(
        `${CAMINHO_DA_REGRA}.quorum`,
        'uniplus.selecao.banca.quorum_fora_do_intervalo',
      );
      expect(recusas.recusaDoCampo(etapa, 'bancas.0.quorum')).not.toBeNull();

      digitar('quorum', '4');

      expect(recusas.recusaDoCampo(etapa, 'bancas.0.quorum')).toBeNull();
      expect(campo('quorum-erro')).toBeNull();
    });
  });
});

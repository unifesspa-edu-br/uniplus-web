import { TestBed } from '@angular/core/testing';
import { OrigemCandidatos, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it, vi } from 'vitest';

import { OrigemCandidatosSelecionada } from '../../processo-seletivo.models';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';

import {
  PROCESSO_ID,
  RESOLUCAO,
  ROTA_CLASSIFICACAO,
  ROTA_DETALHE,
  aguardarReleitura,
  componente,
  controller,
  detalheCom,
  lerCadastroComPeso,
  linhaDoCadastro,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from '../eliminacao/eliminacao.testing';

describe('gravação da classificação', () => {
  montarEliminacao();

  describe('persistir()', () => {
    it('recusa sem processo criado', async () => {
      store.processoSeletivoId.set(null);
      const resultado = await componente.persistir();
      expect(resultado.valid).toBe(false);
    });

    it('não chama a API quando a validação recusa', async () => {
      const resultado = await componente.persistir();
      expect(resultado.valid).toBe(false);
      controller.verify();
    });

    it('grava o comando inteiro, com null explícito nos campos não aplicáveis', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
            regraVersao: '1.0',
            etapaRef: 'etapa-1',
            notaMinima: '5',
            minimo: '',
            areaCodigo: '',
          },
        ],
      });

      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_CLASSIFICACAO);
      expect(requisicao.request.method).toBe('PUT');
      expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(requisicao.request.body).toMatchObject({
        regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
        regraArredondamentoCodigo: 'ARRED-TRUNCAR',
        casasArredondamento: 2,
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
            etapaRef: 'etapa-1',
            notaMinima: 5,
            minimo: null,
          },
        ],
      });

      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
    });

    it('envia a resolução de Peso por Área quando a classificação a exige', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_CLASSIFICACAO);
      expect(requisicao.request.body).toMatchObject({
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      controller.expectOne(ROTA_DETALHE).flush(detalheCom(RESOLUCAO, 2));
      await expect(gravacao).resolves.toEqual({ valid: true });
    });

    it('depois de gravar, relê o que o processo congelou para a Fórmula mostrar a cópia nova', async () => {
      prepararClassificacaoLocal();
      store.classificacao.registrarLida(
        (detalheCom('Resolução antiga', 1) as unknown as ProcessoSeletivoDto).classificacao,
      );
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      controller.expectOne(ROTA_DETALHE).flush(detalheCom(RESOLUCAO, 3));
      await gravacao;

      const congelado = store.classificacao.copiaCongeladaEmVigor();
      expect(congelado?.resolucao).toBe(RESOLUCAO);
      expect(congelado?.grupos[0].areas[0].peso).toBe(3);
    });

    it('uma rejeição fora do envelope na releitura não desfaz a gravação que deu certo', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      const cadastro = TestBed.inject(CadastroInicialService);
      vi.spyOn(cadastro, 'obterDetalhe').mockRejectedValue(new Error('falha fora do envelope'));

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });

      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(store.classificacao.motivoDaReleitura()).toBe('desconhecida');
    });

    it('editor superado durante a releitura não relata a gravação como concluída', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      store.geracao.update((valor) => valor + 1);
      controller.expectOne(ROTA_DETALHE).flush(detalheCom(RESOLUCAO, 3));

      await expect(gravacao).resolves.toEqual({ valid: false, messages: [] });
    });

    it('na varredura da publicação não relê o detalhe, que a publicação relê no fim', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      store.travamentoDeOrquestracao.set(true);

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();

      expect(controller.match(ROTA_DETALHE)).toHaveLength(0);
      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(store.classificacao.motivoDaReleitura()).toBe('desconhecida');
    });

    it('na varredura, a gravação conclusiva com a resolução registra a cópia do cadastro lido como por confirmar', async () => {
      lerCadastroComPeso(2);
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      store.travamentoDeOrquestracao.set(true);

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });

      // A gravação chegou: se a releitura do fim da varredura falhar, não é "desconhecida". Mas o
      // servidor copiou o cadastro dele, e só a releitura diz o que ficou congelado.
      expect(store.classificacao.gravada()).toMatchObject({
        estado: 'com-quadro',
        resolucao: RESOLUCAO,
        confirmada: false,
      });
      expect(store.classificacao.copiaCongeladaEmVigor()).toBeNull();
    });

    it('fora da varredura, relê e confirma a cópia com o que o servidor congelou', async () => {
      lerCadastroComPeso(2);
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      expect(store.classificacao.motivoDaReleitura()).toBe('por-confirmar');
      controller.expectOne(ROTA_DETALHE).flush(detalheCom(RESOLUCAO, 3));
      await gravacao;

      expect(store.classificacao.motivoDaReleitura()).not.toBe('por-confirmar');
      expect(store.classificacao.copiaCongeladaEmVigor()?.grupos[0].areas[0].peso).toBe(3);
    });

    it('fora da varredura, a releitura que falha deixa a cópia por confirmar', async () => {
      lerCadastroComPeso(2);
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      controller
        .expectOne(ROTA_DETALHE)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(store.classificacao.motivoDaReleitura()).toBe('por-confirmar');
      expect(store.classificacao.motivoDaReleitura()).not.toBe('desconhecida');
    });

    it('linhas do cadastro sem leitura válida não servem de cópia presumida', async () => {
      TestBed.inject(CatalogosDeClassificacaoService).pesosAreaEnem.set([linhaDoCadastro(2)]);
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      store.travamentoDeOrquestracao.set(true);

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await gravacao;

      expect(store.classificacao.motivoDaReleitura()).toBe('desconhecida');
    });

    it('a gravação recusada também descarta a releitura em curso', async () => {
      prepararClassificacaoLocal();
      const antiga = TestBed.inject(ReleituraDoSnapshot).reler();
      const leituraAntiga = controller.expectOne(ROTA_DETALHE);

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        { type: 'about:blank', title: 'Recusada.', status: 422, code: 'x', traceId: 't' },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      await gravacao;
      leituraAntiga.flush(detalheCom('Resolução antiga', 1));

      await expect(antiga).resolves.toBe(false);
      expect(store.classificacao.gravada()).toEqual({ estado: 'nunca-gravada' });
    });

    it('a gravação que lança também descarta a releitura em curso, e relê depois dela', async () => {
      prepararClassificacaoLocal();
      store.classificacao.marcarDesconhecida();
      const antiga = TestBed.inject(ReleituraDoSnapshot).reler();
      const leituraAntiga = controller.expectOne(ROTA_DETALHE);
      vi.spyOn(TestBed.inject(CadastroInicialService), 'definirClassificacao').mockRejectedValue(
        new Error('falha fora do envelope'),
      );

      const gravacao = componente.persistir();
      await aguardarReleitura();
      const leituraNova = controller.expectOne(ROTA_DETALHE);
      leituraAntiga.flush(detalheCom('Resolução antiga', 1));
      leituraNova.flush(detalheCom(RESOLUCAO, 3));

      await expect(gravacao).rejects.toThrow('falha fora do envelope');
      await expect(antiga).resolves.toBe(false);
      expect(store.classificacao.copiaCongeladaEmVigor()?.resolucao).toBe(RESOLUCAO);
    });

    it('a releitura que começou antes da gravação não decide sobre o que a gravação copiou', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      const antiga = TestBed.inject(ReleituraDoSnapshot).reler();
      const leituraAntiga = controller.expectOne(ROTA_DETALHE);
      store.travamentoDeOrquestracao.set(true);

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await gravacao;
      leituraAntiga.flush(detalheCom('Resolução antiga', 1));

      await expect(antiga).resolves.toBe(false);
      expect(store.classificacao.gravada()).toEqual({ estado: 'desconhecida' });
    });

    it('sem resolução antes e depois da gravação, não relê o detalhe', async () => {
      prepararClassificacaoLocal();

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();

      expect(controller.match(ROTA_DETALHE)).toHaveLength(0);
      await expect(gravacao).resolves.toEqual({ valid: true });
      // O servidor tem agora uma classificação sem quadro, e o desempate é conferido contra ela.
      expect(store.classificacao.gravada()).toEqual({ estado: 'sem-quadro' });
    });

    it('gravada com sucesso sem resolução, a classificação fica sem quadro, mesmo se antes era desconhecida', async () => {
      prepararClassificacaoLocal();
      store.classificacao.marcarDesconhecida();

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();

      // A gravação conclusiva já prova o que o servidor tem: não há o que reler.
      expect(controller.match(ROTA_DETALHE)).toHaveLength(0);
      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(store.classificacao.gravada()).toEqual({ estado: 'sem-quadro' });
    });

    it('marca o quadro congelado como desatualizado quando a releitura falha', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      controller
        .expectOne(ROTA_DETALHE)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(store.classificacao.motivoDaReleitura()).toBe('desconhecida');
    });

    it('não grava a classificação baseada em ENEM sem a resolução, e aponta o passo Fórmula', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', { baseadoEmEnem: true });

      const resultado = await componente.persistir();

      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('resolução de Peso por Área');
      expect(resultado.messages?.join(' ')).toContain('passo Fórmula');
      controller.verify();
    });
  });

  describe('edições do ENEM aceitas', () => {
    const ROTA_EDICOES = `${ROTA_DETALHE}/fatos/EDICAO_ENEM/opcoes`;

    function prepararImportadaComEnem(origem: OrigemCandidatosSelecionada): void {
      store.patchObjectSection('identificacao', { origemCandidatos: origem });
      store.patchObjectSection('classificacao', {
        regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
        regraCalculoVersao: '1.0',
        regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
        regraOrdemAlocacaoVersao: '1.0',
        baseadoEmEnem: true,
        edicoesEnem: ['2025', '2026'],
      });
    }

    async function aceitarClassificacao(): Promise<void> {
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      for (const releitura of controller.match(ROTA_DETALHE)) releitura.flush({ id: PROCESSO_ID });
    }

    it('grava as edições depois da classificação aceita, na ordem que o candidato vê', async () => {
      prepararImportadaComEnem(OrigemCandidatos.inscricaoPropria);

      const gravacao = componente.persistir();
      await aceitarClassificacao();
      const edicoes = controller.expectOne(ROTA_EDICOES);
      expect(edicoes.request.method).toBe('PUT');
      expect(edicoes.request.body).toEqual({
        opcoes: [
          { codigo: '2025', rotulo: 'ENEM 2025' },
          { codigo: '2026', rotulo: 'ENEM 2026' },
        ],
      });
      edicoes.flush(null, { status: 204, statusText: 'No Content' });

      await expect(gravacao).resolves.toEqual({ valid: true });
    });

    it('a recusa do servidor às edições volta o passo inválido e fica guardada para o passo Fórmula', async () => {
      prepararImportadaComEnem(OrigemCandidatos.inscricaoPropria);

      const gravacao = componente.persistir();
      await aceitarClassificacao();
      controller.expectOne(ROTA_EDICOES).flush(
        {
          type: 'about:blank',
          title: 'Edição recusada.',
          detail: 'A edição informada não é aceita.',
          status: 422,
          code: 'uniplus.selecao.opcao_declarada_fato.edicao_enem_fora_de_processo_enem',
          traceId: 't',
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );

      await expect(gravacao).resolves.toEqual({
        valid: false,
        messages: ['Edições do ENEM, no passo Fórmula: A edição informada não é aceita.'],
      });
      expect(store.classificacao.recusaDasEdicoesDoEnem()).toBe('A edição informada não é aceita.');
    });

    it('não grava edições no processo que só importa o resultado', async () => {
      prepararImportadaComEnem(OrigemCandidatos.importacaoExterna);

      const gravacao = componente.persistir();
      await aceitarClassificacao();

      await expect(gravacao).resolves.toEqual({ valid: true });
      controller.expectNone(ROTA_EDICOES);
    });
  });
});

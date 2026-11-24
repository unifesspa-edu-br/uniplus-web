import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { LeituraDoCadastroDePesos } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import {
  PROCESSO_ID,
  RESOLUCAO,
  ROTA_DESEMPATE,
  TECNOLOGICA,
  SAUDE,
  CLASSIFICACAO_COM_QUADRO,
  area,
  criterio,
} from './desempate.areas-enem.dados.testing';
import {
  montar,
  responderPendentes,
  classificacaoGravada,
  comQuadroGravado,
  criterioPorArea,
  seletor,
  opcoesDoSeletor,
  botao,
  acrescentarPelaTela,
  areasNaTela,
  textoDaTela,
  edicaoDosCriterios,
  conferirERestaurar,
} from './desempate.areas-enem.montagem.testing';

describe('DesempatePassoComponent — ordem das áreas do ENEM: montagem da ordem', () => {
  afterEach(conferirERestaurar);

  describe('montagem da ordem', () => {
    it('sem o quadro gravado, deixa os critérios por área para depois da classificação, e os grava quando pedido', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');

      expect(textoDaTela(m)).toContain('serão gravados junto com a classificação');
      expect(m.componente.confirmacaoDeGravacao()?.aviso).toContain(
        'gravados junto com a classificação',
      );
      await expect(m.componente.persistir()).resolves.toEqual({ valid: true });
      m.controller.expectNone((r) => r.url.endsWith(ROTA_DESEMPATE));
      expect(m.store.classificacao.desempatePendenteDeGravacao()).toBe(true);

      comQuadroGravado(m);
      const gravacao = m.componente.gravarAposAClassificacao();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(m.store.classificacao.desempatePendenteDeGravacao()).toBe(false);
      expect(m.store.classificacao.criteriosDesempateGravados()?.[0].areas).toEqual(['REDACAO']);
    });

    it('sem critério pendente, gravar o pendente não vai à rede', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);

      await expect(m.componente.gravarAposAClassificacao()).resolves.toEqual({ valid: true });
      m.controller.expectNone((r) => r.url.endsWith(ROTA_DESEMPATE));
    });

    it('monta a ordem pelo seletor e pelo botão, mostra os rótulos e grava os códigos', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);
      comQuadroGravado(m);
      criterioPorArea(m);

      acrescentarPelaTela(m, 0, 'MATEMATICA');
      acrescentarPelaTela(m, 0, 'REDACAO');

      expect(areasNaTela(m, 0)).toEqual(['1ª Matemática', '2ª Redação']);
      expect(edicaoDosCriterios(m).anuncio()).toBe(
        'Área Redação acrescentada ao critério 1, na posição 2.',
      );

      const gravacao = m.componente.persistir();
      const pedido = m.controller.expectOne((r) => r.url.endsWith(ROTA_DESEMPATE));
      expect(JSON.stringify(pedido.request.body)).toContain('"areas":["MATEMATICA","REDACAO"]');
      pedido.flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(m.store.classificacao.criteriosDesempateGravados()?.[0].areas).toEqual([
        'MATEMATICA',
        'REDACAO',
      ]);
    });

    it('percorrer o seletor pelo teclado não acrescenta nada: só o botão acrescenta', async () => {
      const m = await montar();
      criterioPorArea(m);
      const elemento = seletor(m, 0);
      if (elemento === null) throw new Error('seletor de área ausente');

      for (const codigo of ['REDACAO', 'MATEMATICA']) {
        elemento.value = codigo;
        elemento.dispatchEvent(new Event('change'));
        m.fixture.detectChanges();
      }

      expect(m.componente.criterios()[0].areas).toEqual([]);
    });

    it('a escolha ainda não incluída fica com o critério, e não vai para outro ao remover critérios', async () => {
      const m = await montar();
      criterioPorArea(m);
      criterioPorArea(m);
      const primeiro = seletor(m, 0);
      if (primeiro === null) throw new Error('seletor de área ausente');
      primeiro.value = 'MATEMATICA';
      primeiro.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      edicaoDosCriterios(m).remover(0);
      m.fixture.detectChanges();
      botao(m, 'desemp-area-acrescentar-0').click();
      m.fixture.detectChanges();

      expect(seletor(m, 0)?.value).toBe('');
      expect(m.componente.criterios()[0].areas).toEqual([]);
    });

    it('ao mover critérios, cada seletor mostra a escolha do seu critério', async () => {
      const m = await montar();
      criterioPorArea(m);
      criterioPorArea(m);
      const primeiro = seletor(m, 0);
      if (primeiro === null) throw new Error('seletor de área ausente');
      primeiro.value = 'MATEMATICA';
      primeiro.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      edicaoDosCriterios(m).mover(0, 1);
      m.fixture.detectChanges();

      expect(seletor(m, 0)?.value).toBe('');
      expect(seletor(m, 1)?.value).toBe('MATEMATICA');
    });

    it('a escolha cuja área sai do seletor cai, e não volta escolhida com a área', async () => {
      const m = await montar();
      criterioPorArea(m);
      criterioPorArea(m);
      const segundo = seletor(m, 1);
      if (segundo === null) throw new Error('seletor de área ausente');
      segundo.value = 'MATEMATICA';
      segundo.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      acrescentarPelaTela(m, 0, 'MATEMATICA');
      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();
      botao(m, 'desemp-area-acrescentar-1').click();
      m.fixture.detectChanges();

      expect(seletor(m, 1)?.value).toBe('');
      expect(m.componente.criterios()[1].areas).toEqual([]);
    });

    it('o botão sem área escolhida não acrescenta e pede a escolha', async () => {
      const m = await montar();
      criterioPorArea(m);

      botao(m, 'desemp-area-acrescentar-0').click();
      m.fixture.detectChanges();

      expect(m.componente.criterios()[0].areas).toEqual([]);
      expect(edicaoDosCriterios(m).anuncio()).toBe('Escolha no seletor a área a acrescentar.');
    });

    it('não oferece de novo a área já citada, nem em outro critério por área', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Matemática']);
      expect(opcoesDoSeletor(m, 1)).toEqual(['Matemática']);
    });

    it('reordena e retira as áreas pelos botões, anunciando cada mudança', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');

      const subir = botao(m, 'desemp-area-subir-0-1');
      expect(subir.getAttribute('aria-label')).toBe('Mover a área Matemática para cima');
      subir.click();
      m.fixture.detectChanges();

      expect(areasNaTela(m, 0)).toEqual(['1ª Matemática', '2ª Redação']);
      expect(edicaoDosCriterios(m).anuncio()).toBe(
        'Área Matemática movida para a posição 1 de 2 no critério 1.',
      );

      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();

      expect(areasNaTela(m, 0)).toEqual(['1ª Redação']);
      expect(edicaoDosCriterios(m).anuncio()).toBe('Área Matemática retirada do critério 1.');
    });

    it('trocar de regra limpa as áreas do critério', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');

      edicaoDosCriterios(m).escolherRegra(0, 'DESEMPATE_MAIOR_IDADE|1.0');

      expect(m.componente.criterios()[0].areas).toEqual([]);
    });

    it('a confirmação lista as áreas pelo rótulo', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'MATEMATICA');
      acrescentarPelaTela(m, 0, 'REDACAO');

      expect(m.componente.confirmacaoDeGravacao()?.itens).toEqual([
        { rotulo: '1º critério', valor: 'DESEMPATE_MAIOR_NOTA_AREA_ENEM: Matemática, Redação' },
      ]);
    });

    it('o mesmo anúncio seguido diz qual vez é, para o leitor de tela anunciar de novo', async () => {
      const m = await montar();
      criterioPorArea(m);

      botao(m, 'desemp-area-acrescentar-0').click();
      botao(m, 'desemp-area-acrescentar-0').click();

      expect(edicaoDosCriterios(m).anuncio()).toBe(
        'Escolha no seletor a área a acrescentar. (2ª vez)',
      );
    });

    it('a escolha pendente sobrevive a mexer nas áreas do próprio critério', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      const elemento = seletor(m, 0);
      if (elemento === null) throw new Error('seletor de área ausente');
      elemento.value = 'MATEMATICA';
      elemento.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      edicaoDosCriterios(m).removerArea(0, 0);
      m.fixture.detectChanges();
      botao(m, 'desemp-area-acrescentar-0').click();

      expect(m.componente.criterios()[0].areas).toEqual(['MATEMATICA']);
    });

    it('a escolha pendente sobrevive ao cadastro relido, enquanto ele carrega', async () => {
      const m = await montar();
      criterioPorArea(m);
      const elemento = seletor(m, 0);
      if (elemento === null) throw new Error('seletor de área ausente');
      elemento.value = 'MATEMATICA';
      elemento.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      // A classificação relida com um quadro novo relê o cadastro; enquanto ele carrega, a cópia
      // decide as áreas.
      const copia = [TECNOLOGICA, SAUDE].map((grupo) => ({
        grupoAreaEnem: grupo,
        baseLegal: 'Anexo I',
        areas: [area('MATEMATICA', 'Matemática'), area('REDACAO', 'Redação')],
      }));
      classificacaoGravada(RESOLUCAO, copia)(m.store);
      m.fixture.detectChanges();
      expect(TestBed.inject(LeituraDoCadastroDePesos).leitura().lido).toBe(false);
      expect(seletor(m, 0)?.value).toBe('MATEMATICA');
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      expect(seletor(m, 0)?.value).toBe('MATEMATICA');
    });

    it('o botão de acrescentar usa uma variante de botão do design system', async () => {
      const m = await montar();
      criterioPorArea(m);

      expect(botao(m, 'desemp-area-acrescentar-0').classList).toContain('btn--secondary');
    });

    it('a escolha pendente não sobrevive à troca de processo', async () => {
      const m = await montar();
      criterioPorArea(m);
      const elemento = seletor(m, 0);
      if (elemento === null) throw new Error('seletor de área ausente');
      elemento.value = 'MATEMATICA';
      elemento.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      // Outro processo, com um critério por área na mesma posição.
      m.store.reset();
      m.store.patchObjectSection('classificacao', CLASSIFICACAO_COM_QUADRO);
      m.store.patchSection('desempate', [criterio([])]);
      m.fixture.detectChanges();
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      expect(seletor(m, 0)?.value).toBe('');
    });

    it('a escolha pendente cai quando a lista de critérios chega de fora, no mesmo processo', async () => {
      const m = await montar();
      criterioPorArea(m);
      const elemento = seletor(m, 0);
      if (elemento === null) throw new Error('seletor de área ausente');
      elemento.value = 'MATEMATICA';
      elemento.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      // Uma releitura, ou a hidratação, põe outra lista no rascunho.
      m.store.patchSection('desempate', [criterio([])]);
      m.fixture.detectChanges();

      expect(seletor(m, 0)?.value).toBe('');
    });
  });
});

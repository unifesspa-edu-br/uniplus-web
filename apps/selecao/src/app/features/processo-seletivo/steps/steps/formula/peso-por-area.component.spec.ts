import { config as configDoRxjs, throwError } from 'rxjs';
import { StatusProcesso } from '@uniplus/shared-data/selecao';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { quadroCongelado } from '../../shared/quadro-de-pesos';

import { PesoPorAreaComponent } from './peso-por-area.component';
import {
  AREAS_CANONICAS,
  AREAS_DO_CADASTRO,
  AREAS_POR_CODIGO,
  BASE,
  Montagem,
  MontagemDe,
  OUTRA_RESOLUCAO,
  PESOS,
  QUADRO_CONGELADO,
  RESOLUCAO,
  ROTA_AREAS,
  ROTA_PESOS,
  ROTULOS_CANONICOS,
  SAUDE,
  SELETOR_RESOLUCAO,
  TECNOLOGICA,
  botao,
  catalogos,
  concedidas,
  encerrarMontagem,
  escolherNoSeletor,
  falharPesos,
  linha,
  marcarEnemComMediaPonderada,
  pedidosDoCadastro,
  processoGravadoCom,
  rascunhoComResolucao,
  releitura,
  resolucaoEmConsulta,
  responderAreas,
  responderPesos,
  seletor,
  texto,
  montar,
  type OpcoesDaMontagem,
} from './peso-por-area.testing';

async function montarSecao(
  opcoes: Omit<OpcoesDaMontagem, 'comoSecao'> = {},
): Promise<MontagemDe<PesoPorAreaComponent>> {
  return montar(PesoPorAreaComponent, { ...opcoes, comoSecao: true });
}

describe('PesoPorAreaComponent', () => {
  afterEach(encerrarMontagem);

  describe('quando aparece e quando o cadastro é lido', () => {
    it('com ENEM e média ponderada, revela a escolha com as resoluções do cadastro', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      const opcoes = Array.from(
        m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`) as NodeListOf<HTMLOptionElement>,
      );
      expect(opcoes.map((opcao) => texto(opcao))).toEqual([
        '— escolher —',
        OUTRA_RESOLUCAO,
        RESOLUCAO,
      ]);
    });
  });

  describe('seletor mostra a escolha do rascunho', () => {
    it('ao reabrir o processo, o seletor mostra a resolução hidratada', async () => {
      const m = await montarSecao({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);

      expect(seletor(m).value).toBe(RESOLUCAO);
    });

    it('a seção recriada com a resolução no rascunho mostra a escolha', async () => {
      const m = await montarSecao({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);

      m.store.patchObjectSection('classificacao', { baseadoEmEnem: false });
      m.fixture.detectChanges();
      m.store.patchObjectSection('classificacao', { baseadoEmEnem: true });
      m.fixture.detectChanges();

      expect(seletor(m).value).toBe(RESOLUCAO);
    });
  });

  describe('quadro', () => {
    it('antes de gravar, mostra a prévia do cadastro, com os dados que a API devolveu', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);

      const tabela = m.el.querySelector('table');
      const legenda = texto(tabela?.querySelector('caption') ?? null);
      expect(legenda).toContain(RESOLUCAO);
      expect(legenda).toContain('Prévia');
      expect(legenda).toContain('será copiado para o processo');

      const cabecalhos = Array.from(
        (tabela?.querySelectorAll('thead th') ?? []) as NodeListOf<HTMLTableCellElement>,
      ).map(texto);
      // A base legal é a mesma nos dois grupos: dita uma vez acima do quadro, e não em coluna.
      expect(cabecalhos).toEqual(['Grupo de área', 'Área de teste A', 'Área de teste B']);
      expect(texto(m.el.querySelector('.peso-area__base-legal'))).toBe(
        `Base legal: ${RESOLUCAO} – Anexo I`,
      );

      const linhas = Array.from(
        (tabela?.querySelectorAll('tbody tr') ?? []) as NodeListOf<HTMLTableRowElement>,
      );
      // Grupos pelo código, a mesma ordem da cópia que o servidor congela.
      expect(linhas.map((tr) => texto(tr.querySelector('th[scope="row"]')))).toEqual([
        'Saúde e Biológicas',
        'Tecnológica',
      ]);

      // Mesma formatação do cadastro de Peso por Área: pt-BR, sem casas fixas.
      const tecnologica = linhas[1].querySelectorAll('td');
      expect(texto(tecnologica[0])).toBe('Peso 2 corte 400');
      expect(texto(tecnologica[1])).toBe('Peso 1,5');
      expect(tecnologica).toHaveLength(2);
    });

    it('com bases legais diferentes entre os grupos, mostra a de cada um na sua linha', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m, [PESOS[0], { ...PESOS[1], baseLegal: `${RESOLUCAO} – Anexo II` }]);
      escolherNoSeletor(m, RESOLUCAO);

      const tabela = m.el.querySelector('table');
      const cabecalhos = Array.from(
        (tabela?.querySelectorAll('thead th') ?? []) as NodeListOf<HTMLTableCellElement>,
      ).map(texto);
      expect(cabecalhos.at(-1)).toBe('Base legal');
      const basesLegais = Array.from(
        (tabela?.querySelectorAll('td[data-label="Base legal"]') ??
          []) as NodeListOf<HTMLTableCellElement>,
      );
      expect(basesLegais.map(texto)).toEqual([`${RESOLUCAO} – Anexo II`, `${RESOLUCAO} – Anexo I`]);
      expect(m.el.querySelector('.peso-area__base-legal')).toBeNull();
    });

    it('não repete a palavra "resolução" antes do nome dela', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);

      expect(texto(m.el.querySelector('caption')).toLowerCase()).not.toContain(
        'resolução resolução',
      );
    });

    it('com a resolução gravada, mostra a cópia congelada no processo, e não o cadastro', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);

      const tabela = m.el.querySelector('table');
      expect(texto(tabela?.querySelector('caption') ?? null)).toContain('congelado no processo');
      const linhas = Array.from(
        (tabela?.querySelectorAll('tbody tr') ?? []) as NodeListOf<HTMLTableRowElement>,
      );
      expect(linhas).toHaveLength(1);
      expect(
        texto(
          (
            (linhas[0] as HTMLTableRowElement).querySelectorAll(
              'td',
            ) as NodeListOf<HTMLTableCellElement>
          )[0],
        ),
      ).toBe('Peso 9 corte 700');
      expect(texto(m.el.querySelector('.peso-area__base-legal'))).toBe(
        `Base legal: ${RESOLUCAO} – Anexo I (congelada)`,
      );
      // O cadastro mudou depois da cópia: o operador precisa saber o que a próxima gravação faz.
      expect(texto(m.el)).toContain('O cadastro de Peso por Área mudou depois');
    });

    it('um grupo congelado que saiu do cadastro avisa que a próxima gravação será recusada', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, [
          ...QUADRO_CONGELADO,
          {
            grupoAreaEnem: SAUDE,
            baseLegal: `${RESOLUCAO} – Anexo I`,
            areas: [{ codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 3, corte: null }],
          },
        ]),
      });
      responderPesos(m, [PESOS[0]]);

      expect(texto(m.el)).toContain('será recusada até a resolução ser completada no cadastro');
      expect(texto(m.el)).not.toContain('copia os valores atuais do cadastro');
    });

    it('cópia e cadastro iguais, em ordens diferentes, não geram aviso, e as colunas seguem a ordem do cadastro', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, [
          {
            grupoAreaEnem: TECNOLOGICA,
            baseLegal: `${RESOLUCAO} – Anexo I`,
            areas: AREAS_POR_CODIGO,
          },
        ]),
      });
      responderPesos(m, [linha(RESOLUCAO, TECNOLOGICA, AREAS_CANONICAS)]);

      expect(texto(m.el.querySelector('caption'))).toContain('congelado no processo');
      expect(texto(m.el)).not.toContain('O cadastro de Peso por Área mudou depois');
      const cabecalhos = Array.from(
        m.el.querySelectorAll('thead th') as NodeListOf<HTMLTableCellElement>,
      ).map(texto);
      expect(cabecalhos.slice(1)).toEqual(ROTULOS_CANONICOS);
    });

    it('só compara a cópia com um cadastro lido depois dela, e relê o cadastro a cada cópia nova', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);
      expect(texto(m.el)).toContain('O cadastro de Peso por Área mudou depois');

      // Outra gravação congelou outro quadro: o cadastro em mãos é anterior à cópia nova.
      const outraCopia = [{ ...QUADRO_CONGELADO[0], baseLegal: `${RESOLUCAO} – Anexo II` }];
      processoGravadoCom(RESOLUCAO, outraCopia)(m.store);
      m.fixture.detectChanges();
      expect(texto(m.el)).not.toContain('O cadastro de Peso por Área mudou depois');

      // O cadastro relido depois da cópia volta a poder dizer que ela ficou para trás.
      responderPesos(m);
      expect(texto(m.el)).toContain('O cadastro de Peso por Área mudou depois');
    });

    it('com a releitura automática do cadastro em falha, o seletor mantém as resoluções lidas antes', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);

      const outraCopia = [{ ...QUADRO_CONGELADO[0], baseLegal: `${RESOLUCAO} – Anexo II` }];
      processoGravadoCom(RESOLUCAO, outraCopia)(m.store);
      m.fixture.detectChanges();
      falharPesos(m);

      const opcoes = Array.from(
        m.el.querySelectorAll<HTMLOptionElement>(`${SELETOR_RESOLUCAO} option`),
      );
      expect(opcoes.map((opcao) => texto(opcao))).toEqual([
        '— escolher —',
        OUTRA_RESOLUCAO,
        RESOLUCAO,
      ]);
      expect(seletor(m).disabled).toBe(false);
      // A lista anterior só serve de prévia: a cópia nova não é julgada contra ela.
      expect(texto(m.el)).not.toContain('O cadastro de Peso por Área mudou depois');
    });

    it('a releitura que traz a mesma cópia não relê o cadastro nem descarta o lido', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);

      processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO)(m.store);
      m.fixture.detectChanges();

      expect(m.controller.match((r) => r.url.endsWith(ROTA_PESOS))).toHaveLength(0);
      expect(texto(m.el)).toContain('O cadastro de Peso por Área mudou depois');
    });

    it('"Reler o processo" relê o detalhe ali mesmo e, quando o aviso sai, foca o título', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);
      const gravada = m.store.classificacao.gravada();
      m.store.classificacao.marcarDesconhecida();
      m.fixture.detectChanges();
      releitura.reler.mockImplementation(async () => {
        m.store.classificacao.gravada.set(gravada);
        return true;
      });

      const reler = botao(m, 'Reler o processo');
      expect(reler?.closest('[role="status"]')).not.toBeNull();
      reler?.focus();
      reler?.click();
      await m.fixture.whenStable();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(releitura.reler).toHaveBeenCalledTimes(1);
      expect(botao(m, 'Reler o processo')).toBeUndefined();
      expect(document.activeElement?.id).toBe('peso-area-titulo');
    });

    it('"Reler o processo" superado por outra leitura não mexe no foco', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);
      const gravada = m.store.classificacao.gravada();
      m.store.classificacao.marcarDesconhecida();
      m.fixture.detectChanges();
      releitura.reler.mockImplementation(async () => {
        m.store.classificacao.gravada.set(gravada);
        return false;
      });

      const reler = botao(m, 'Reler o processo');
      reler?.focus();
      reler?.click();
      await m.fixture.whenStable();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(document.activeElement?.id).not.toBe('peso-area-titulo');
    });

    it('os avisos do quadro são regiões vivas, para o leitor de tela anunciá-los', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);

      const aviso = Array.from(
        m.el.querySelectorAll('.alert--warning') as NodeListOf<HTMLElement>,
      ).find((el) => texto(el).includes('O cadastro de Peso por Área mudou depois'));
      expect(aviso?.getAttribute('role')).toBe('status');
    });

    it('colunas na ordem canônica mesmo com grupos em ordens diferentes', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m, [
        linha(RESOLUCAO, TECNOLOGICA, [...AREAS_POR_CODIGO]),
        linha(RESOLUCAO, SAUDE, [...AREAS_CANONICAS].reverse()),
      ]);
      escolherNoSeletor(m, RESOLUCAO);

      const cabecalhos = Array.from(
        m.el.querySelectorAll('thead th') as NodeListOf<HTMLTableCellElement>,
      ).map(texto);
      expect(cabecalhos.slice(1)).toEqual(ROTULOS_CANONICOS);
    });

    it('a prévia do cadastro tem as colunas na mesma ordem da cópia congelada', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m, [linha(RESOLUCAO, TECNOLOGICA, AREAS_CANONICAS)]);
      escolherNoSeletor(m, RESOLUCAO);

      const cabecalhos = Array.from(
        m.el.querySelectorAll('thead th') as NodeListOf<HTMLTableCellElement>,
      ).map(texto);
      expect(cabecalhos.slice(1)).toEqual(ROTULOS_CANONICOS);
    });

    it('releitura falha depois de gravar: não mostra a cópia velha como congelada e avisa', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);
      m.store.classificacao.marcarDesconhecida();
      m.fixture.detectChanges();

      expect(texto(m.el.querySelector('caption'))).toContain('Prévia');
      expect(texto(m.el)).toContain('Não se sabe o que a classificação gravada tem agora');
    });

    it('a cópia que a gravação presumiu não é dada como congelada: falta confirmá-la, e o aviso oferece reler', async () => {
      const m = await montarSecao({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);
      m.store.classificacao.registrarGravadaComQuadro(RESOLUCAO, quadroCongelado(QUADRO_CONGELADO));
      m.fixture.detectChanges();

      expect(texto(m.el.querySelector('caption'))).toContain('Prévia');
      expect(texto(m.el)).not.toContain('congelado no processo');
      expect(texto(m.el)).toContain('ainda não foi confirmado por uma releitura');
      expect(botao(m, 'Reler o processo')).toBeDefined();
    });

    it('não esconde a cópia congelada quando a resolução saiu do cadastro', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m, [PESOS[2]]);

      expect(texto(m.el.querySelector('tbody tr td'))).toBe('Peso 9 corte 700');
      expect(texto(m.el)).toContain('não está no cadastro de Peso por Área lido');
    });

    it('marca a área que falta a um grupo em vez de sumir com a coluna', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m, [
        linha(RESOLUCAO, TECNOLOGICA, [
          { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 2, corte: null },
        ]),
        linha(RESOLUCAO, SAUDE, [
          { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 3, corte: null },
          { codigo: 'AREA_TESTE_B', rotulo: 'Área de teste B', peso: 1, corte: null },
        ]),
      ]);
      escolherNoSeletor(m, RESOLUCAO);

      const tecnologica = m.el.querySelectorAll('tbody tr')[1].querySelectorAll('td');
      expect(texto(tecnologica[1])).toContain('sem peso nesta resolução');
    });
  });

  describe('resolução fora do cadastro', () => {
    it('só marca "fora do cadastro" depois de o cadastro ter sido lido', async () => {
      const m = await montarSecao({ antesDeMontar: rascunhoComResolucao('Resolução revogada') });

      const enquantoCarrega = Array.from(
        m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`) as NodeListOf<HTMLOptionElement>,
      ).map(texto);
      expect(enquantoCarrega).toContain('Resolução revogada');
      expect(enquantoCarrega.join(' ')).not.toContain('fora do cadastro');

      falharPesos(m);
      const depoisDaFalha = Array.from(
        m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`) as NodeListOf<HTMLOptionElement>,
      ).map(texto);
      expect(depoisDaFalha.join(' ')).not.toContain('fora do cadastro');
    });
  });

  describe('troca de processo', () => {
    /** O que a página faz ao abrir outro processo: limpa o editor, e a leitura dele chega. */
    function abrirOutroProcesso(
      m: Montagem,
      antesDeHidratar: (store: ProcessoSeletivoStore) => void,
    ) {
      m.store.reset();
      catalogos().esquecerPesosAreaEnem();
      antesDeHidratar(m.store);
      m.fixture.detectChanges();
    }

    it('criar o processo (o id nasce) mantém a lista lida e a prévia', async () => {
      const m = await montarSecao({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);

      m.store.processoSeletivoId.set('processo-criado');
      m.fixture.detectChanges();

      expect(pedidosDoCadastro(m)).toHaveLength(0);
      const opcoes = Array.from(
        m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`) as NodeListOf<HTMLOptionElement>,
      ).map(texto);
      expect(opcoes).toContain(RESOLUCAO);
      expect(texto(m.el.querySelector('caption'))).toContain('Prévia');
    });

    it('outro processo aberto por hidratação relê o cadastro', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);

      abrirOutroProcesso(m, processoGravadoCom(OUTRA_RESOLUCAO, QUADRO_CONGELADO));

      expect(catalogos().pesosLidosNaMarca()).toBe(-1);
      responderPesos(m);
      expect(catalogos().pesosLidosNaMarca()).toBe(m.store.classificacao.versaoLida());
    });

    it('um processo só para consulta, aberto depois de outro, não herda a lista do anterior', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);
      expect(catalogos().resolucoesPesoAreaEnem()).not.toEqual([]);

      abrirOutroProcesso(
        m,
        processoGravadoCom(OUTRA_RESOLUCAO, QUADRO_CONGELADO, StatusProcesso.publicado),
      );

      expect(catalogos().resolucoesPesoAreaEnem()).toEqual([]);
      expect(catalogos().pesosLidosNaMarca()).toBe(-1);
      expect(pedidosDoCadastro(m)).toHaveLength(0);
      expect(resolucaoEmConsulta(m)).toBe(OUTRA_RESOLUCAO);
    });
  });

  describe('processo que não aceita edição', () => {
    it('não lê o cadastro, lê a resolução como texto e mostra a cópia congelada', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO, StatusProcesso.publicado),
      });
      responderAreas(m);

      expect(pedidosDoCadastro(m)).toHaveLength(0);
      expect(m.el.querySelector('select, input, button')).toBeNull();
      expect(resolucaoEmConsulta(m)).toBe(RESOLUCAO);
      expect(texto(m.el)).not.toContain('fora do cadastro');
      expect(texto(m.el.querySelector('caption'))).toContain('congelado no processo');
      expect(texto(m.el.querySelector('tbody tr td'))).toBe('Peso 9 corte 700');
    });

    it('publicado nesta sessão, deixa de avisar da próxima gravação', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);
      expect(texto(m.el)).toContain('O cadastro de Peso por Área mudou depois');

      processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO, StatusProcesso.publicado)(m.store);
      m.fixture.detectChanges();

      expect(texto(m.el)).not.toContain('O cadastro de Peso por Área mudou depois');
      expect(texto(m.el)).not.toContain('não está no cadastro de Peso por Área lido');
    });

    it('durante uma gravação, não troca a resolução nem apaga a recusa guardada', async () => {
      const m = await montarSecao({
        antesDeMontar: (store) => {
          rascunhoComResolucao(RESOLUCAO)(store);
          store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');
        },
      });
      responderPesos(m);
      m.store.salvando.set(true);
      m.fixture.detectChanges();

      escolherNoSeletor(m, OUTRA_RESOLUCAO);

      expect(m.store.draft().classificacao.resolucaoPesoAreaEnem).toBe(RESOLUCAO);
      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe('Recusa anterior.');
    });
  });

  describe('obrigatoriedade e limpeza', () => {
    it('mostra sob o campo a recusa guardada e só a tira quando a escolha muda de fato', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);
      m.store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa do servidor.');
      m.fixture.detectChanges();

      expect(texto(m.el.querySelector('#f-resolucao-peso-area-erro'))).toBe('Recusa do servidor.');

      escolherNoSeletor(m, RESOLUCAO);
      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe('Recusa do servidor.');

      escolherNoSeletor(m, OUTRA_RESOLUCAO);
      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      expect(m.el.querySelector('#f-resolucao-peso-area-erro')).toBeNull();
    });

    it('mostra sob o campo também a recusa por um critério de desempate, e a tira com a troca de resolução', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);
      m.store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa da resolução.');
      m.store.classificacao.recusaPeloDesempatePorArea.set('Recusa pelo desempate.');
      m.fixture.detectChanges();

      // As duas recusas vigentes, e não uma escondendo a outra.
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-erro'))).toBe(
        'Recusa da resolução. Recusa pelo desempate.',
      );

      escolherNoSeletor(m, OUTRA_RESOLUCAO);
      expect(m.store.classificacao.recusaPeloDesempatePorArea()).toBeNull();
    });
  });

  describe('rótulo, link e lista do cadastro', () => {
    it('liga o seletor ao próprio rótulo e à dica', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      expect(texto(m.el.querySelector('label[for="f-resolucao-peso-area"]'))).toBe(
        'Resolução de Peso por Área',
      );
      expect(seletor(m).getAttribute('aria-describedby')).toBe('f-resolucao-peso-area-dica');
    });

    it('aponta o cadastro de Peso por Área no mesmo host quando o ambiente não declara a origem', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      const link = m.el.querySelector<HTMLAnchorElement>('#f-resolucao-peso-area-dica a');
      expect(link?.getAttribute('href')).toBe('/configuracao/pesos-por-area');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener');
      expect(texto(link)).toBe('Abrir o cadastro de Peso por Área (abre em nova aba)');
    });

    it('usa a origem do app da Configuração que o ambiente declara', async () => {
      const m = await montarSecao({
        config: {
          apiUrl: BASE,
          configuracaoWebUrl: 'http://localhost:4203',
          oidc: { issuerUrl: 'http://localhost:8080/realms/unifesspa', clientId: 'selecao-web' },
        },
      });
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      expect(m.el.querySelector('#f-resolucao-peso-area-dica a')?.getAttribute('href')).toBe(
        'http://localhost:4203/pesos-por-area',
      );
    });

    it('sem a permissão de manter peso por área, não oferece o link e diz quem cadastra as resoluções', async () => {
      concedidas.set([]);
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      expect(m.el.querySelector('#f-resolucao-peso-area-dica a')).toBeNull();
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-dica'))).toContain(
        'As resoluções são cadastradas pela administração da plataforma.',
      );
    });

    it('com uma leitura em curso, "Atualizar lista" parece e age como indisponível', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      botao(m, 'Atualizar lista')?.click();
      m.fixture.detectChanges();
      responderPesos(m);
      catalogos().recarregarPesosAreaEnem(m.store.classificacao.versaoLida());
      m.fixture.detectChanges();

      const atualizar = botao(m, 'Atualizar lista');
      expect(atualizar?.getAttribute('aria-disabled')).toBe('true');
      atualizar?.click();
      m.fixture.detectChanges();

      // O clique não pediu outra leitura nem apagou o anúncio da anterior.
      expect(m.controller.match((r) => r.url.endsWith(ROTA_PESOS))).toHaveLength(1);
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-lista'))).toBe(
        'Lista de resoluções de Peso por Área atualizada.',
      );
      m.controller.match((r) => r.url.endsWith(ROTA_AREAS)).forEach((r) => r.flush([]));
    });

    it('"Atualizar lista" relê o cadastro e traz a resolução criada na outra aba', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      botao(m, 'Atualizar lista')?.click();
      m.fixture.detectChanges();
      responderPesos(m, [...PESOS, linha('Resolução criada agora', TECNOLOGICA, [])]);

      const opcoes = Array.from(
        m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`) as NodeListOf<HTMLOptionElement>,
      ).map(texto);
      expect(opcoes).toContain('Resolução criada agora');
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-lista'))).toBe(
        'Lista de resoluções de Peso por Área atualizada.',
      );
    });

    it('"Atualizar lista" tira a recusa guardada, que o servidor julga de novo na próxima gravação', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);
      m.store.classificacao.recusaDaResolucaoPesoAreaEnem.set('A resolução estava incompleta.');
      m.fixture.detectChanges();

      botao(m, 'Atualizar lista')?.click();
      m.fixture.detectChanges();
      responderPesos(m);

      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      expect(seletor(m).getAttribute('aria-invalid')).toBeNull();
    });
  });

  describe('falha do cadastro de Peso por Área', () => {
    it('mantém o alerta durante a nova tentativa; quando a lista chega, leva o foco ao seletor', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      falharPesos(m);

      const tentar = botao(m, 'Tentar novamente');
      expect(texto(m.el.querySelector('[role="alert"]'))).toContain(
        'Não foi possível carregar o cadastro de Peso por Área',
      );
      tentar?.focus();
      tentar?.click();
      m.fixture.detectChanges();

      expect(tentar?.isConnected).toBe(true);
      expect(tentar?.getAttribute('aria-disabled')).toBe('true');
      expect(texto(tentar ?? null)).toBe('Carregando…');

      responderPesos(m);
      await m.fixture.whenStable();

      expect(m.el.querySelector('[role="alert"]')).toBeNull();
      expect(document.activeElement?.id).toBe('f-resolucao-peso-area');
    });

    it('a nova tentativa que termina com o passo já desmontado não tenta focar', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      falharPesos(m);
      botao(m, 'Tentar novamente')?.click();
      m.fixture.detectChanges();
      const erroNaoTratado = vi.fn();
      const anterior = configDoRxjs.onUnhandledError;
      configDoRxjs.onUnhandledError = erroNaoTratado;

      try {
        m.fixture.destroy();
        m.controller.expectOne((r) => r.url.endsWith(ROTA_PESOS)).flush([...PESOS]);
        m.controller
          .match((r) => r.url.endsWith(ROTA_AREAS))
          .forEach((r) => r.flush([...AREAS_DO_CADASTRO]));
        await new Promise((resolve) => setTimeout(resolve));
      } finally {
        configDoRxjs.onUnhandledError = anterior;
      }

      expect(erroNaoTratado).not.toHaveBeenCalled();
    });

    it('sem edição, a nova tentativa que dá certo leva o foco ao título da seção', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      falharPesos(m);
      // Uma gravação em curso trava a edição: o seletor fica desabilitado.
      m.store.salvando.set(true);
      m.fixture.detectChanges();

      const tentar = botao(m, 'Tentar novamente');
      tentar?.focus();
      tentar?.click();
      m.fixture.detectChanges();
      responderPesos(m);
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('peso-area-titulo');
    });

    it('reanuncia a falha quando a nova tentativa também falha', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      falharPesos(m);
      const primeira = texto(m.el.querySelector('[role="alert"] p'));

      botao(m, 'Tentar novamente')?.click();
      m.fixture.detectChanges();
      falharPesos(m);
      const segunda = texto(m.el.querySelector('[role="alert"] p'));

      expect(segunda).not.toBe(primeira);
      expect(segunda).toContain('Não foi possível carregar o cadastro de Peso por Área');
    });

    it('trata o erro que escapa do envelope da API como falha, com nova tentativa', async () => {
      const m = await montarSecao({
        pesosApi: {
          listar: () => throwError(() => new Error('falha fora do envelope')),
          listarAreas: () => throwError(() => new Error('falha fora do envelope')),
        },
      });
      marcarEnemComMediaPonderada(m);

      expect(catalogos().pesosCarregando()).toBe(false);
      expect(texto(m.el.querySelector('[role="alert"]'))).toContain('Tentar novamente');
    });
  });
});

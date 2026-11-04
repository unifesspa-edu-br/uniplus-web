import { afterEach, describe, expect, it } from 'vitest';

import { quadroCongelado } from '../../shared/quadro-de-pesos';

import {
  AREAS_CANONICAS,
  AREAS_POR_CODIGO,
  OUTRA_RESOLUCAO,
  PESOS,
  QUADRO_CONGELADO,
  RESOLUCAO,
  ROTA_PESOS,
  ROTULOS_CANONICOS,
  SAUDE,
  SELETOR_RESOLUCAO,
  TECNOLOGICA,
  botao,
  montarSecao,
  encerrarMontagem,
  escolherNoSeletor,
  falharPesos,
  linha,
  marcarEnemComMediaPonderada,
  processoGravadoCom,
  rascunhoComResolucao,
  releitura,
  responderPesos,
  seletor,
  texto,
} from './peso-por-area.testing';
describe('PesoPorAreaComponent — quadro de pesos', () => {
  afterEach(encerrarMontagem);

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
});

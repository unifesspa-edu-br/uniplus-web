import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DIA_ESTADUAL,
  DIA_MUNICIPAL,
  DIA_NACIONAL_JANEIRO,
  LEITURA,
  PaginaDoDetalhe,
  calendarioCom,
  montarDetalhe,
  problema,
} from './calendario-dias-uteis.testing';

const OUTRO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b999';

describe('CalendarioDiasUteisDetalhePage — leitura', () => {
  let p: PaginaDoDetalhe;

  afterEach(() => p.http.verify());

  const botaoDoDia = (data: string): HTMLButtonElement => {
    const dia = String(Number(data.split('-')[2]));
    return p.elemento(`button.cfg-calendario-mensal__dia--feriado[aria-label^="${dia} de "]`);
  };
  const titulosDosMeses = (): (string | undefined)[] =>
    [...p.fixture.nativeElement.querySelectorAll('.cfg-calendario-mensal__titulo')].map(
      (elemento: Element) => elemento.textContent?.trim(),
    );
  const painel = (): HTMLDialogElement => p.elemento('cfg-ocorrencias-do-dia dialog');

  describe('com o calendário carregado', () => {
    beforeEach(async () => {
      p = await montarDetalhe([DIA_MUNICIPAL, DIA_ESTADUAL]);
    });

    it('não renderiza controles de formulário para o dataset', () => {
      const raiz = p.fixture.nativeElement as HTMLElement;
      expect(raiz.querySelectorAll('input')).toHaveLength(0);
      expect(raiz.querySelectorAll('select')).toHaveLength(0);
      expect(raiz.querySelectorAll('textarea')).toHaveLength(0);
    });

    it('apresenta a versão, a situação de vigência e o total no resumo', () => {
      const resumo = p.elemento('.cfg-calendario-resumo').textContent as string;

      expect(resumo).toContain('2026.1');
      expect(resumo).toContain('Não vigente');
      const total = [...p.fixture.nativeElement.querySelectorAll('.cfg-calendario-resumo__item')]
        .find((item) => item.querySelector('dt')?.textContent?.trim() === 'Dias não úteis')
        ?.querySelector('dd');
      expect(total?.textContent?.trim()).toBe('2');
    });

    it('abre o painel com o nome da data e o conteúdo do dia ao ativar o botão', async () => {
      botaoDoDia(DIA_MUNICIPAL.data).click();
      await p.propagar();

      expect(p.selecao.painelAberto()).toBe(true);
      expect(painel().getAttribute('aria-label')).toBe('5 de abril de 2026');
      expect(painel().textContent).toContain('Aniversário de Marabá');
    });

    it('apresenta o município pelo snapshot gravado, com o código IBGE como apoio, sem consultar a Geo', async () => {
      botaoDoDia(DIA_MUNICIPAL.data).click();
      await p.propagar();

      expect(painel().textContent).toContain('Marabá — PA');
      expect(painel().textContent).toContain('Código IBGE: 1504208');
      p.http.expectNone((r) => r.url.includes('/api/cidades'));
    });

    it('apresenta a abrangência estadual com a UF por extenso e sem o token técnico', async () => {
      botaoDoDia(DIA_ESTADUAL.data).click();
      await p.propagar();

      expect(painel().textContent).toContain('Pará — PA');
      expect(painel().textContent).toContain('Estadual');
      expect(painel().textContent).not.toContain('ESTADUAL');
    });

    it('fecha a prévia junto com o painel, para a devolução de foco não a reabrir', async () => {
      const botao = botaoDoDia(DIA_MUNICIPAL.data);
      botao.click();
      botao.dispatchEvent(new MouseEvent('mouseenter'));
      await p.propagar();
      expect(p.selecao.previa()).toBe(DIA_MUNICIPAL.data);

      p.elemento<HTMLButtonElement>('.uni-drawer__header button').click();
      await p.propagar();

      expect(p.selecao.previa()).toBeNull();
    });

    it('a prévia aparece com o mouse e o Esc a dispensa', async () => {
      const botao = botaoDoDia(DIA_MUNICIPAL.data);

      botao.dispatchEvent(new MouseEvent('mouseenter'));
      await p.propagar();
      expect(p.elemento('.cfg-calendario-mensal__preview').textContent).toContain(
        'Aniversário de Marabá — Municipal',
      );

      botao.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await p.propagar();
      expect(p.fixture.nativeElement.querySelector('.cfg-calendario-mensal__preview')).toBeNull();
    });

    it('o mouse que sai do botão com o foco do teclado não esconde a prévia', async () => {
      const botao = botaoDoDia(DIA_MUNICIPAL.data);
      botao.focus();
      await p.propagar();

      botao.dispatchEvent(new MouseEvent('mouseleave'));
      await p.propagar();

      expect(p.selecao.previa()).toBe(DIA_MUNICIPAL.data);
    });

    it('reseta o painel ao trocar de rota :id sem passar pela lista', async () => {
      botaoDoDia(DIA_MUNICIPAL.data).click();
      p.selecao.previa.set(DIA_MUNICIPAL.data);
      await p.propagar();
      expect(p.selecao.painelAberto()).toBe(true);

      p.parametros.next({ id: OUTRO_ID });
      await p.propagar();

      expect(p.selecao.painelAberto()).toBe(false);
      expect(p.selecao.dia()).toBeNull();
      expect(p.selecao.previa()).toBeNull();
      p.http
        .expectOne(`${LEITURA.replace(/[^/]+$/, OUTRO_ID)}`)
        .flush({ ...calendarioCom([DIA_ESTADUAL]), id: OUTRO_ID, versaoDataset: '2027.1' });
      await p.propagar();
      expect(p.selecao.painelAberto()).toBe(false);
      expect(p.fixture.nativeElement.querySelector('dialog[open]')).toBeNull();
    });
  });

  describe('a grade', () => {
    it('exibe os 12 meses do ano em ordem cronológica', async () => {
      p = await montarDetalhe([DIA_ESTADUAL]);

      expect(titulosDosMeses()).toEqual([
        'Janeiro de 2026',
        'Fevereiro de 2026',
        'Março de 2026',
        'Abril de 2026',
        'Maio de 2026',
        'Junho de 2026',
        'Julho de 2026',
        'Agosto de 2026',
        'Setembro de 2026',
        'Outubro de 2026',
        'Novembro de 2026',
        'Dezembro de 2026',
      ]);
    });

    it('preserva os 12 meses de cada ano quando o dataset atravessa a virada do ano', async () => {
      p = await montarDetalhe([DIA_ESTADUAL, DIA_NACIONAL_JANEIRO]);

      const titulos = titulosDosMeses();
      expect(titulos).toHaveLength(24);
      expect(titulos[0]).toBe('Janeiro de 2026');
      expect(titulos[11]).toBe('Dezembro de 2026');
      expect(titulos[12]).toBe('Janeiro de 2027');
      expect(titulos[23]).toBe('Dezembro de 2027');

      botaoDoDia(DIA_NACIONAL_JANEIRO.data).click();
      await p.propagar();
      expect(painel().textContent).toContain('Confraternização Universal');
    });

    it('conta as ocorrências do dataset no resumo e mantém uma célula por data', async () => {
      const outraNoMesmoDia = { ...DIA_MUNICIPAL, id: 'outro-id', abrangencia: 'INSTITUCIONAL' };
      p = await montarDetalhe([DIA_MUNICIPAL, outraNoMesmoDia, DIA_ESTADUAL]);

      expect(p.elemento('.cfg-calendario-resumo').textContent).toContain('3');
      expect(
        p.fixture.nativeElement.querySelectorAll('.cfg-calendario-mensal__dia--feriado'),
      ).toHaveLength(2);
    });

    it('lista todas as ocorrências quando há mais de um feriado na mesma data', async () => {
      const segunda = {
        ...DIA_MUNICIPAL,
        id: 'segunda-ocorrencia',
        abrangencia: 'INSTITUCIONAL',
        descricao: 'Aniversário da Unifesspa',
      };
      p = await montarDetalhe([DIA_MUNICIPAL, segunda]);

      const botao = botaoDoDia(DIA_MUNICIPAL.data);
      expect(
        botao.querySelector('.cfg-calendario-mensal__contador')?.getAttribute('data-contador'),
      ).toBe('2');
      botao.click();
      await p.propagar();

      expect(painel().querySelectorAll('.cfg-calendario-mensal__ocorrencia')).toHaveLength(2);
      expect(painel().textContent).toContain('Aniversário de Marabá');
      expect(painel().textContent).toContain('Aniversário da Unifesspa');
    });

    it('não escreve "null" quando o dia municipal é anterior ao snapshot', async () => {
      p = await montarDetalhe([{ ...DIA_MUNICIPAL, municipioNome: null, municipioUf: null }]);

      botaoDoDia(DIA_MUNICIPAL.data).click();
      await p.propagar();

      expect(painel().textContent).not.toContain('null');
      expect(painel().textContent).toContain('Código IBGE: 1504208');
    });

    it('o dia sem ocorrência é acionável, e o painel diz que não há feriados', async () => {
      p = await montarDetalhe([DIA_ESTADUAL]);

      p.botaoDoDia('16 de setembro de 2026').click();
      await p.propagar();

      expect(painel().textContent).toContain('Não há feriados cadastrados.');
    });
  });

  describe('falha de leitura', () => {
    beforeEach(async () => {
      p = await montarDetalhe([DIA_ESTADUAL]);
    });

    const falharALeitura = async (status: number, corpo: object = {}): Promise<void> => {
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne(LEITURA).flush(...problema(status, corpo));
      await p.propagar();
    };

    it('exibe o erro de carregamento e permite tentar novamente, devolvendo o foco ao título', async () => {
      await falharALeitura(404, { title: 'Calendário não encontrado' });

      expect(p.fixture.nativeElement.textContent).toContain('Calendário não encontrado');
      expect(p.fixture.nativeElement.querySelector('.cfg-calendario-resumo')).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();

      const tentar = p.elemento<HTMLButtonElement>('.list-state__retry button');
      tentar.focus();
      tentar.click();
      await p.propagar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      await p.carregar([]);
      await p.propagar();

      expect(p.fixture.nativeElement.textContent).toContain('2026.1');
      expect(document.activeElement).toBe(p.elemento('#cfg-calendario-detalhe-title'));
    });

    it('a falha do servidor na leitura avisa por toast', async () => {
      await falharALeitura(503, { code: 'uniplus.indisponivel' });

      expect(p.erros).toHaveBeenCalledTimes(1);
    });

    it('"Tentar novamente" não dispara outra leitura enquanto uma está em curso', async () => {
      await falharALeitura(500);
      const tentar = p.elemento<HTMLButtonElement>('.list-state__retry button');
      tentar.click();
      await p.propagar();
      const leitura = p.http.expectOne(LEITURA);

      tentar.click();
      await p.propagar();

      p.http.expectNone(LEITURA);
      leitura.flush(calendarioCom([]));
      await p.propagar();
    });
  });

  it('mostra o carregamento até a primeira resposta', async () => {
    p = await montarDetalhe([]);
    p.parametros.next({ id: OUTRO_ID });
    await p.propagar();

    expect(p.elemento('.list-state__loading').textContent).toContain('Carregando calendário');
    p.http.expectOne(LEITURA.replace(/[^/]+$/, OUTRO_ID)).flush(calendarioCom([]));
    await p.propagar();
  });
});

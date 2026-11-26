import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ABRANGENCIAS } from './abrangencias.testing';
import {
  DIA_ESTADUAL,
  DIA_MUNICIPAL,
  LEITURA,
  PaginaDoDetalhe,
  calendarioCom,
  montarDetalhe,
} from './calendario-dias-uteis.testing';
import { DIA_EM_PARAUAPEBAS, DIA_INSTITUCIONAL } from './recorte.testing';

const OUTRO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b999';
const INSTITUCIONAL_NO_DIA_DO_MUNICIPIO = {
  ...DIA_INSTITUCIONAL,
  id: '019f41cf-69fd-759a-ac6d-09acabc1b998',
  data: DIA_MUNICIPAL.data,
};
const DIAS = [DIA_MUNICIPAL, DIA_ESTADUAL, DIA_EM_PARAUAPEBAS, DIA_INSTITUCIONAL];

describe('CalendarioDiasUteisDetalhePage — recorte da grade', () => {
  let p: PaginaDoDetalhe;

  afterEach(() => p.http.verify());

  const campo = (id: string): HTMLSelectElement => p.elemento(`#${id}`);
  const opcoes = (id: string): (string | undefined)[] =>
    [...campo(id).querySelectorAll('option')].map((opcao) => opcao.textContent?.trim());
  const escolher = async (id: string, valor: string): Promise<void> => {
    p.escolher(campo(id), valor);
    await p.propagar();
  };
  const contagem = (): string | undefined =>
    p.elemento('.cfg-recorte__contagem').textContent?.trim();
  const aviso = (): string => p.elemento('#cfg-recorte-aviso').textContent as string;
  const dia = (data: string): HTMLButtonElement => p.elemento(`button[data-dia="${data}"]`);
  const marcados = (): string[] =>
    [...p.fixture.nativeElement.querySelectorAll('.cfg-calendario-mensal__dia--feriado')].map(
      (botao: HTMLElement) => botao.dataset['dia'] as string,
    );
  const descricaoDoCampo = (id: string): string | null =>
    campo(id).getAttribute('aria-describedby');
  const recarregar = async (dias: readonly unknown[]): Promise<void> => {
    p.store.recarregar();
    await p.propagar();
    await p.carregar(dias);
  };
  const painel = (): HTMLDialogElement => p.elemento('cfg-ocorrencias-do-dia dialog');

  beforeEach(async () => {
    p = await montarDetalhe(DIAS);
  });

  it('oferece as abrangências do dataset, sem segundo campo nem contagem antes da escolha', () => {
    expect(opcoes('cfg-recorte-abrangencia')).toEqual([
      'Todas',
      ABRANGENCIAS.ESTADUAL.rotulo,
      ABRANGENCIAS.MUNICIPAL.rotulo,
      ABRANGENCIAS.INSTITUCIONAL.rotulo,
    ]);
    expect(p.fixture.nativeElement.querySelector('#cfg-recorte-localidade')).toBeNull();
    expect(contagem()).toBe('');
    expect(marcados()).toHaveLength(DIAS.length);
  });

  it('a abrangência municipal abre o campo de município e o município restringe a grade', async () => {
    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.MUNICIPAL.codigo);
    expect(opcoes('cfg-recorte-localidade')).toEqual([
      'Todos os municípios',
      'Marabá — PA',
      'Parauapebas — PA',
    ]);
    expect(marcados()).toEqual([DIA_MUNICIPAL.data, DIA_EM_PARAUAPEBAS.data]);

    await escolher('cfg-recorte-localidade', DIA_MUNICIPAL.municipioIbge);

    expect(marcados()).toEqual([DIA_MUNICIPAL.data]);
    expect(contagem()).toBe('Mostrando 1 de 4 dias não úteis.');
    expect(aviso()).toContain('os dias ocultos continuam cadastrados e valendo');
    expect(aviso()).toContain('Em Marabá — PA também valem os dias nacionais');
    p.http.expectNone(LEITURA);
  });

  it('a abrangência estadual abre o campo de UF, e trocar de abrangência volta a localidade a todas', async () => {
    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.ESTADUAL.codigo);
    expect(p.elemento('label[for="cfg-recorte-localidade"]').textContent?.trim()).toBe(
      'Unidade Federativa (UF)',
    );
    await escolher('cfg-recorte-localidade', 'PA');
    expect(campo('cfg-recorte-localidade').value).toBe('PA');

    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.INSTITUCIONAL.codigo);
    expect(p.fixture.nativeElement.querySelector('#cfg-recorte-localidade')).toBeNull();
    expect(marcados()).toEqual([DIA_INSTITUCIONAL.data]);

    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.ESTADUAL.codigo);
    expect(campo('cfg-recorte-localidade').value).toBe('');
  });

  it('o dia oculto não passa por dia útil: tem rótulo próprio e o painel mostra a data inteira', async () => {
    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.INSTITUCIONAL.codigo);

    const oculto = dia(DIA_ESTADUAL.data);
    expect(oculto.classList).toContain('cfg-calendario-mensal__dia--oculto');
    expect(oculto.getAttribute('aria-label')).toBe(
      '15 de agosto de 2026: 1 dia não útil oculto pelo filtro',
    );

    oculto.click();
    await p.propagar();

    expect(painel().textContent).toContain(DIA_ESTADUAL.descricao);
    expect(painel().textContent).toContain('Oculto pelo filtro');
    expect(painel().textContent).toContain('está oculto na grade pelo filtro e continua valendo');
    expect(painel().textContent).not.toContain('Não há feriados cadastrados');
  });

  it('o aviso do filtro só existe, e só descreve o campo, quando há filtro ativo', async () => {
    expect(p.fixture.nativeElement.querySelector('#cfg-recorte-aviso')).toBeNull();
    expect(descricaoDoCampo('cfg-recorte-abrangencia')).toBeNull();

    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.MUNICIPAL.codigo);

    expect(aviso()).toContain('os dias ocultos continuam cadastrados e valendo');
    expect(descricaoDoCampo('cfg-recorte-abrangencia')).toBe('cfg-recorte-aviso');
    expect(descricaoDoCampo('cfg-recorte-localidade')).toBe('cfg-recorte-aviso');
  });

  it('a prévia da data com dia visível e dia oculto avisa quantos o filtro esconde', async () => {
    await recarregar([...DIAS, INSTITUCIONAL_NO_DIA_DO_MUNICIPIO]);
    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.MUNICIPAL.codigo);

    dia(DIA_MUNICIPAL.data).dispatchEvent(new FocusEvent('focus'));
    await p.propagar();

    expect(p.elemento('.cfg-calendario-mensal__preview').textContent).toContain(
      '(+1 oculto pelo filtro)',
    );
  });

  it('a localidade que sumiu na releitura volta o filtro a todos os dias', async () => {
    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.MUNICIPAL.codigo);
    await escolher('cfg-recorte-localidade', DIA_EM_PARAUAPEBAS.municipioIbge);
    expect(marcados()).toEqual([DIA_EM_PARAUAPEBAS.data]);

    await recarregar([DIA_MUNICIPAL, DIA_ESTADUAL]);

    expect(campo('cfg-recorte-abrangencia').value).toBe('');
    expect(contagem()).toBe('');
    expect(marcados()).toHaveLength(2);
  });

  it('a abrangência que sumiu na releitura volta o filtro a todos os dias', async () => {
    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.INSTITUCIONAL.codigo);

    await recarregar([DIA_MUNICIPAL, DIA_ESTADUAL]);

    expect(campo('cfg-recorte-abrangencia').value).toBe('');
    expect(contagem()).toBe('');
    expect(marcados()).toHaveLength(2);
  });

  it('o filtro ativo não sobrevive ao dataset que esvaziou: o dia cadastrado depois nasce à vista', async () => {
    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.MUNICIPAL.codigo);

    await recarregar([]);
    expect(p.fixture.nativeElement.querySelector('cfg-recorte-da-grade')).toBeNull();
    expect(p.elemento('.cfg-filtro-removido [role="status"]').textContent).toContain(
      'o filtro foi removido',
    );
    await recarregar([DIA_ESTADUAL]);

    expect(campo('cfg-recorte-abrangencia').value).toBe('');
    expect(marcados()).toEqual([DIA_ESTADUAL.data]);
  });

  it('a legenda da borda tracejada acompanha o aviso do filtro ativo', async () => {
    expect(p.fixture.nativeElement.textContent).not.toContain('borda tracejada');

    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.MUNICIPAL.codigo);

    expect(aviso()).toContain(
      'Os dias com borda tracejada na grade têm dias não úteis ocultos pelo filtro.',
    );
  });

  describe('foco quando a releitura remove a opção escolhida', () => {
    const escolherMunicipio = async (): Promise<void> => {
      await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.MUNICIPAL.codigo);
      await escolher('cfg-recorte-localidade', DIA_EM_PARAUAPEBAS.municipioIbge);
    };

    it('do campo de município que some, vai ao campo de abrangência que continua', async () => {
      await escolherMunicipio();
      campo('cfg-recorte-localidade').focus();

      await recarregar([DIA_MUNICIPAL, DIA_ESTADUAL]);

      expect(p.fixture.nativeElement.querySelector('#cfg-recorte-localidade')).toBeNull();
      expect(document.activeElement?.id).toBe('cfg-recorte-abrangencia');
    });

    it('do recorte inteiro que some com o dataset vazio, vai ao botão de fechar o aviso', async () => {
      await escolherMunicipio();
      campo('cfg-recorte-localidade').focus();

      await recarregar([]);

      expect(document.activeElement).toBe(p.elemento('.cfg-filtro-removido button'));
    });

    it('o foco fora do recorte não é movido', async () => {
      await escolherMunicipio();
      const titulo = p.elemento<HTMLElement>('#cfg-calendario-detalhe-title');
      titulo.focus();

      await recarregar([DIA_MUNICIPAL, DIA_ESTADUAL]);

      expect(document.activeElement).toBe(titulo);
    });

    it('o foco no campo de abrangência, que continua montado, não é movido', async () => {
      await escolherMunicipio();
      campo('cfg-recorte-abrangencia').focus();

      await recarregar([DIA_MUNICIPAL, DIA_ESTADUAL]);

      expect(document.activeElement?.id).toBe('cfg-recorte-abrangencia');
    });
  });

  describe('aviso de que a releitura removeu o filtro', () => {
    const MENSAGEM =
      'A opção escolhida deixou de existir e o filtro foi removido. Todos os dias estão à mostra.';
    const regiao = (): HTMLElement => p.elemento('.cfg-filtro-removido [role="status"]');
    const fechar = (): HTMLButtonElement => p.elemento('.cfg-filtro-removido button');

    beforeEach(async () => {
      const regiaoAntes = regiao();
      await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.INSTITUCIONAL.codigo);
      expect(regiaoAntes.textContent?.trim()).toBe('');
      await recarregar([DIA_MUNICIPAL, DIA_ESTADUAL]);
    });

    it('é dito na região de status que já existia, sem esconder os dias', () => {
      expect(regiao().textContent?.trim()).toBe(MENSAGEM);
      expect(marcados()).toHaveLength(2);
    });

    it('some quando a pessoa escolhe outro filtro', async () => {
      await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.MUNICIPAL.codigo);

      expect(regiao().textContent?.trim()).toBe('');
      expect(p.fixture.nativeElement.querySelector('.cfg-filtro-removido button')).toBeNull();
    });

    it('some ao fechar, e o foco vai ao título da página', async () => {
      fechar().click();
      await p.propagar();

      expect(regiao().textContent?.trim()).toBe('');
      expect(document.activeElement?.id).toBe('cfg-calendario-detalhe-title');
    });

    it('fica na página mesmo quando os campos do filtro desaparecem', async () => {
      await recarregar([]);

      expect(p.fixture.nativeElement.querySelector('cfg-recorte-da-grade')).toBeNull();
      expect(regiao().textContent?.trim()).toBe(MENSAGEM);
    });

    it('não aparece quando é a pessoa que desfaz o filtro', async () => {
      await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.MUNICIPAL.codigo);
      p.elemento<HTMLButtonElement>('.cfg-recorte__limpar').click();
      await p.propagar();

      expect(regiao().textContent?.trim()).toBe('');
    });
  });

  it('"Mostrar todos os dias" desfaz o recorte e devolve o foco ao campo de abrangência', async () => {
    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.MUNICIPAL.codigo);

    p.elemento<HTMLButtonElement>('.cfg-recorte__limpar').click();
    await p.propagar();

    expect(marcados()).toHaveLength(DIAS.length);
    expect(contagem()).toBe('');
    expect(p.fixture.nativeElement.querySelector('.cfg-recorte__limpar')).toBeNull();
    expect(document.activeElement?.id).toBe('cfg-recorte-abrangencia');
  });

  it('desfaz o recorte ao trocar de calendário pela rota', async () => {
    await escolher('cfg-recorte-abrangencia', ABRANGENCIAS.MUNICIPAL.codigo);

    p.parametros.next({ id: OUTRO_ID });
    await p.propagar();
    p.http
      .expectOne(LEITURA.replace(/[^/]+$/, OUTRO_ID))
      .flush({ ...calendarioCom(DIAS), id: OUTRO_ID });
    await p.propagar();

    expect(campo('cfg-recorte-abrangencia').value).toBe('');
    expect(marcados()).toHaveLength(DIAS.length);
  });
});

describe('CalendarioDiasUteisDetalhePage — recorte com o dataset vazio', () => {
  it('não mostra o recorte quando não há dia não útil para esconder', async () => {
    const p = await montarDetalhe([]);

    expect(p.fixture.nativeElement.querySelector('cfg-recorte-da-grade')).toBeNull();
    p.http.verify();
  });
});

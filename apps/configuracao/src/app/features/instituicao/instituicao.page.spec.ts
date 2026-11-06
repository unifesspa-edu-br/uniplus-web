import { afterEach, describe, expect, it } from 'vitest';
import { Pagina, montarPagina, problema, reitoria, unifesspa } from './instituicao.testing';
import {
  situacaoDaNovaTentativa,
  textoRepetidaDe,
  textoTentandoDe,
} from '../../shared/foco/situacao-da-nova-tentativa.testing';

describe('InstituicaoPage — leitura', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  const texto = (): string => p.fixture.nativeElement.textContent as string;
  const ficha = (): HTMLElement => p.elemento('.cfg-instituicao__ficha');

  it('mostra a ficha em sete seções, com o aviso de registro único e sem o convite ao cadastro', async () => {
    p = await montarPagina(unifesspa);

    expect(ficha().querySelectorAll('h3.form-section__title')).toHaveLength(7);
    expect(texto()).toContain('Registro único');
    expect(texto()).toContain(unifesspa.nome);
    expect(texto()).not.toContain('Nenhuma instituição cadastrada');
    expect(p.acao().textContent).toContain('Editar');
  });

  it('sem instituição cadastrada, oferece o cadastro e não mostra a ficha', async () => {
    p = await montarPagina(null);

    expect(p.fixture.nativeElement.querySelector('.cfg-instituicao__ficha')).toBeNull();
    expect(p.elemento('ui-empty-state')).toBeTruthy();
    expect(texto()).toContain('Nenhuma instituição cadastrada');
    expect(p.acao().textContent).toContain('Cadastrar instituição');
    expect(p.store.mensagemDeErro()).toBeNull();
    expect(p.fixture.nativeElement.querySelector('ui-alert[variant="danger"]')).toBeNull();
  });

  it('mostra travessão no campo opcional vazio e o nome da unidade raiz carregada', async () => {
    p = await montarPagina(unifesspa);

    expect(ficha().textContent).toContain('—');
    expect(ficha().textContent).toContain('REITORIA — Reitoria');
  });

  it('diz que a unidade raiz não foi carregada quando ela não veio na lista de reitorias', async () => {
    p = await montarPagina(unifesspa, []);

    expect(ficha().textContent).toContain('Não carregada');
  });

  it('mostra a cidade e o endereço da sede, com os campos opcionais preenchidos', async () => {
    p = await montarPagina({
      ...unifesspa,
      cnpj: '11.222.333/0001-44',
      website: 'https://unifesspa.edu.br',
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      endereco: {
        cep: '68507590',
        logradouro: 'Folha 31',
        numero: '7',
        complemento: null,
        bairro: 'Nova Marabá',
        distrito: null,
        cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
        latitude: null,
        longitude: null,
        nivelResolucao: 'logradouro',
        origem: 'geo-api',
        displayAtualizadoEm: null,
      },
    });

    expect(ficha().textContent).toContain('Marabá — PA');
    expect(ficha().textContent).toContain('Folha 31, 7, Nova Marabá');
    expect(ficha().textContent).toContain('68507590');
    expect(ficha().textContent).toContain('11.222.333/0001-44');
  });

  it('o 404 de nenhuma instituição não é falha de carga: não avisa por toast', async () => {
    p = await montarPagina(null);

    expect(p.erros).not.toHaveBeenCalled();
  });

  describe('quando a leitura falha', () => {
    it('mostra o alerta no lugar do painel, avisa por toast no 5xx e permite tentar de novo', async () => {
      p = await montarPagina();
      p.store.recarregar();
      await p.falharLeitura(503);

      expect(p.elemento('ui-alerta-nova-tentativa').textContent).toContain(
        'Não foi possível carregar a instituição',
      );
      expect(p.fixture.nativeElement.querySelector('cfg-instituicao-painel')).toBeNull();
      expect(p.erros).toHaveBeenCalledTimes(1);

      p.elemento<HTMLButtonElement>('#cfg-instituicao-tentar-novamente').click();
      await p.responderLeitura(unifesspa);
      expect(p.store.mensagemDeErro()).toBeNull();
      expect(p.elemento('cfg-instituicao-painel')).toBeTruthy();
    });

    it('a recusa 4xx da leitura aparece no alerta, sem toast', async () => {
      p = await montarPagina();
      p.store.recarregar();
      await p.falharLeitura(403);

      expect(p.elemento('ui-alerta-nova-tentativa')).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('o "Tentar novamente" fica indisponível durante a nova leitura e não a repete', async () => {
      p = await montarPagina();
      p.store.recarregar();
      await p.falharLeitura(503);
      const tentar = p.elemento<HTMLButtonElement>('#cfg-instituicao-tentar-novamente');

      tentar.click();
      await p.propagar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      tentar.click();
      await p.propagar();
      await p.responderLeitura(unifesspa);
    });
  });
});

describe('InstituicaoPage — campos do formulário', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  const marcado = (nome: string): string | null => p.campo(nome).getAttribute('aria-required');

  it('marca os cinco campos obrigatórios para a tecnologia assistiva, e os opcionais não', async () => {
    p = await montarPagina(null);
    await p.abrirFormulario();

    for (const nome of [
      'nome',
      'sigla',
      'codigoEmec',
      'organizacaoAcademica',
      'categoriaAdministrativa',
    ]) {
      expect(marcado(nome), nome).toBe('true');
    }
    for (const nome of ['cnpj', 'mantenedora', 'situacao', 'igc', 'website']) {
      expect(marcado(nome), nome).toBeNull();
    }
  });

  it('oferece as reitorias carregadas no select de unidade raiz', async () => {
    p = await montarPagina(null);
    await p.abrirFormulario();

    const opcoes = [...p.fixture.nativeElement.querySelectorAll('select option')].map((o) =>
      (o as HTMLOptionElement).textContent?.trim(),
    );
    expect(opcoes).toEqual(['(Não vinculada)', 'REITORIA — Reitoria']);
  });

  describe('quando as reitorias não vêm', () => {
    const tentar = (): HTMLButtonElement =>
      p.elemento<HTMLButtonElement>('.field__error .link-button');
    const aviso = (): string => p.elemento('#cfg-instituicao-reitorias-erro').textContent ?? '';
    const select = (): HTMLSelectElement => p.elemento('select[formcontrolname="unidadeRaizId"]');

    it('avisa, recarrega a lista a pedido e devolve o foco ao select quando dá certo', async () => {
      p = await montarPagina(null, 'falha');
      await p.abrirFormulario();

      expect(aviso()).toContain('Não foi possível carregar as unidades para seleção.');
      expect(select().getAttribute('aria-describedby')).toBe('cfg-instituicao-reitorias-erro');
      expect(p.erros).toHaveBeenCalledTimes(1);
      tentar().focus();
      tentar().click();
      await p.propagar();
      p.reitoriasRecarregadas().flush([reitoria]);
      await p.propagar();
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('.field__error .link-button')).toBeNull();
      expect(p.fixture.nativeElement.querySelectorAll('select option')).toHaveLength(2);
      expect(document.activeElement).toBe(select());
    });

    it('durante a espera o botão fica aria-disabled, sem nova leitura, e segue com o foco', async () => {
      p = await montarPagina(null, 'falha');
      await p.abrirFormulario();
      const botao = tentar();

      botao.focus();
      botao.click();
      await p.propagar();
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(botao);
      botao.click();
      await p.propagar();
      p.reitoriasRecarregadas().flush([reitoria]);
      await p.propagar();
    });

    it('a falha repetida mostra e anuncia a tentativa, avisa por toast e não tira o foco do botão', async () => {
      p = await montarPagina(null, 'falha');
      await p.abrirFormulario();

      tentar().focus();
      tentar().click();
      await p.propagar();
      expect(situacaoDaNovaTentativa(p.elemento('#cfg-instituicao-reitorias-erro'))).toBe(
        textoTentandoDe('unidades'),
      );
      p.reitoriasRecarregadas().flush(...problema(503));
      await p.propagar();
      await p.propagar();

      expect(situacaoDaNovaTentativa(p.elemento('#cfg-instituicao-reitorias-erro'))).toBe(
        textoRepetidaDe('unidades'),
      );
      expect(p.erros).toHaveBeenCalledTimes(2);
      expect(document.activeElement).toBe(tentar());
    });

    it('explica a falha na ficha, fora do drawer, em vez de só dizer que não carregou', async () => {
      p = await montarPagina(unifesspa, 'falha');

      expect(p.elemento('.cfg-instituicao__ficha').textContent).toContain(
        'Não carregada — Resposta inesperada do servidor',
      );
    });
  });
});

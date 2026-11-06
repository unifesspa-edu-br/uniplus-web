import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA_DO_CALENDARIO,
  MARABA,
  PaginaNova,
  criado,
  montarNovo,
  problema,
} from './calendario-dias-uteis.testing';

describe('CalendarioDiasUteisNovoPage', () => {
  let p: PaginaNova;

  beforeEach(async () => {
    p = await montarNovo();
  });
  afterEach(() => p.http.verify());

  it('sem dia não útil, o envio não parte e a tela explica o que falta', async () => {
    p.escrever(p.versao(), '2026.1');
    p.salvar().click();
    await p.propagar();

    p.http.expectNone(ESCRITA_DO_CALENDARIO);
    expect(p.elemento('ui-alert').textContent).toContain('Ao menos um dia não útil é obrigatório');
    expect(p.erros).not.toHaveBeenCalled();
  });

  it('mostra o estado vazio até o primeiro dia ser adicionado', async () => {
    expect(p.fixture.nativeElement.textContent).toContain('Nenhum dia adicionado');

    await p.adicionarDia();

    expect(p.fixture.nativeElement.textContent).not.toContain('Nenhum dia adicionado');
  });

  it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
    const indice = await p.adicionarDia();
    await p.preencherDia(indice, 'MUNICIPAL', '2026-04-05');

    for (const alvo of [
      p.versao(),
      p.dia(indice, 'abrangencia'),
      p.dia(indice, 'uf'),
      p.dia(indice, 'codigo-municipio'),
      p.dia(indice, 'data'),
      p.dia(indice, 'descricao'),
    ]) {
      expect(alvo.getAttribute('aria-required')).toBe('true');
    }
  });

  it('nasce estadual, no Pará, e a abrangência municipal começa sem município', async () => {
    const indice = await p.adicionarDia();

    expect((p.dia(indice, 'abrangencia') as HTMLSelectElement).value).toBe('ESTADUAL');
    expect((p.dia(indice, 'uf') as HTMLSelectElement).value).toBe('PA');

    await p.preencherDia(indice, 'MUNICIPAL', '2026-04-05');

    expect(p.fixture.nativeElement.textContent).toContain(
      'A busca usa o nome; o código IBGE é preenchido automaticamente.',
    );
    expect((p.dia(indice, 'codigo-municipio') as HTMLSelectElement).value).toBe('');
  });

  it('envia o snapshot da opção escolhida na Geo e volta à lista', async () => {
    p.escrever(p.versao(), '2026.1');
    const indice = await p.adicionarDia();
    await p.preencherDia(indice, 'MUNICIPAL', '2026-04-05');
    await p.municipioDoDia(indice);

    const post = await p.enviar();

    expect(post.request.body.diasNaoUteis[0]).toMatchObject({
      abrangencia: 'MUNICIPAL',
      municipioIbge: MARABA.codigoIbge,
      municipioNome: 'Marabá',
      municipioUf: 'PA',
      uf: null,
    });
    post.flush(...criado());
    await p.fixture.whenStable();
    expect(p.router.url).toBe('/calendario-dias-uteis');
    expect(p.sucessos).toHaveBeenCalledWith('Calendário criado');
  });

  it('envia nulo nos campos regionais que a abrangência não usa', async () => {
    p.escrever(p.versao(), '2026.1');
    const indice = await p.adicionarDia();
    await p.preencherDia(indice, 'NACIONAL', '2026-09-07');

    const post = await p.enviar();

    expect(post.request.body.diasNaoUteis[0]).toMatchObject({
      data: '2026-09-07',
      uf: null,
      municipioIbge: null,
      municipioNome: null,
      municipioUf: null,
    });
    post.flush(...problema(422, { code: 'uniplus.test.validacao' }));
    await p.propagar();
  });

  it('o dia municipal sem opção da Geo escolhida não é enviado e o campo explica', async () => {
    p.escrever(p.versao(), '2026.1');
    const indice = await p.adicionarDia();
    await p.preencherDia(indice, 'MUNICIPAL', '2026-04-05');

    p.salvar().click();
    await p.propagar();

    p.http.expectNone(ESCRITA_DO_CALENDARIO);
    expect(p.fixture.nativeElement.textContent).toContain('Selecione um município na busca.');
    expect(p.dia(indice, 'codigo-municipio').getAttribute('aria-invalid')).toBe('true');
  });

  it('a versão do dataset só de espaços não é enviada', async () => {
    p.escrever(p.versao(), '   ');
    const indice = await p.adicionarDia();
    await p.preencherDia(indice, 'NACIONAL', '2026-09-07');

    p.salvar().click();
    await p.propagar();

    p.http.expectNone(ESCRITA_DO_CALENDARIO);
    expect(p.versao().getAttribute('aria-invalid')).toBe('true');
    expect(p.fixture.nativeElement.textContent).toContain('Campo obrigatório.');
  });

  it('a descrição só de espaços não é enviada', async () => {
    p.escrever(p.versao(), '2026.1');
    const indice = await p.adicionarDia();
    await p.preencherDia(indice, 'NACIONAL', '2026-09-07');
    p.escrever(p.dia(indice, 'descricao') as HTMLTextAreaElement, '   ');

    p.salvar().click();
    await p.propagar();

    p.http.expectNone(ESCRITA_DO_CALENDARIO);
    expect(p.dia(indice, 'descricao').getAttribute('aria-invalid')).toBe('true');
  });

  it('a mesma data na mesma abrangência aparece duplicada nas duas linhas até uma ser corrigida', async () => {
    p.escrever(p.versao(), '2026.1');
    const primeira = await p.adicionarDia();
    const segunda = await p.adicionarDia();
    await p.preencherDia(primeira, 'NACIONAL', '2026-09-07');
    await p.preencherDia(segunda, 'NACIONAL', '2026-09-07');
    p.dia(primeira, 'data').dispatchEvent(new Event('blur'));
    p.dia(segunda, 'data').dispatchEvent(new Event('blur'));
    await p.propagar();

    const duplicadas = (): number =>
      (p.fixture.nativeElement.textContent as string).split('Esta data está duplicada').length - 1;
    expect(duplicadas()).toBe(2);

    p.escrever(p.dia(segunda, 'data') as HTMLInputElement, '2026-09-08');
    await p.propagar();

    expect(duplicadas()).toBe(0);
  });

  it('a mesma data em abrangências diferentes não é duplicada', async () => {
    const primeira = await p.adicionarDia();
    const segunda = await p.adicionarDia();
    await p.preencherDia(primeira, 'NACIONAL', '2026-09-07');
    await p.preencherDia(segunda, 'INSTITUCIONAL', '2026-09-07');

    expect(p.fixture.nativeElement.textContent).not.toContain('Esta data está duplicada');
    expect(p.edicao.form.controls.diasNaoUteis.errors).toBeNull();
  });

  it('gera ids únicos e nome acessível para a remoção de cada linha', async () => {
    await p.adicionarDia();
    await p.adicionarDia();

    expect(p.dia(0, 'abrangencia').id).toBe('abrangencia-0');
    expect(p.dia(1, 'abrangencia').id).toBe('abrangencia-1');
    expect(p.elemento('[aria-label="Remover dia não útil 1"]')).not.toBeNull();
    expect(p.elemento('[aria-label="Remover dia não útil 2"]')).not.toBeNull();
  });

  it('remover um dia o tira do formulário e leva o foco ao dia que ocupa o lugar', async () => {
    await p.adicionarDia();
    await p.adicionarDia();
    const remover = p.elemento<HTMLButtonElement>('[aria-label="Remover dia não útil 1"]');
    remover.focus();

    remover.click();
    await p.propagar();

    expect(p.edicao.form.controls.diasNaoUteis.length).toBe(1);
    expect(document.activeElement).toBe(p.elemento('[aria-label="Remover dia não útil 1"]'));
  });

  it('remover o último dia leva o foco ao botão de adicionar', async () => {
    await p.adicionarDia();
    const remover = p.elemento<HTMLButtonElement>('[aria-label="Remover dia não útil 1"]');
    remover.focus();

    remover.click();
    await p.propagar();

    expect(document.activeElement).toBe(p.elemento('#cfg-calendario-adicionar-dia'));
  });

  it('remover um dia descarta a busca de municípios dele', async () => {
    const indice = await p.adicionarDia();
    await p.preencherDia(indice, 'MUNICIPAL', '2026-04-05');
    const grupo = p.edicao.form.controls.diasNaoUteis.at(indice);
    expect(p.busca.buscas().has(grupo)).toBe(true);

    p.elemento<HTMLButtonElement>('[aria-label="Remover dia não útil 1"]').click();
    await p.propagar();

    expect(p.busca.buscas().has(grupo)).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recusasDoControle } from '../../shared/formulario';
import { comandoDeAtualizacao, NOME_TAMANHO_MAXIMO } from './modalidade-form';
import { LB_PPI, PaginaDaModalidade } from './modalidade-form.page.testing';
import { AC, BASE, modalidade } from './modalidades-de-teste.testing';

const URL_ADMIN = `${BASE}/api/configuracao/admin/modalidades`;
const CODIGO = 'uniplus.configuracao.modalidade';

describe('ModalidadeFormPage — nome da modalidade', () => {
  let pagina: PaginaDaModalidade;

  beforeEach(() => {
    pagina = new PaginaDaModalidade();
  });

  afterEach(() => {
    pagina.verificar();
  });

  const preencherValido = async (): Promise<void> => {
    await pagina.montar();
    pagina.setControl('codigo', 'ZZ_TESTE');
    pagina.setControl('nome', 'Modalidade de teste Alfa');
    pagina.setControl('naturezaLegal', 'AMPLA');
    pagina.edicao.aoMudarNatureza();
    pagina.setControl('composicaoVagas', 'RESTANTE_DAS_VAGAS_OFERTADAS');
    pagina.edicao.aoMudarComposicao();
  };

  const recusar = (status: number, corpo: Record<string, unknown>): void => {
    pagina.edicao.salvar();
    pagina.controller
      .expectOne(URL_ADMIN)
      .flush(JSON.stringify({ type: 'about:blank', traceId: 't', status, ...corpo }), {
        status,
        statusText: 'Recusa',
        headers: { 'content-type': 'application/problem+json' },
      });
  };

  const nome = () => pagina.edicao.form.controls.nome;

  it('exige o nome e mostra a mensagem só depois de tocado', async () => {
    await pagina.montar();
    nome().setValue('');
    expect(nome().hasError('required')).toBe(true);
    nome().markAsTouched();
    pagina.fixture.detectChanges();
    const campo = pagina.fixture.nativeElement.querySelector('#cfg-mod-nome-erro');
    expect(campo?.textContent).toContain('Campo obrigatório.');
  });

  it('acusa o nome só de espaços como obrigatório antes do envio', async () => {
    await preencherValido();
    nome().setValue('   ');
    expect(nome().hasError('required')).toBe(true);
    pagina.edicao.salvar();
    pagina.controller.expectNone(URL_ADMIN);
    pagina.fixture.detectChanges();
    const campo = pagina.fixture.nativeElement.querySelector('#cfg-mod-nome-erro');
    expect(campo?.textContent).toContain('Campo obrigatório.');
  });

  it('aceita nome com espaços nas pontas e o envia aparado', async () => {
    await preencherValido();
    nome().setValue('  Modalidade de teste Alfa  ');
    expect(nome().valid).toBe(true);
    pagina.edicao.salvar();
    const post = pagina.controller.expectOne(URL_ADMIN);
    expect(post.request.body.nome).toBe('Modalidade de teste Alfa');
    post.flush('novo-id', { status: 201, statusText: 'Created' });
  });

  it('aceita nome com o tamanho máximo e recusa um caractere a mais', async () => {
    await pagina.montar();
    nome().setValue('a'.repeat(NOME_TAMANHO_MAXIMO));
    expect(nome().valid).toBe(true);
    nome().setValue('a'.repeat(NOME_TAMANHO_MAXIMO + 1));
    expect(nome().hasError('maxlength')).toBe(true);
  });

  it('liga os rótulos de código e nome aos campos e marca o nome como obrigatório', async () => {
    await pagina.montar();
    const raiz = pagina.fixture.nativeElement as HTMLElement;
    for (const [id, texto] of [
      ['cfg-mod-codigo', 'Código'],
      ['cfg-mod-nome', 'Nome'],
    ]) {
      expect(raiz.querySelector(`label[for="${id}"]`)?.textContent?.trim()).toBe(texto);
      expect(raiz.querySelector(`#${id}`)?.getAttribute('aria-required')).toBe('true');
    }
  });

  it('descreve a descrição como opcional', async () => {
    await pagina.montar();
    const dicas = pagina.fixture.nativeElement.querySelectorAll('.field__hint');
    const textos = Array.from(dicas as NodeListOf<HTMLElement>).map((d) => d.textContent);
    expect(textos.some((t) => t?.includes('Texto opcional que detalha a modalidade'))).toBe(true);
    expect(textos.some((t) => t?.includes('Rótulo legível'))).toBe(false);
  });

  it('envia o nome na criação', async () => {
    await preencherValido();
    pagina.edicao.salvar();
    const post = pagina.controller.expectOne(URL_ADMIN);
    expect(post.request.body.nome).toBe('Modalidade de teste Alfa');
    post.flush('novo-id', { status: 201, statusText: 'Created' });
  });

  it.each([
    [422, 'nome_obrigatorio', 'Nome da modalidade é obrigatório'],
    [422, 'nome_tamanho', 'Tamanho do nome da modalidade inválido'],
    [409, 'nome_ja_existe', 'Já existe uma modalidade ativa com este nome'],
  ])('liga ao campo nome a recusa %i %s do servidor', async (status, razao, titulo) => {
    await preencherValido();
    recusar(status, { title: 'Título do servidor', code: `${CODIGO}.${razao}` });
    await pagina.atualizar();
    expect(recusasDoControle(nome()).map((r) => r.mensagem)).toEqual([titulo]);
    const erro = pagina.fixture.nativeElement.querySelector('#cfg-mod-nome-erro');
    expect(erro?.textContent).toContain(titulo);
    expect(pagina.edicao.erro()).toBeNull();
  });

  it('liga ao campo nome o link da página da recusa de campo e da recusa pelo código', async () => {
    const paginas = 'https://developers.example.test/erros/';
    await preencherValido();
    recusar(422, {
      type: `${paginas}uniplus.validacao`,
      title: 'Dados inválidos',
      code: 'uniplus.validacao',
      errors: [{ field: 'Nome', code: `${CODIGO}.nome_tamanho`, message: 'texto do servidor' }],
    });
    await pagina.atualizar();
    const link = pagina.fixture.nativeElement.querySelector('#cfg-mod-nome-erro a');
    expect(link?.getAttribute('href')).toBe(`${paginas}${CODIGO}.nome_tamanho`);
    expect(recusasDoControle(nome())[0]?.pagina).toBe(`${paginas}${CODIGO}.nome_tamanho`);
  });

  it('liga ao campo nome o link da página da recusa de código do problema', async () => {
    const codigo = `${CODIGO}.nome_ja_existe`;
    await preencherValido();
    recusar(409, {
      type: `https://developers.example.test/erros/${codigo}`,
      title: 'x',
      code: codigo,
    });
    await pagina.atualizar();
    const link = pagina.fixture.nativeElement.querySelector('#cfg-mod-nome-erro a');
    expect(link?.getAttribute('href')).toBe(`https://developers.example.test/erros/${codigo}`);
  });

  it('acumula no campo nome as recusas de campo de códigos diferentes', async () => {
    await preencherValido();
    recusar(422, {
      title: 'Dados inválidos',
      code: 'uniplus.validacao',
      errors: [
        { field: 'Nome', code: `${CODIGO}.nome_tamanho`, message: 'texto do servidor' },
        { field: 'Nome', code: `${CODIGO}.nome_ja_existe`, message: 'texto do servidor' },
      ],
    });
    await pagina.atualizar();
    expect(recusasDoControle(nome()).map((r) => r.mensagem)).toEqual([
      'Tamanho do nome da modalidade inválido',
      'Já existe uma modalidade ativa com este nome',
    ]);
  });

  it('descarta a recusa do nome ao reenviar com outro nome', async () => {
    await preencherValido();
    recusar(409, { title: 'x', code: `${CODIGO}.nome_ja_existe` });
    await pagina.atualizar();
    nome().setValue('Outro nome de teste');
    pagina.edicao.salvar();
    const post = pagina.controller.expectOne(URL_ADMIN);
    expect(recusasDoControle(nome())).toEqual([]);
    post.flush('novo-id', { status: 201, statusText: 'Created' });
  });

  it('na edição preenche o nome, mantém o código imutável e não o envia', async () => {
    await pagina.editar(LB_PPI);
    expect(nome().value).toBe('Cota de teste Beta');
    expect(pagina.edicao.form.controls.codigo.disabled).toBe(true);
    const valores = pagina.edicao.form.getRawValue();
    const comando = comandoDeAtualizacao(LB_PPI.id, { ...valores, nome: ' Novo nome ' }, []);
    expect(comando.nome).toBe('Novo nome');
    expect('codigo' in comando).toBe(false);
  });

  it('oferece as modalidades de referência como código — nome, ou só o código sem nome', async () => {
    await pagina.montar([AC, modalidade({ id: 'id-sem-nome', codigo: 'SEM_NOME', nome: '' })]);
    expect(pagina.edicao.opcoesReferencia().map((o) => o.label)).toEqual([
      'AC — Modalidade de teste Alfa',
      'SEM_NOME',
    ]);
  });

  it('o resumo de remanejamento nomeia o destino por código — nome', async () => {
    await pagina.montar([AC]);
    pagina.setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    pagina.edicao.aoMudarNatureza();
    pagina.setControl('regraRemanejamento', 'DESTINO_UNICO');
    pagina.edicao.aoMudarRegra();
    pagina.setControl('remanejamentoDestino', 'AC');
    expect(pagina.edicao.resumo()[1]).toBe(
      'Vagas ociosas remanejam para AC — Modalidade de teste Alfa.',
    );
  });

  it('o resumo da retirada de vagas nomeia a origem', async () => {
    await pagina.montar([AC]);
    pagina.setControl('composicaoVagas', 'RETIRADA_DE_OUTRA_MODALIDADE');
    pagina.edicao.aoMudarComposicao();
    pagina.setControl('composicaoOrigem', 'AC');
    expect(pagina.edicao.resumo()[0]).toBe(
      'As vagas são retiradas da modalidade AC — Modalidade de teste Alfa.',
    );
  });
});

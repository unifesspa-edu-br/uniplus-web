import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PaginaDosModelos } from './modelos-formulario.escritas.testing';

describe('ModelosFormularioPage — sugestão de código', () => {
  const pagina = new PaginaDosModelos();

  beforeEach(async () => {
    await pagina.montar();
    await pagina.carregar();
    pagina.edicao.abrirCriacao();
  });
  afterEach(() => pagina.desmontar());

  it('preenche e atualiza o código a partir do nome', () => {
    const { nome, codigo } = pagina.edicao.form.controls;
    nome.setValue('Inscrição');
    expect(codigo.value).toBe('INSCRICAO');
    nome.setValue('Inscrição complementar');
    expect(codigo.value).toBe('INSCRICAO_COMPLEMENTAR');
  });

  it('preserva o código digitado quando o nome muda', () => {
    const { nome, codigo } = pagina.edicao.form.controls;
    nome.setValue('Inscrição');
    codigo.setValue('CODIGO_ESCOLHIDO');
    nome.setValue('Inscrição complementar');
    expect(codigo.value).toBe('CODIGO_ESCOLHIDO');
  });

  it('limpa o formulário e esquece a sugestão anterior ao reabrir', () => {
    const { nome, codigo } = pagina.edicao.form.controls;
    nome.setValue('Inscrição');
    pagina.edicao.abrirCriacao();
    expect(nome.value).toBe('');
    expect(codigo.value).toBe('');
    codigo.setValue('INSCRICAO');
    nome.setValue('Inscrição complementar');
    expect(codigo.value).toBe('INSCRICAO');
  });

  it('avisa quando o código sugerido passa do limite de 60 caracteres', () => {
    const { nome, codigo } = pagina.edicao.form.controls;
    nome.setValue('a'.repeat(61));
    expect(codigo.value).toBe('');
    expect(pagina.edicao.ligacaoDoCodigo.avisoDoNome()).toContain('60 caracteres');
  });
});

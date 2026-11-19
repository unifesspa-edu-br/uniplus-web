import { beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  GRUPOS_DO_CATALOGO,
  abrir,
  salvarPeloBotao,
  reiniciarDuplas,
  abrirOFormulario,
} from './perfis.page.testing';

describe('PerfisPage: formulário do perfil novo', () => {
  beforeEach(reiniciarDuplas);

  it('agrupa as permissões do catálogo por módulo e resource', async () => {
    const aberta = await abrir();
    const { host } = aberta;

    await abrirOFormulario(aberta);

    const legendas = host.querySelectorAll('fieldset.field fieldset.field legend');
    expect([...legendas].map((l) => l.textContent?.trim())).toEqual(GRUPOS_DO_CATALOGO);
  });

  it.each([
    ['selecao:documentos-identificadores:consultar', 'Dado identificador'],
    ['selecao:documentos-internos:consultar', 'Interna'],
    ['selecao:documentos-publicos:consultar', 'Pública'],
  ])('mostra a sensibilidade de %s', async (codigo, sensibilidade) => {
    const aberta = await abrir();
    const { host } = aberta;

    await abrirOFormulario(aberta);

    const rotulos = [...host.querySelectorAll('label.checkbox')];
    const rotulo = rotulos.find((l) => l.querySelector('code')?.textContent?.includes(codigo));
    expect(rotulo?.textContent).toContain(sensibilidade);
  });

  it('diz que a permissão de dado pessoal ou sensível passa pelo Representante do controlador', async () => {
    const aberta = await abrir();

    await abrirOFormulario(aberta);

    const ajudas = [...aberta.host.querySelectorAll('.field__hint')].map((a) =>
      a.textContent?.replace(/\s+/g, ' '),
    );
    expect(ajudas).toContainEqual(
      expect.stringContaining('exige a aprovação do Representante do controlador na versão'),
    );
  });

  it('marca o nome como obrigatório no formulário do perfil novo', async () => {
    const aberta = await abrir();
    const { host } = aberta;

    await abrirOFormulario(aberta);

    const nome = host.querySelector('[formcontrolname="nome"]');
    expect(nome?.getAttribute('aria-required')).toBe('true');
  });

  it('pede o protocolo e o PDF do documento instituidor no perfil novo', async () => {
    const aberta = await abrir();
    const { host } = aberta;

    await abrirOFormulario(aberta);

    expect(host.querySelector('[formcontrolname="protocolo"]')).not.toBeNull();
    expect(host.querySelector('ui-file-upload')).not.toBeNull();
  });

  it('o envio barrado localmente leva o foco ao primeiro campo inválido', async () => {
    const aberta = await abrir();
    const { host } = aberta;
    await abrirOFormulario(aberta);
    await salvarPeloBotao(aberta);

    expect(document.activeElement).toBe(host.querySelector('input[formControlName="nome"]'));
    expect(api.criar).not.toHaveBeenCalled();
  });
});

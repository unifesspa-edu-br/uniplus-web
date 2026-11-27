import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FileUploadComponent } from './file-upload';
import { item, montarModoControlado, pdf } from './file-upload.modo-controlado.setup';

describe('FileUploadComponent no modo controlado', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FileUploadComponent] });
  });

  it('entrega vários arquivos aprovados de uma só vez', () => {
    const { escolhidos, escolher } = montarModoControlado();

    escolher(pdf('a.pdf'), pdf('b.pdf'));

    expect(escolhidos).toHaveLength(1);
    expect(escolhidos[0].map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('recusa só o arquivo inválido e aponta qual foi', () => {
    const { host, escolhidos, escolher } = montarModoControlado();

    escolher(
      pdf('a.pdf'),
      new File(['x'], 'foto.gif', { type: 'image/gif' }),
      pdf('grande.pdf', 11 * 1024 * 1024),
    );

    expect(escolhidos[0].map((f) => f.name)).toEqual(['a.pdf']);
    const alertas = Array.from(host.querySelectorAll('[role="alert"]')).map((a) => a.textContent);
    expect(alertas[0]).toContain('foto.gif: Tipo de arquivo não permitido');
    expect(alertas[1]).toContain('grande.pdf: Arquivo excede o tamanho máximo de 10MB.');
  });

  it('recusa arquivo vazio antes do envio', () => {
    const { host, escolhidos, escolher } = montarModoControlado();

    escolher(new File([], 'vazio.pdf', { type: 'application/pdf' }));

    expect(escolhidos).toHaveLength(0);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'vazio.pdf: O arquivo está vazio.',
    );
  });

  it('respeita o limite de arquivos contando os que já estão na lista', () => {
    const { host, escolhidos, escolher } = montarModoControlado({
      maxFiles: 2,
      itens: [item({ fase: 'confirmado', progresso: 100 })],
    });

    escolher(pdf('a.pdf'), pdf('b.pdf'));

    expect(escolhidos[0].map((f) => f.name)).toEqual(['a.pdf']);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'b.pdf: o limite de 2 arquivos foi atingido.',
    );
  });

  it('com validarSoPelaExtensao, a extensão decide e qualquer tipo MIME passa', () => {
    const generico = new File(['x'], 'modelo.pdf', { type: 'application/octet-stream' });
    const vazio = new File(['x'], 'modelo.pdf', { type: '' });
    const intruso = new File(['x'], 'modelo.gif', { type: 'application/octet-stream' });
    const estrito = montarModoControlado();
    estrito.escolher(generico);
    expect(estrito.escolhidos).toHaveLength(0);

    const flexivel = montarModoControlado({ validarSoPelaExtensao: true });
    flexivel.escolher(generico, vazio, intruso);
    expect(flexivel.escolhidos[0].map((f) => f.name)).toEqual(['modelo.pdf', 'modelo.pdf']);
  });

  it('em modo de um arquivo, avisa que só um é aceito em vez de descartar os extras', () => {
    const { host, escolhidos, escolher } = montarModoControlado({ multiple: false });

    escolher(pdf('a.pdf'), pdf('b.pdf'));

    expect(escolhidos).toHaveLength(0);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Envie um arquivo por vez.',
    );
  });

  it('limpa as recusas antigas ao retirar um arquivo', () => {
    const { host, fixture, escolher } = montarModoControlado({ itens: [item()] });
    escolher(new File(['x'], 'foto.gif', { type: 'image/gif' }));
    expect(host.querySelector('[role="alert"]')).not.toBeNull();

    host.querySelector<HTMLButtonElement>('button[aria-label="Remover edital.pdf"]')?.click();
    fixture.detectChanges();

    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('limpa as recusas antigas ao tentar de novo', () => {
    const { host, fixture, escolher } = montarModoControlado({
      itens: [item({ fase: 'erro', mensagem: 'Falhou.' })],
    });
    escolher(new File(['x'], 'foto.gif', { type: 'image/gif' }));
    expect(host.querySelector('[role="alert"]')).not.toBeNull();

    host
      .querySelector<HTMLButtonElement>('button[aria-label="Tentar enviar novamente edital.pdf"]')
      ?.click();
    fixture.detectChanges();

    expect(host.querySelector('.uni-uploader > [role="alert"]')).toBeNull();
  });

  it('na falha anuncia só o alerta, sem região de status', () => {
    const { host } = montarModoControlado({ itens: [item({ fase: 'erro', mensagem: 'Falhou.' })] });

    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.querySelector('li [role="alert"]')?.textContent).toContain('edital.pdf: Falhou.');
  });

  it('engole o drop no contêiner mesmo com a zona desabilitada', () => {
    const { host, fixture } = montarModoControlado({ disabled: true });
    const evento = new Event('drop', { cancelable: true, bubbles: true });

    host.querySelector('.uni-uploader')?.dispatchEvent(evento);
    fixture.detectChanges();

    expect(evento.defaultPrevented).toBe(true);
  });

  it('nomeia a zona pelo rótulo do campo seguido do texto visível', () => {
    const { host } = montarModoControlado({ fieldLabel: 'Enviar o modelo' });

    const zona = host.querySelector('.uni-uploader__drop') as HTMLElement;
    const ids = zona.getAttribute('aria-labelledby')?.split(' ') ?? [];
    const nome = ids.map((id) => host.querySelector(`[id="${id}"]`)?.textContent?.trim()).join(' ');
    expect(zona.hasAttribute('aria-label')).toBe(false);
    expect(nome).toContain('Enviar o modelo');
    expect(nome).toContain('Arraste arquivos aqui ou selecione do computador');
  });

  it('não aceita arquivo escolhido com o componente desabilitado', () => {
    const { escolhidos, escolher } = montarModoControlado({ disabled: true });

    escolher(pdf('a.pdf'));

    expect(escolhidos).toHaveLength(0);
  });
});

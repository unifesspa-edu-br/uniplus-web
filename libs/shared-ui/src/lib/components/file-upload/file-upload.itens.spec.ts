import { Component, signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FileUploadComponent, type ArquivoEmEnvio } from './file-upload';
import { item, montarModoControlado, pdf } from './file-upload.modo-controlado.setup';

describe('FileUploadComponent com a lista de itens', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FileUploadComponent] });
  });

  describe('ação Baixar', () => {
    const verificado = [item({ id: 'v1', nome: 'Arquivo 1', fase: 'confirmado', progresso: 100 })];

    it('fica desligada por padrão: a lista do administrador não ganha o botão', () => {
      const { fixture, host } = montarModoControlado();
      fixture.componentRef.setInput('itens', verificado);
      fixture.detectChanges();

      expect(host.querySelector('button[aria-label^="Baixar"]')).toBeNull();
    });

    it('ligada, oferece Baixar só no arquivo confirmado e emite o id', () => {
      const { fixture, host, baixados } = montarModoControlado();
      fixture.componentRef.setInput('permitirBaixar', true);
      fixture.componentRef.setInput('itens', [...verificado, item({ id: 'e1', fase: 'enviando' })]);
      fixture.detectChanges();

      const botoes = host.querySelectorAll('button[aria-label^="Baixar"]');
      expect(botoes).toHaveLength(1);
      (botoes[0] as HTMLButtonElement).click();
      expect(baixados).toEqual(['v1']);
    });
  });

  it('mostra a fase e o progresso de cada arquivo com nome acessível', () => {
    const { host } = montarModoControlado({
      itens: [
        item(),
        item({ id: 'a2', nome: 'ata.pdf', fase: 'confirmando', progresso: 100 }),
        item({
          id: 'a3',
          nome: 'ok.pdf',
          fase: 'confirmado',
          progresso: 100,
          tamanhoBytes: 2.5 * 1024 * 1024,
        }),
      ],
    });

    const barras = Array.from(host.querySelectorAll('[role="progressbar"]'));
    expect(barras.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Progresso do envio de edital.pdf',
      'Progresso do envio de ata.pdf',
      'Progresso do envio de ok.pdf',
    ]);
    expect(barras[0].getAttribute('aria-valuenow')).toBe('40');
    expect(barras[0].getAttribute('aria-valuetext')).toBe('Enviando: 40%');
    expect(barras[1].getAttribute('aria-valuetext')).toBe('Validando o arquivo');
    expect(host.textContent).toContain('2,5 MB');
    expect(host.querySelectorAll('.uni-uploader__item.is-success')).toHaveLength(1);
  });

  it('mostra o tamanho em pt-BR, com vírgula em KB e MB', () => {
    const { host } = montarModoControlado({
      itens: [
        item({ id: 'k', nome: 'k.pdf', tamanhoBytes: 512 * 1024 }),
        item({ id: 'm', nome: 'm.pdf', tamanhoBytes: 1.25 * 1024 * 1024 }),
      ],
    });

    const metas = Array.from(host.querySelectorAll('.uni-uploader__item-meta')).map(
      (m) => m.textContent,
    );
    expect(metas).toContain('512,0 KB');
    expect(metas).toContain('1,3 MB');
  });

  it('dá id a cada mensagem, lista todas no aria-describedby e marca só o input como inválido', () => {
    const { host, escolher } = montarModoControlado({
      mensagemExterna: 'Antes, conclua o cadastro.',
    });
    escolher(
      new File(['x'], 'a.gif', { type: 'image/gif' }),
      new File(['x'], 'b.gif', { type: 'image/gif' }),
    );

    const alertas = Array.from(host.querySelectorAll('[role="alert"]'));
    const ids = alertas.map((a) => a.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    const zona = host.querySelector('.uni-uploader__drop');
    expect(zona?.getAttribute('aria-describedby')?.split(' ')).toEqual(ids);
    expect(zona?.hasAttribute('aria-invalid')).toBe(false);
    expect(host.querySelector('input[type="file"]')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('no modo simples não habilita seleção múltipla nem usa o plural', () => {
    const { host } = montarModoControlado({ multiple: true, itens: null });

    expect(host.querySelector<HTMLInputElement>('input[type="file"]')?.multiple).toBe(false);
    expect(host.textContent).toContain('Arraste um arquivo aqui');
  });

  it('anuncia o envio em passos para não interromper o leitor de tela', () => {
    const { host } = montarModoControlado({ itens: [item({ progresso: 49 })] });

    expect(host.querySelector('[role="status"]')?.textContent).toBe('edital.pdf: enviando, 25%');
  });

  it('na falha mostra a mensagem e emite a nova tentativa', () => {
    const { host, repetidos, fixture } = montarModoControlado({
      itens: [item({ fase: 'erro', mensagem: 'Falha ao enviar o arquivo.' })],
    });

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Falha ao enviar o arquivo.',
    );
    const botao = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Tentar enviar novamente edital.pdf"]',
    );
    botao?.click();
    fixture.detectChanges();

    expect(repetidos).toEqual(['a1']);
  });

  it('oculta a nova tentativa quando repetir não adianta e a remoção quando o arquivo é definitivo', () => {
    const { host } = montarModoControlado({
      itens: [
        item({ fase: 'erro', mensagem: 'Recusado.', podeTentarDeNovo: false, podeRetirar: false }),
      ],
    });

    expect(host.textContent).not.toContain('Tentar novamente');
    expect(host.querySelector('button[aria-label^="Remover"]')).toBeNull();
  });

  it('emite a retirada do arquivo e devolve o foco à zona de soltar', () => {
    const { host, retirados, fixture } = montarModoControlado({ itens: [item()] });

    host.querySelector<HTMLButtonElement>('button[aria-label="Remover edital.pdf"]')?.click();
    fixture.detectChanges();

    expect(retirados).toEqual(['a1']);
    expect(document.activeElement).toBe(host.querySelector('.uni-uploader__drop'));
  });

  it('mantém ações de arquivo e nome do campo mesmo com a zona desabilitada', () => {
    const { host } = montarModoControlado({
      disabled: true,
      idDoCampo: 'campo-fixo',
      itens: [item({ fase: 'erro', mensagem: 'Falhou.' })],
    });

    expect(host.querySelector('input[type="file"]')?.id).toBe('campo-fixo');
    expect(host.querySelector<HTMLButtonElement>('button[aria-label^="Tentar"]')?.disabled).toBe(
      false,
    );
  });

  it('liga ao campo as descrições externas e a mensagem do consumidor', () => {
    const { host } = montarModoControlado({
      descritoPor: 'aviso-1',
      mensagemExterna: 'Antes, conclua o cadastro.',
    });

    const zona = host.querySelector('.uni-uploader__drop');
    expect(zona?.getAttribute('aria-describedby')).toMatch(/^aviso-1 ui-file-upload-\d+-error$/);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Antes, conclua o cadastro.',
    );
  });

  it('aplica o limite de arquivos também no modo de um arquivo', () => {
    const { host, escolhidos, escolher } = montarModoControlado({
      multiple: false,
      maxFiles: 1,
      itens: [item()],
    });

    escolher(pdf('a.pdf'));

    expect(escolhidos).toHaveLength(0);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'a.pdf: o limite de 1 arquivo foi atingido.',
    );
  });

  it('trata o arquivo solto fora da zona, na lista ou nas mensagens', () => {
    const { host, fixture, escolhidos } = montarModoControlado({ itens: [item()] });
    const evento = new Event('drop', { cancelable: true, bubbles: true }) as DragEvent;
    Object.defineProperty(evento, 'dataTransfer', { value: { files: [pdf('solto.pdf')] } });

    host.querySelector('.uni-uploader__list')?.dispatchEvent(evento);
    fixture.detectChanges();

    expect(escolhidos[0].map((f) => f.name)).toEqual(['solto.pdf']);
  });

  it('não processa duas vezes o drop recebido pela zona', () => {
    const { host, escolhidos } = montarModoControlado();
    const evento = new Event('drop', { cancelable: true, bubbles: true }) as DragEvent;
    Object.defineProperty(evento, 'dataTransfer', { value: { files: [pdf('a.pdf')] } });

    host.querySelector('.uni-uploader__drop')?.dispatchEvent(evento);

    expect(escolhidos).toHaveLength(1);
  });

  it('identifica a lista e as ações pelo contexto informado pelo consumidor', () => {
    const { host } = montarModoControlado({
      fieldLabel: 'Enviar o modelo',
      nomeDaLista: 'Modelo de RG',
      itens: [item({ fase: 'erro', mensagem: 'Falhou.' })],
    });

    expect(host.querySelector('ul')?.getAttribute('aria-label')).toBe('Arquivos: Modelo de RG');
    expect(
      host.querySelector('button[aria-label="Remover edital.pdf — Modelo de RG"]'),
    ).not.toBeNull();
    expect(
      host.querySelector('button[aria-label="Tentar enviar novamente edital.pdf — Modelo de RG"]'),
    ).not.toBeNull();
  });

  it('marca o input como inválido quando um arquivo está em erro', () => {
    const { host } = montarModoControlado({ itens: [item({ fase: 'erro', mensagem: 'Falhou.' })] });

    expect(host.querySelector('input[type="file"]')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('devolve o foco à zona depois de pedir nova tentativa', () => {
    const { host, fixture } = montarModoControlado({
      itens: [item({ fase: 'erro', mensagem: 'Falhou.' })],
    });

    host.querySelector<HTMLButtonElement>('button[aria-label^="Tentar enviar"]')?.click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(host.querySelector('.uni-uploader__drop'));
  });

  it('com a zona desabilitada, o foco da nova tentativa vai para a lista', () => {
    const { host, fixture } = montarModoControlado({
      disabled: true,
      itens: [item({ fase: 'erro', mensagem: 'Falhou.' })],
    });

    host.querySelector<HTMLButtonElement>('button[aria-label^="Tentar enviar"]')?.click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(host.querySelector('ul'));
  });

  it('com a zona desabilitada, o arrastar sobre o contêiner não sugere soltar', () => {
    const { host } = montarModoControlado({ disabled: true });
    const dataTransfer = { dropEffect: 'copy' };
    const evento = new Event('dragover', { cancelable: true, bubbles: true });
    Object.defineProperty(evento, 'dataTransfer', { value: dataTransfer });

    host.querySelector('.uni-uploader')?.dispatchEvent(evento);

    expect(dataTransfer.dropEffect).toBe('none');
  });
});

describe('FileUploadComponent com host que reage aos eventos', () => {
  @Component({
    imports: [FileUploadComponent],
    template: `<ui-file-upload
      [itens]="itens"
      [disabled]="travado()"
      (tentarDeNovo)="travado.set(true)"
    />`,
  })
  class HostComponent {
    readonly travado = signal(false);
    readonly itens: readonly ArquivoEmEnvio[] = [
      { id: 'a1', nome: 'edital.pdf', fase: 'erro', progresso: 40, mensagem: 'Falhou.' },
    ];
  }

  it('manda o foco para a lista quando o host desabilita a zona em resposta à nova tentativa', async () => {
    const fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(
      HostComponent,
    );
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    host.querySelector<HTMLButtonElement>('button[aria-label^="Tentar enviar"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.querySelector<HTMLButtonElement>('.uni-uploader__drop')?.disabled).toBe(true);
    expect(document.activeElement).toBe(host.querySelector('ul'));
    fixture.nativeElement.remove();
  });
});

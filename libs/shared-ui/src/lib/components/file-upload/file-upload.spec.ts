import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FileUploadComponent, type ArquivoEmEnvio } from './file-upload';

describe('FileUploadComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FileUploadComponent] });
  });

  function setup() {
    const fixture: ComponentFixture<FileUploadComponent> =
      TestBed.createComponent(FileUploadComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const dropZone = () => fixture.debugElement.query(By.css('.uni-uploader__drop'));
    const hiddenInput = () => fixture.debugElement.query(By.css('input[type="file"]'));
    const errorMessage = () => fixture.debugElement.query(By.css('[role="alert"]'));
    const removeButton = () => fixture.debugElement.query(By.css('button[aria-label="Remover arquivo"]'));

    return { fixture, component, dropZone, hiddenInput, errorMessage, removeButton };
  }

  function makeFile(options: { name: string; type: string; sizeBytes: number }): File {
    return new File([new ArrayBuffer(options.sizeBytes)], options.name, { type: options.type });
  }

  function setInputFiles(input: HTMLInputElement, files: File[]): void {
    Object.defineProperty(input, 'files', {
      configurable: true,
      get: () => Object.assign(files, { item: (i: number) => files[i] ?? null }),
    });
  }

  function pickFile(fixture: ComponentFixture<FileUploadComponent>, file: File): void {
    const input = fixture.debugElement.query(By.css('input[type="file"]')).nativeElement as HTMLInputElement;
    setInputFiles(input, [file]);
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function dropFile(fixture: ComponentFixture<FileUploadComponent>, file: File | null): void {
    const dropZone = fixture.debugElement.query(By.css('.uni-uploader__drop'));
    const dataTransfer = file ? { files: [file] } : { files: [] };
    dropZone.triggerEventHandler('drop', { preventDefault: () => undefined, dataTransfer });
    fixture.detectChanges();
  }

  const VALID_PDF = () => makeFile({ name: 'documento.pdf', type: 'application/pdf', sizeBytes: 1024 });
  const OVERSIZED_PDF = () =>
    makeFile({ name: 'grande.pdf', type: 'application/pdf', sizeBytes: 10 * 1024 * 1024 + 1 });
  const GIF_FILE = () => makeFile({ name: 'foto.gif', type: 'image/gif', sizeBytes: 1024 });
  const PNG_WITH_GIF_EXTENSION = () =>
    makeFile({ name: 'foto.gif', type: 'image/png', sizeBytes: 1024 });
  const UPPERCASE_PDF = () => makeFile({ name: 'RELATORIO.PDF', type: 'application/pdf', sizeBytes: 1024 });
  const NO_EXTENSION = () => makeFile({ name: 'arquivo', type: 'application/pdf', sizeBytes: 1024 });
  const MIME_SPOOFED = () => makeFile({ name: 'malicioso.pdf', type: 'text/html', sizeBytes: 1024 });

  it('inicializa com estado vazio', () => {
    const { component } = setup();
    expect(component.selectedFile()).toBeNull();
    expect(component.errors()).toEqual([]);
    expect(component.isDragging()).toBe(false);
  });

  it('aceita um arquivo válido via input[type=file]', () => {
    const { fixture, component } = setup();
    const file = VALID_PDF();

    pickFile(fixture, file);

    expect(component.selectedFile()).toBe(file);
    expect(component.errors()).toEqual([]);
  });

  it('limpa o valor do input após cada seleção para permitir re-selecionar o mesmo arquivo', () => {
    const { fixture, hiddenInput } = setup();

    pickFile(fixture, VALID_PDF());

    expect((hiddenInput().nativeElement as HTMLInputElement).value).toBe('');
  });

  it('marca isDragging como true durante dragover e false em dragleave', () => {
    const { fixture, component, dropZone } = setup();

    dropZone().triggerEventHandler('dragover', { preventDefault: () => undefined });
    fixture.detectChanges();
    expect(component.isDragging()).toBe(true);

    dropZone().triggerEventHandler('dragleave', undefined);
    fixture.detectChanges();
    expect(component.isDragging()).toBe(false);
  });

  it('aceita um arquivo válido via drag & drop', () => {
    const { fixture, component } = setup();
    const file = VALID_PDF();

    dropFile(fixture, file);

    expect(component.selectedFile()).toBe(file);
    expect(component.isDragging()).toBe(false);
  });

  it('rejeita drop sem arquivo sem alterar estado', () => {
    const { fixture, component } = setup();

    dropFile(fixture, null);

    expect(component.selectedFile()).toBeNull();
    expect(component.errors()).toEqual([]);
  });

  it('rejeita arquivo maior que o tamanho máximo configurado', () => {
    const { fixture, component, errorMessage } = setup();

    pickFile(fixture, OVERSIZED_PDF());

    expect(component.selectedFile()).toBeNull();
    expect(component.errors()[0]).toBe('Arquivo excede o tamanho máximo de 10MB.');
    expect(errorMessage().nativeElement.textContent).toContain('10MB');
  });

  it('rejeita arquivo cujo MIME não está na whitelist (mesmo com extensão válida)', () => {
    const { fixture, component } = setup();

    pickFile(fixture, MIME_SPOOFED());

    expect(component.selectedFile()).toBeNull();
    expect(component.errors()[0]).toContain('Tipo de arquivo não permitido');
  });

  it('rejeita arquivo cuja extensão não está em accept (mesmo com MIME válido)', () => {
    const { fixture, component } = setup();

    pickFile(fixture, PNG_WITH_GIF_EXTENSION());

    expect(component.selectedFile()).toBeNull();
    expect(component.errors()[0]).toContain('Tipo de arquivo não permitido');
  });

  it('rejeita arquivo sem nenhuma extensão', () => {
    const { fixture, component } = setup();

    pickFile(fixture, NO_EXTENSION());

    expect(component.selectedFile()).toBeNull();
    expect(component.errors()[0]).toContain('Tipo de arquivo não permitido');
  });

  it('aceita arquivo com extensão em maiúsculas (case-insensitive)', () => {
    const { fixture, component } = setup();
    const file = UPPERCASE_PDF();

    pickFile(fixture, file);

    expect(component.selectedFile()).toBe(file);
    expect(component.errors()).toEqual([]);
  });

  it('rejeita GIF independentemente de extensão e MIME', () => {
    const { fixture, component } = setup();

    pickFile(fixture, GIF_FILE());

    expect(component.selectedFile()).toBeNull();
    expect(component.errors()[0]).toContain('Tipo de arquivo não permitido');
  });

  it('respeita o accept configurado pelo consumidor (.pdf apenas)', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('acceptedFileTypes', '.pdf');
    fixture.componentRef.setInput('allowedMimeTypes', ['application/pdf']);
    fixture.detectChanges();

    pickFile(fixture, makeFile({ name: 'foto.png', type: 'image/png', sizeBytes: 1024 }));

    expect(component.selectedFile()).toBeNull();
    expect(component.errors()[0]).toBe('Tipo de arquivo não permitido. Envie arquivos nos formatos: .pdf');
  });

  it('respeita o maxSizeMb configurado pelo consumidor', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('maxSizeMb', 1);
    fixture.detectChanges();

    pickFile(fixture, makeFile({ name: 'doc.pdf', type: 'application/pdf', sizeBytes: 1024 * 1024 + 1 }));

    expect(component.selectedFile()).toBeNull();
    expect(component.errors()[0]).toBe('Arquivo excede o tamanho máximo de 1MB.');
  });

  it('atualiza a mensagem de tipo não permitido quando accept muda em runtime', () => {
    const { fixture, component } = setup();

    pickFile(fixture, GIF_FILE());
    expect(component.errors()[0]).toContain('.pdf,.jpg,.jpeg,.png');

    fixture.componentRef.setInput('acceptedFileTypes', '.pdf');
    fixture.componentRef.setInput('allowedMimeTypes', ['application/pdf']);
    fixture.detectChanges();
    pickFile(fixture, GIF_FILE());

    expect(component.errors()[0]).toBe('Tipo de arquivo não permitido. Envie arquivos nos formatos: .pdf');
  });

  it('limpa estado quando o usuário clica em Remover', () => {
    const { fixture, component, removeButton } = setup();
    pickFile(fixture, VALID_PDF());

    removeButton().triggerEventHandler('click', new MouseEvent('click'));
    fixture.detectChanges();

    expect(component.selectedFile()).toBeNull();
    expect(component.errors()).toEqual([]);
  });

  it('abre o seletor de arquivo nativo ao clicar na área de drop', () => {
    const { fixture, component, dropZone } = setup();
    const inputElement = component.fileInput().nativeElement;
    const clicks: number[] = [];
    inputElement.click = () => clicks.push(1);

    dropZone().triggerEventHandler('click', new MouseEvent('click'));
    fixture.detectChanges();

    expect(clicks.length).toBe(1);
  });

  it('é renderizado como <button> nativo (acessível por teclado Enter e Space sem handler manual)', () => {
    const { dropZone } = setup();
    expect(dropZone().nativeElement.tagName).toBe('BUTTON');
    expect(dropZone().nativeElement.getAttribute('type')).toBe('button');
  });

  it('expõe a mensagem de erro com role=alert para leitores de tela', () => {
    const { fixture, errorMessage } = setup();
    pickFile(fixture, OVERSIZED_PDF());

    expect(errorMessage().nativeElement.getAttribute('role')).toBe('alert');
  });

  it('substitui um arquivo previamente selecionado quando outro é escolhido', () => {
    const { fixture, component } = setup();
    const first = VALID_PDF();
    const second = makeFile({ name: 'outro.pdf', type: 'application/pdf', sizeBytes: 2048 });

    pickFile(fixture, first);
    pickFile(fixture, second);

    expect(component.selectedFile()).toBe(second);
  });

  it('limpa o erro anterior quando uma nova seleção válida é feita', () => {
    const { fixture, component } = setup();

    pickFile(fixture, OVERSIZED_PDF());
    expect(component.errors()).not.toEqual([]);

    pickFile(fixture, VALID_PDF());
    expect(component.errors()).toEqual([]);
  });

  it('rejeita drop com arquivo inválido sem alterar selectedFile prévio', () => {
    const { fixture, component } = setup();
    const valid = VALID_PDF();
    pickFile(fixture, valid);

    dropFile(fixture, GIF_FILE());

    expect(component.selectedFile()).toBe(valid);
    expect(component.errors()[0]).toContain('Tipo de arquivo não permitido');
  });

  it('gera IDs únicos por instância para isolar `for`/`aria-describedby` em multi-upload', () => {
    const first = TestBed.createComponent(FileUploadComponent);
    const second = TestBed.createComponent(FileUploadComponent);
    first.detectChanges();
    second.detectChanges();

    expect(first.componentInstance.inputId).not.toBe(second.componentInstance.inputId);
    expect(first.componentInstance.errorId).not.toBe(second.componentInstance.errorId);

    const firstInput = first.debugElement.query(By.css('input[type="file"]')).nativeElement as HTMLInputElement;
    const secondInput = second.debugElement.query(By.css('input[type="file"]')).nativeElement as HTMLInputElement;

    expect(firstInput.id).toBe(first.componentInstance.inputId);
    expect(secondInput.id).toBe(second.componentInstance.inputId);
    expect(firstInput.id).not.toBe(secondInput.id);
  });

  it('aria-describedby aponta para o errorId da própria instância quando há erro', () => {
    const { fixture, dropZone, errorMessage } = setup();
    pickFile(fixture, OVERSIZED_PDF());

    const dropZoneEl = dropZone().nativeElement as HTMLButtonElement;
    const errorEl = errorMessage().nativeElement as HTMLElement;

    expect(dropZoneEl.getAttribute('aria-describedby')).toBe(errorEl.id);
    expect(errorEl.id).toMatch(/^ui-file-upload-\d+-error$/);
  });

  it('label[for] aponta para o inputId da própria instância', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('fieldLabel', 'Documento de identificação');
    fixture.detectChanges();

    const labelEl = fixture.debugElement.query(By.css('label')).nativeElement as HTMLLabelElement;
    const inputEl = fixture.debugElement.query(By.css('input[type="file"]')).nativeElement as HTMLInputElement;

    expect(labelEl.htmlFor).toBe(inputEl.id);
    expect(labelEl.htmlFor).toMatch(/^ui-file-upload-\d+-input$/);
  });
});

describe('FileUploadComponent no modo controlado', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FileUploadComponent] });
  });

  function setup(entradas: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(FileUploadComponent);
    fixture.componentRef.setInput('itens', []);
    fixture.componentRef.setInput('multiple', true);
    for (const [nome, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nome, valor);
    const escolhidos: (readonly File[])[] = [];
    const retirados: string[] = [];
    const repetidos: string[] = [];
    fixture.componentInstance.arquivosEscolhidos.subscribe((f) => escolhidos.push(f));
    fixture.componentInstance.itemRetirado.subscribe((id) => retirados.push(id));
    fixture.componentInstance.tentarDeNovo.subscribe((id) => repetidos.push(id));
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const escolher = (...arquivos: File[]) => {
      const input = host.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: arquivos, configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    return { fixture, host, escolhidos, retirados, repetidos, escolher };
  }

  const pdf = (nome: string, bytes = 1024) =>
    new File([new ArrayBuffer(bytes)], nome, { type: 'application/pdf' });
  const item = (extra: Partial<ArquivoEmEnvio> = {}): ArquivoEmEnvio => ({
    id: 'a1',
    nome: 'edital.pdf',
    fase: 'enviando',
    progresso: 40,
    ...extra,
  });

  it('entrega vários arquivos aprovados de uma só vez', () => {
    const { escolhidos, escolher } = setup();

    escolher(pdf('a.pdf'), pdf('b.pdf'));

    expect(escolhidos).toHaveLength(1);
    expect(escolhidos[0].map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('recusa só o arquivo inválido e aponta qual foi', () => {
    const { host, escolhidos, escolher } = setup();

    escolher(pdf('a.pdf'), new File(['x'], 'foto.gif', { type: 'image/gif' }), pdf('grande.pdf', 11 * 1024 * 1024));

    expect(escolhidos[0].map((f) => f.name)).toEqual(['a.pdf']);
    const alertas = Array.from(host.querySelectorAll('[role="alert"]')).map((a) => a.textContent);
    expect(alertas[0]).toContain('foto.gif: Tipo de arquivo não permitido');
    expect(alertas[1]).toContain('grande.pdf: Arquivo excede o tamanho máximo de 10MB.');
  });

  it('recusa arquivo vazio antes do envio', () => {
    const { host, escolhidos, escolher } = setup();

    escolher(new File([], 'vazio.pdf', { type: 'application/pdf' }));

    expect(escolhidos).toHaveLength(0);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('vazio.pdf: O arquivo está vazio.');
  });

  it('respeita o limite de arquivos contando os que já estão na lista', () => {
    const { host, escolhidos, escolher } = setup({
      maxFiles: 2,
      itens: [item({ fase: 'confirmado', progresso: 100 })],
    });

    escolher(pdf('a.pdf'), pdf('b.pdf'));

    expect(escolhidos[0].map((f) => f.name)).toEqual(['a.pdf']);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('b.pdf: o limite de 2 arquivos foi atingido.');
  });

  it('com validarSoPelaExtensao, a extensão decide e qualquer tipo MIME passa', () => {
    const generico = new File(['x'], 'modelo.pdf', { type: 'application/octet-stream' });
    const vazio = new File(['x'], 'modelo.pdf', { type: '' });
    const intruso = new File(['x'], 'modelo.gif', { type: 'application/octet-stream' });
    const estrito = setup();
    estrito.escolher(generico);
    expect(estrito.escolhidos).toHaveLength(0);

    const flexivel = setup({ validarSoPelaExtensao: true });
    flexivel.escolher(generico, vazio, intruso);
    expect(flexivel.escolhidos[0].map((f) => f.name)).toEqual(['modelo.pdf', 'modelo.pdf']);
  });

  it('em modo de um arquivo, avisa que só um é aceito em vez de descartar os extras', () => {
    const { host, escolhidos, escolher } = setup({ multiple: false });

    escolher(pdf('a.pdf'), pdf('b.pdf'));

    expect(escolhidos).toHaveLength(0);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Envie um arquivo por vez.');
  });

  it('limpa as recusas antigas ao retirar um arquivo', () => {
    const { host, fixture, escolher } = setup({ itens: [item()] });
    escolher(new File(['x'], 'foto.gif', { type: 'image/gif' }));
    expect(host.querySelector('[role="alert"]')).not.toBeNull();

    host.querySelector<HTMLButtonElement>('button[aria-label="Remover edital.pdf"]')?.click();
    fixture.detectChanges();

    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('na falha anuncia só o alerta, sem região de status', () => {
    const { host } = setup({ itens: [item({ fase: 'erro', mensagem: 'Falhou.' })] });

    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.querySelector('li [role="alert"]')?.textContent).toContain('edital.pdf: Falhou.');
  });

  it('engole o drop no contêiner mesmo com a zona desabilitada', () => {
    const { host, fixture } = setup({ disabled: true });
    const evento = new Event('drop', { cancelable: true, bubbles: true });

    host.querySelector('.uni-uploader')?.dispatchEvent(evento);
    fixture.detectChanges();

    expect(evento.defaultPrevented).toBe(true);
  });

  it('nomeia a zona pelo rótulo do campo seguido do texto visível', () => {
    const { host } = setup({ fieldLabel: 'Enviar o modelo' });

    const zona = host.querySelector('.uni-uploader__drop') as HTMLElement;
    const ids = zona.getAttribute('aria-labelledby')?.split(' ') ?? [];
    const nome = ids.map((id) => host.querySelector(`[id="${id}"]`)?.textContent?.trim()).join(' ');
    expect(zona.hasAttribute('aria-label')).toBe(false);
    expect(nome).toContain('Enviar o modelo');
    expect(nome).toContain('Arraste arquivos aqui ou selecione do computador');
  });

  it('não aceita arquivo escolhido com o componente desabilitado', () => {
    const { escolhidos, escolher } = setup({ disabled: true });

    escolher(pdf('a.pdf'));

    expect(escolhidos).toHaveLength(0);
  });

  it('mostra a fase e o progresso de cada arquivo com nome acessível', () => {
    const { host } = setup({
      itens: [
        item(),
        item({ id: 'a2', nome: 'ata.pdf', fase: 'confirmando', progresso: 100 }),
        item({ id: 'a3', nome: 'ok.pdf', fase: 'confirmado', progresso: 100, tamanhoBytes: 2.5 * 1024 * 1024 }),
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
    const { host } = setup({
      itens: [
        item({ id: 'k', nome: 'k.pdf', tamanhoBytes: 512 * 1024 }),
        item({ id: 'm', nome: 'm.pdf', tamanhoBytes: 1.25 * 1024 * 1024 }),
      ],
    });

    const metas = Array.from(host.querySelectorAll('.uni-uploader__item-meta')).map((m) => m.textContent);
    expect(metas).toContain('512,0 KB');
    expect(metas).toContain('1,3 MB');
  });

  it('dá id a cada mensagem, lista todas no aria-describedby e marca só o input como inválido', () => {
    const { host, escolher } = setup({ mensagemExterna: 'Antes, conclua o cadastro.' });
    escolher(new File(['x'], 'a.gif', { type: 'image/gif' }), new File(['x'], 'b.gif', { type: 'image/gif' }));

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
    const { host } = setup({ multiple: true, itens: null });

    expect(host.querySelector<HTMLInputElement>('input[type="file"]')?.multiple).toBe(false);
    expect(host.textContent).toContain('Arraste um arquivo aqui');
  });

  it('anuncia o envio em passos para não interromper o leitor de tela', () => {
    const { host } = setup({ itens: [item({ progresso: 49 })] });

    expect(host.querySelector('[role="status"]')?.textContent).toBe('edital.pdf: enviando, 25%');
  });

  it('na falha mostra a mensagem e emite a nova tentativa', () => {
    const { host, repetidos, fixture } = setup({
      itens: [item({ fase: 'erro', mensagem: 'Falha ao enviar o arquivo.' })],
    });

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Falha ao enviar o arquivo.');
    const botao = host.querySelector<HTMLButtonElement>('button[aria-label="Tentar enviar novamente edital.pdf"]');
    botao?.click();
    fixture.detectChanges();

    expect(repetidos).toEqual(['a1']);
  });

  it('oculta a nova tentativa quando repetir não adianta e a remoção quando o arquivo é definitivo', () => {
    const { host } = setup({
      itens: [item({ fase: 'erro', mensagem: 'Recusado.', podeTentarDeNovo: false, podeRetirar: false })],
    });

    expect(host.textContent).not.toContain('Tentar novamente');
    expect(host.querySelector('button[aria-label^="Remover"]')).toBeNull();
  });

  it('emite a retirada do arquivo e devolve o foco à zona de soltar', () => {
    const { host, retirados, fixture } = setup({ itens: [item()] });

    host.querySelector<HTMLButtonElement>('button[aria-label="Remover edital.pdf"]')?.click();
    fixture.detectChanges();

    expect(retirados).toEqual(['a1']);
    expect(document.activeElement).toBe(host.querySelector('.uni-uploader__drop'));
  });

  it('mantém ações de arquivo e nome do campo mesmo com a zona desabilitada', () => {
    const { host } = setup({
      disabled: true,
      idDoCampo: 'campo-fixo',
      itens: [item({ fase: 'erro', mensagem: 'Falhou.' })],
    });

    expect(host.querySelector('input[type="file"]')?.id).toBe('campo-fixo');
    expect(host.querySelector<HTMLButtonElement>('button[aria-label^="Tentar"]')?.disabled).toBe(false);
  });

  it('liga ao campo as descrições externas e a mensagem do consumidor', () => {
    const { host } = setup({ descritoPor: 'aviso-1', mensagemExterna: 'Antes, conclua o cadastro.' });

    const zona = host.querySelector('.uni-uploader__drop');
    expect(zona?.getAttribute('aria-describedby')).toMatch(/^aviso-1 ui-file-upload-\d+-error$/);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Antes, conclua o cadastro.');
  });

  it('aplica o limite de arquivos também no modo de um arquivo', () => {
    const { host, escolhidos, escolher } = setup({ multiple: false, maxFiles: 1, itens: [item()] });

    escolher(pdf('a.pdf'));

    expect(escolhidos).toHaveLength(0);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'a.pdf: o limite de 1 arquivo foi atingido.',
    );
  });

  it('trata o arquivo solto fora da zona, na lista ou nas mensagens', () => {
    const { host, fixture, escolhidos } = setup({ itens: [item()] });
    const evento = new Event('drop', { cancelable: true, bubbles: true }) as DragEvent;
    Object.defineProperty(evento, 'dataTransfer', { value: { files: [pdf('solto.pdf')] } });

    host.querySelector('.uni-uploader__list')?.dispatchEvent(evento);
    fixture.detectChanges();

    expect(escolhidos[0].map((f) => f.name)).toEqual(['solto.pdf']);
  });

  it('não processa duas vezes o drop recebido pela zona', () => {
    const { host, escolhidos } = setup();
    const evento = new Event('drop', { cancelable: true, bubbles: true }) as DragEvent;
    Object.defineProperty(evento, 'dataTransfer', { value: { files: [pdf('a.pdf')] } });

    host.querySelector('.uni-uploader__drop')?.dispatchEvent(evento);

    expect(escolhidos).toHaveLength(1);
  });

  it('identifica a lista e as ações pelo contexto informado pelo consumidor', () => {
    const { host } = setup({
      fieldLabel: 'Enviar o modelo',
      nomeDaLista: 'Modelo de RG',
      itens: [item({ fase: 'erro', mensagem: 'Falhou.' })],
    });

    expect(host.querySelector('ul')?.getAttribute('aria-label')).toBe('Arquivos: Modelo de RG');
    expect(host.querySelector('button[aria-label="Remover edital.pdf — Modelo de RG"]')).not.toBeNull();
    expect(
      host.querySelector('button[aria-label="Tentar enviar novamente edital.pdf — Modelo de RG"]'),
    ).not.toBeNull();
  });

  it('marca o input como inválido quando um arquivo está em erro', () => {
    const { host } = setup({ itens: [item({ fase: 'erro', mensagem: 'Falhou.' })] });

    expect(host.querySelector('input[type="file"]')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('devolve o foco à zona depois de pedir nova tentativa', () => {
    const { host, fixture } = setup({ itens: [item({ fase: 'erro', mensagem: 'Falhou.' })] });

    host.querySelector<HTMLButtonElement>('button[aria-label^="Tentar enviar"]')?.click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(host.querySelector('.uni-uploader__drop'));
  });

  it('com a zona desabilitada, o foco da nova tentativa vai para a lista', () => {
    const { host, fixture } = setup({
      disabled: true,
      itens: [item({ fase: 'erro', mensagem: 'Falhou.' })],
    });

    host.querySelector<HTMLButtonElement>('button[aria-label^="Tentar enviar"]')?.click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(host.querySelector('ul'));
  });

  it('com a zona desabilitada, o arrastar sobre o contêiner não sugere soltar', () => {
    const { host } = setup({ disabled: true });
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
    const fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(HostComponent);
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

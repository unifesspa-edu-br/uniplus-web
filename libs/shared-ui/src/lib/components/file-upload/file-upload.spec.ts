import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FileUploadComponent } from './file-upload';

describe('FileUploadComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FileUploadComponent] });
  });

  function setup() {
    const fixture: ComponentFixture<FileUploadComponent> =
      TestBed.createComponent(FileUploadComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const dropZone = () => fixture.debugElement.query(By.css('button[aria-label^="Área de upload"]'));
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
    const dropZone = fixture.debugElement.query(By.css('button[aria-label^="Área de upload"]'));
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
    expect(component.error()).toBeNull();
    expect(component.isDragging()).toBe(false);
  });

  it('aceita um arquivo válido via input[type=file]', () => {
    const { fixture, component } = setup();
    const file = VALID_PDF();

    pickFile(fixture, file);

    expect(component.selectedFile()).toBe(file);
    expect(component.error()).toBeNull();
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
    expect(component.error()).toBeNull();
  });

  it('rejeita arquivo maior que o tamanho máximo configurado', () => {
    const { fixture, component, errorMessage } = setup();

    pickFile(fixture, OVERSIZED_PDF());

    expect(component.selectedFile()).toBeNull();
    expect(component.error()).toBe('Arquivo excede o tamanho máximo de 10MB.');
    expect(errorMessage().nativeElement.textContent).toContain('10MB');
  });

  it('rejeita arquivo cujo MIME não está na whitelist (mesmo com extensão válida)', () => {
    const { fixture, component } = setup();

    pickFile(fixture, MIME_SPOOFED());

    expect(component.selectedFile()).toBeNull();
    expect(component.error()).toContain('Tipo de arquivo não permitido');
  });

  it('rejeita arquivo cuja extensão não está em accept (mesmo com MIME válido)', () => {
    const { fixture, component } = setup();

    pickFile(fixture, PNG_WITH_GIF_EXTENSION());

    expect(component.selectedFile()).toBeNull();
    expect(component.error()).toContain('Tipo de arquivo não permitido');
  });

  it('rejeita arquivo sem nenhuma extensão', () => {
    const { fixture, component } = setup();

    pickFile(fixture, NO_EXTENSION());

    expect(component.selectedFile()).toBeNull();
    expect(component.error()).toContain('Tipo de arquivo não permitido');
  });

  it('aceita arquivo com extensão em maiúsculas (case-insensitive)', () => {
    const { fixture, component } = setup();
    const file = UPPERCASE_PDF();

    pickFile(fixture, file);

    expect(component.selectedFile()).toBe(file);
    expect(component.error()).toBeNull();
  });

  it('rejeita GIF independentemente de extensão e MIME', () => {
    const { fixture, component } = setup();

    pickFile(fixture, GIF_FILE());

    expect(component.selectedFile()).toBeNull();
    expect(component.error()).toContain('Tipo de arquivo não permitido');
  });

  it('respeita o accept configurado pelo consumidor (.pdf apenas)', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('accept', '.pdf');
    fixture.componentRef.setInput('allowedMimeTypes', ['application/pdf']);
    fixture.detectChanges();

    pickFile(fixture, makeFile({ name: 'foto.png', type: 'image/png', sizeBytes: 1024 }));

    expect(component.selectedFile()).toBeNull();
    expect(component.error()).toBe('Tipo de arquivo não permitido. Envie arquivos nos formatos: .pdf');
  });

  it('respeita o maxSizeMb configurado pelo consumidor', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('maxSizeMb', 1);
    fixture.detectChanges();

    pickFile(fixture, makeFile({ name: 'doc.pdf', type: 'application/pdf', sizeBytes: 1024 * 1024 + 1 }));

    expect(component.selectedFile()).toBeNull();
    expect(component.error()).toBe('Arquivo excede o tamanho máximo de 1MB.');
  });

  it('atualiza a mensagem de tipo não permitido quando accept muda em runtime', () => {
    const { fixture, component } = setup();

    pickFile(fixture, GIF_FILE());
    expect(component.error()).toContain('.pdf,.jpg,.jpeg,.png');

    fixture.componentRef.setInput('accept', '.pdf');
    fixture.componentRef.setInput('allowedMimeTypes', ['application/pdf']);
    fixture.detectChanges();
    pickFile(fixture, GIF_FILE());

    expect(component.error()).toBe('Tipo de arquivo não permitido. Envie arquivos nos formatos: .pdf');
  });

  it('limpa estado quando o usuário clica em Remover', () => {
    const { fixture, component, removeButton } = setup();
    pickFile(fixture, VALID_PDF());

    removeButton().triggerEventHandler('click', new MouseEvent('click'));
    fixture.detectChanges();

    expect(component.selectedFile()).toBeNull();
    expect(component.error()).toBeNull();
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
    expect(component.error()).not.toBeNull();

    pickFile(fixture, VALID_PDF());
    expect(component.error()).toBeNull();
  });

  it('rejeita drop com arquivo inválido sem alterar selectedFile prévio', () => {
    const { fixture, component } = setup();
    const valid = VALID_PDF();
    pickFile(fixture, valid);

    dropFile(fixture, GIF_FILE());

    expect(component.selectedFile()).toBe(valid);
    expect(component.error()).toContain('Tipo de arquivo não permitido');
  });
});

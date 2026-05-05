import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { FileUploadComponent } from './file-upload';

describe('FileUploadComponent', () => {
  const MAX_SIZE_IN_MB = 10;
  const MAX_SIZE_IN_BYTES = MAX_SIZE_IN_MB * 1024 * 1024;
  const MAX_SIZE_MB_MSG = `Arquivo excede o tamanho máximo de ${MAX_SIZE_IN_MB}MB.`
  const VALID_FILE_MOCK = new File([new ArrayBuffer(MAX_SIZE_IN_BYTES)], "file-mock.pdf", { type: "application/pdf" });
  const OVERSIZED_FILE_MOCK = new File([new ArrayBuffer(MAX_SIZE_IN_BYTES + 1)], "oversized-file-mock.pdf", { type: "application/pdf" });
  const TYPE_NOT_ALLOWED_FILE_MOCK = new File([new ArrayBuffer(MAX_SIZE_IN_BYTES)], "not-allowed-file-mock.gif", { type: "image/gif" });
  const EXTENSION_NOT_ALLOWED_FILE_MOCK = new File([new ArrayBuffer(MAX_SIZE_IN_BYTES)], "not-allowed-file-mock.gif", { type: "image/png" });
  const TYPE_NOT_ALLOWED_MSG = 'Tipo de arquivo não permitido. Envie arquivos nos formatos: .pdf,.jpg,.jpeg,.png';

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FileUploadComponent] });
  });

  function setup() {
    const fixture: ComponentFixture<FileUploadComponent> =
      TestBed.createComponent(FileUploadComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const fileSelectOutputSpy = vi.spyOn(component.fileSelected, 'emit');
    const removeFileSpy = vi.spyOn(component, 'removeFile');
    const onDragLeaveSpy = vi.spyOn(component, "onDragLeave");
    const onDragOverSpy = vi.spyOn(component, "onDragOver");
    const onFileSelectedSpy = vi.spyOn(component, "onFileSelected");
    const onDropSpy = vi.spyOn(component, "onDrop");
    const fileInputClickSpy = vi.spyOn(component.fileInput()?.nativeElement, 'click');
    const getDivButton = () =>
        fixture.debugElement.query(By.css('[role="button"]'));
    const getFileInput = () =>
        fixture.debugElement.query(By.css('#file-upload-input'));
    const getFileInputEl = () => getFileInput().nativeElement as HTMLInputElement;
    const getButtons = () => fixture.debugElement.queryAll(By.css('button'));
    const getSelectButtonEl = () =>
      getButtons().find(button => button.nativeElement.textContent.trim() === 'selecione do computador')?.nativeElement as HTMLButtonElement;
    const getRemoveButtonEl = () =>
        getButtons().find(button => button.nativeElement.textContent.trim() === 'Remover')?.nativeElement as HTMLButtonElement;
    return {
      fixture,
      component,
      getDivButton,
      getFileInputEl,
      getFileInput,
      getSelectButtonEl,
      getRemoveButtonEl,
      fileSelectOutputSpy,
      removeFileSpy,
      onDragLeaveSpy,
      onDragOverSpy,
      onFileSelectedSpy,
      fileInputClickSpy,
      onDropSpy
    }
  }

  it('inicializa o componente corretamente', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  it('seleciona arquivo no input', () => {
    const { fixture, component, getFileInput, fileSelectOutputSpy } = setup();
    const fileInput = getFileInput();
    const eventWithFileMock = {
      target: {
        files: [VALID_FILE_MOCK]
      }
    } as unknown as Event;
    fileInput.triggerEventHandler('change', eventWithFileMock);

    fixture.detectChanges();
    const file = (eventWithFileMock.target as HTMLInputElement).files?.[0];

    expect(component.error()).toBe('');
    expect(component.selectedFile()).toBe(file);
    expect(fileSelectOutputSpy).toHaveBeenCalledWith(file);
    expect(fileInput.nativeElement.value).toBe('');
  });

  it('dispara o evento de dragover no container do input', () => {
    const { fixture, component, getDivButton, onDragOverSpy } = setup();
    const uploadButtonDiv = getDivButton();
    const dragEventEmptyMock = {
      preventDefault: vi.fn(),
    } as unknown as DragEvent;
    uploadButtonDiv.triggerEventHandler('dragover', dragEventEmptyMock);
    fixture.detectChanges();

    expect(onDragOverSpy).toHaveBeenCalled();
    expect(dragEventEmptyMock.preventDefault).toHaveBeenCalled();
    expect(component.isDragging()).toBe(true);
  });

  it('dispara o evento de dragleave no container do input', () => {
    const { fixture, component, getDivButton, onDragLeaveSpy } = setup();
    const uploadButtonDiv = getDivButton();
    component.isDragging.set(true);
    fixture.detectChanges();

    uploadButtonDiv.triggerEventHandler('dragleave');
    fixture.detectChanges();

    expect(onDragLeaveSpy).toHaveBeenCalled();
    expect(component.isDragging()).toBe(false);
  });

  it('dispara evento drop no container do input quando um arquivo está selecionado', () => {
    const { fixture, component, getDivButton, fileSelectOutputSpy, getFileInput, onDropSpy } = setup();
    const uploadButtonDiv = getDivButton();
    const fileInput = getFileInput();
    const dragEventWithFileMock = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [VALID_FILE_MOCK]
      }
    } as unknown as DragEvent;
    uploadButtonDiv.triggerEventHandler('drop', dragEventWithFileMock);
    fixture.detectChanges();

    expect(dragEventWithFileMock.preventDefault).toHaveBeenCalled();
    expect(onDropSpy).toHaveBeenCalled();
    expect(component.isDragging()).toBe(false);
    expect(fileSelectOutputSpy).toHaveBeenCalled();
    expect(fileInput.nativeElement.value).toBe('');
  });

  it(`rejeita arquivos maiores que ${MAX_SIZE_IN_MB.toString()}MB`, () => {
    const { fixture, component, getFileInput, fileSelectOutputSpy } = setup();
    const fileInput = getFileInput();
    const eventWithOversizedFileMock = {
      target: {
        files: [OVERSIZED_FILE_MOCK]
      }
    } as unknown as Event;
    fileInput.triggerEventHandler('change', eventWithOversizedFileMock);
    fixture.detectChanges();

    expect(fileSelectOutputSpy).not.toHaveBeenCalled();
    expect(component.error()).toBe(MAX_SIZE_MB_MSG);
    expect(component.selectedFile()).toBe(null);
  });

  it('emite evento de clique no input quando clica no botão de selecionar arquivo do computador', () => {
    const { fixture, getSelectButtonEl, fileInputClickSpy } = setup();
    const selectButtonEl = getSelectButtonEl();

    selectButtonEl.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(fileInputClickSpy).toHaveBeenCalled();
  });

  it('remove um arquivo previamente selecionado', () => {
    const { fixture, component, getRemoveButtonEl, removeFileSpy } = setup();
    component.selectedFile.set(VALID_FILE_MOCK);
    fixture.detectChanges();

    const removeButtonEl = getRemoveButtonEl();
    removeButtonEl.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(removeFileSpy).toHaveBeenCalled();
    expect(component.selectedFile()).toBe(null);
    expect(component.error()).toBe('');
  });

  it('emite um evento keydown.enter no container do input', () => {
    const { fixture, getFileInput, fileInputClickSpy } = setup();
    const fileInputEl = getFileInput();

    fileInputEl.triggerEventHandler('keydown.enter', { target: fileInputEl.nativeElement.click() });
    fixture.detectChanges();

    expect(fileInputClickSpy).toHaveBeenCalled();
  });

  it('rejeita arquivo quando o tipo do arquivo não faz parte dos tipos aceitos', () => {
    const { fixture, component, getFileInput, onFileSelectedSpy, fileSelectOutputSpy } = setup();
    const fileInput = getFileInput();
    const eventWithFileNotAllowedTypeMock = {
      target: { files: [TYPE_NOT_ALLOWED_FILE_MOCK] }
    } as unknown as Event;

    fileInput.triggerEventHandler('change', eventWithFileNotAllowedTypeMock);
    fixture.detectChanges();
    const file = (eventWithFileNotAllowedTypeMock.target as HTMLInputElement).files?.[0];

    expect(component.error()).toBe(TYPE_NOT_ALLOWED_MSG);
    expect(file?.size).toBe(MAX_SIZE_IN_BYTES);
    expect(onFileSelectedSpy).toHaveBeenCalledWith(eventWithFileNotAllowedTypeMock);
    expect(fileInput.nativeElement.value).toBe('');
    expect(fileSelectOutputSpy).not.toHaveBeenCalled();
    expect(component.selectedFile()).toBe(null);
    expect(fileInput.nativeElement.value).toBe('');
  });

  it('rejeita arquivo quando a extensão do arquivo não faz parte das extensões aceitas', () => {
    const { fixture, component, getFileInput, onFileSelectedSpy, fileSelectOutputSpy } = setup();
    const fileInput = getFileInput();
    const eventWithFileNotAllowedExtensionMock = {
      target: {
        files: [EXTENSION_NOT_ALLOWED_FILE_MOCK]
      }
    } as unknown as Event;

    fileInput.triggerEventHandler('change', eventWithFileNotAllowedExtensionMock);
    fixture.detectChanges();

    expect(onFileSelectedSpy).toHaveBeenCalledWith(eventWithFileNotAllowedExtensionMock);
    expect(fileSelectOutputSpy).not.toHaveBeenCalled();
    expect(component.error()).toBe(TYPE_NOT_ALLOWED_MSG);
    expect(fileInput.nativeElement.value).toBe('');
  });
});

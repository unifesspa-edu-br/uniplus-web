import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FinalidadeDoDocumento } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import { AnexosDaPublicacaoComponent } from './anexos-da-publicacao.component';
import { EnviosDeArquivos } from './envios-de-arquivos';

const DOCUMENTO = '01960000-0000-7000-0000-0000000005d2';

describe('AnexosDaPublicacaoComponent', () => {
  let fixture: ComponentFixture<AnexosDaPublicacaoComponent>;
  let host: HTMLElement;
  let envios: EnviosDeArquivos;

  beforeEach(() => {
    envios = new EnviosDeArquivos({
      finalidade: FinalidadeDoDocumento.documentoDeAto,
      processoId: () => null,
      abrirEnvio: () => {
        throw new Error('o envio não é aberto sem processo');
      },
      tipoDeMidiaDe: () => null,
      recusaDoFormato: 'Formato não aceito.',
      explicar: (problema) => problema.title,
      nomeInicial: (nomeArquivo) => nomeArquivo.replace(/\.[^.]+$/u, ''),
    });
    envios.arquivos.set([
      { id: 'a1', nomeArquivo: 'planilha.docx', nome: 'planilha', progress: 100, fase: 'confirmado', documentoAPublicarId: DOCUMENTO },
      { id: 'a2', nomeArquivo: 'lista.pdf', nome: 'lista', progress: 40, fase: 'enviando' },
    ]);
    fixture = TestBed.createComponent(AnexosDaPublicacaoComponent);
    host = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('envios', envios);
    fixture.detectChanges();
  });

  const campoDoNome = (): HTMLInputElement =>
    host.querySelector<HTMLInputElement>('input[id^="pub-anexo-nome-"]') as HTMLInputElement;

  function digitar(nome: string): void {
    campoDoNome().value = nome;
    campoDoNome().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('é a região "Anexos" para o leitor de tela', () => {
    expect(host.getAttribute('role')).toBe('region');
    const titulo = host.ownerDocument.getElementById(host.getAttribute('aria-labelledby') ?? '');
    expect(titulo?.textContent).toContain('Anexos');
  });

  it('pede o nome só do anexo que o servidor já selou e mostra como ele será baixado', () => {
    expect(host.querySelectorAll('input[id^="pub-anexo-nome-"]')).toHaveLength(1);
    expect(host.textContent).toContain('Baixado como “planilha.docx”.');
  });

  it('guarda o nome editado e atualiza o nome do download', () => {
    digitar('Planilha de vagas');

    expect(envios.arquivos()[0].nome).toBe('Planilha de vagas');
    expect(host.textContent).toContain('Baixado como “Planilha de vagas.docx”.');
  });

  it('recusa o nome com separador de caminho e liga a mensagem ao campo', () => {
    digitar('pasta/planilha');

    const erro = host.querySelector('[id^="pub-anexo-erro-"]');
    expect(erro?.textContent).toContain('O nome do anexo não pode ter');
    expect(campoDoNome().getAttribute('aria-invalid')).toBe('true');
    expect(campoDoNome().getAttribute('aria-describedby')).toContain(erro?.id ?? '');
  });

  it('trava o nome enquanto o formulário publica', () => {
    fixture.componentRef.setInput('desabilitado', true);
    fixture.detectChanges();

    expect(campoDoNome().disabled).toBe(true);
  });
});

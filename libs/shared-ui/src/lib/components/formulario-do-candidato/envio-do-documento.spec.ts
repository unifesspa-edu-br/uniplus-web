import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileUploadComponent } from '../file-upload/file-upload';
import type { AlvoDoEnvio, ArquivoEnviado, EnvioDeDocumentos } from './envio-de-documentos';
import { EnvioDoDocumentoComponent } from './envio-do-documento';

const ALVO: AlvoDoEnvio = {
  chave: 'exigencia-laudo:',
  exigenciaId: 'exigencia-laudo',
  ocorrenciaId: null,
  nome: 'Laudo médico',
};
const CONFIRMADO: ArquivoEnviado = {
  arquivoId: 'arquivo-1',
  chave: ALVO.chave,
  nome: 'laudo.pdf',
  tipoDeMidia: 'application/pdf',
  tamanhoBytes: 2048,
};

const arquivo = (nome: string, bytes = 2048): File =>
  new File([new ArrayBuffer(bytes)], nome, { type: 'application/pdf' });

describe('Envio do arquivo de um documento exigido', () => {
  let fixture: ComponentFixture<EnvioDoDocumentoComponent>;
  let envio: {
    arquivos: ReturnType<typeof signal<readonly ArquivoEnviado[]>>;
    enviar: ReturnType<typeof vi.fn>;
    remover: ReturnType<typeof vi.fn>;
  };

  // Como o envio de quem hospeda: o arquivo confirmado fica na lista dele, e a remoção o tira.
  beforeEach(() => {
    const arquivos = signal<readonly ArquivoEnviado[]>([]);
    envio = {
      arquivos,
      enviar: vi.fn().mockImplementation(async () => {
        arquivos.update((lista) => [...lista, CONFIRMADO]);
        return { ok: true, arquivo: CONFIRMADO };
      }),
      remover: vi.fn().mockImplementation(async (id: string) => {
        arquivos.update((lista) => lista.filter((a) => a.arquivoId !== id));
        return { ok: true };
      }),
    };
  });

  const montar = (entradas: Record<string, unknown> = {}): HTMLElement => {
    fixture = TestBed.createComponent(EnvioDoDocumentoComponent);
    fixture.componentRef.setInput('alvo', ALVO);
    fixture.componentRef.setInput('formatos', { qualquer: false, lista: ['PDF'] });
    fixture.componentRef.setInput('tamanhoMaximoBytes', 10 * 1024 * 1024);
    fixture.componentRef.setInput('envio', envio as unknown as EnvioDeDocumentos);
    for (const [nome, valor] of Object.entries(entradas))
      fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const escolher = async (...arquivos: File[]): Promise<void> => {
    fixture.debugElement
      .query(By.directive(FileUploadComponent))
      .componentInstance.onDrop(arquivos);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('envia o arquivo escolhido para a exigência e o mostra como enviado', async () => {
    const tela = montar();
    const enviado = vi.fn();
    fixture.componentInstance.arquivoEnviado.subscribe(enviado);

    const laudo = arquivo('laudo.pdf');
    await escolher(laudo);

    expect(envio.enviar).toHaveBeenCalledWith(ALVO, laudo, expect.any(Function));
    expect(enviado).toHaveBeenCalledWith(CONFIRMADO);
    expect(tela.querySelector('.uni-uploader__item-name')?.textContent).toContain('laudo.pdf');
  });

  it('arquivo acima do tamanho da exigência: anuncia o erro ligado ao campo e não envia', async () => {
    const tela = montar({ tamanhoMaximoBytes: 1024 * 1024 });

    await escolher(arquivo('laudo.pdf', 2 * 1024 * 1024));

    expect(envio.enviar).not.toHaveBeenCalled();
    const erro = tela.querySelector('[role="alert"]') as HTMLElement;
    expect(erro.textContent).toContain('excede o tamanho máximo de 1MB');
    const campo = tela.querySelector('input[type="file"]') as HTMLInputElement;
    expect(campo.getAttribute('aria-describedby')).toContain(erro.id);
    expect(campo.getAttribute('aria-invalid')).toBe('true');
  });

  it('formato fora da lista da exigência: recusa no navegador', async () => {
    const tela = montar();

    await escolher(new File(['x'], 'foto.png', { type: 'image/png' }));

    expect(envio.enviar).not.toHaveBeenCalled();
    expect(tela.querySelector('[role="alert"]')?.textContent).toContain(
      'Tipo de arquivo não permitido',
    );
  });

  it('falha no envio: mostra a recusa e repete o mesmo arquivo na nova tentativa', async () => {
    envio.enviar.mockResolvedValueOnce({
      ok: false,
      mensagem: 'O antivírus está indisponível.',
      podeTentarDeNovo: true,
    });
    const tela = montar();
    const laudo = arquivo('laudo.pdf');

    await escolher(laudo);
    expect(tela.querySelector('[role="alert"]')?.textContent).toContain(
      'O antivírus está indisponível.',
    );

    (
      tela.querySelector('button[aria-label^="Tentar enviar novamente"]') as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    expect(envio.enviar).toHaveBeenCalledTimes(2);
    expect(envio.enviar.mock.calls[1][1]).toBe(laudo);
  });

  it('o arquivo enviado antes de trocar de passo reaparece quando a tela volta', async () => {
    montar();
    await escolher(arquivo('laudo.pdf'));
    fixture.destroy();

    const tela = montar();

    expect(tela.querySelector('.uni-uploader__item-name')?.textContent).toContain('laudo.pdf');
  });

  it('arquivo retirado enquanto sobe é descartado quando o envio termina', async () => {
    let terminar: (d: unknown) => void = () => undefined;
    envio.enviar.mockImplementationOnce(() => new Promise((resolve) => (terminar = resolve)));
    const tela = montar();
    await escolher(arquivo('laudo.pdf'));

    (tela.querySelector('button[aria-label^="Remover"]') as HTMLButtonElement).click();
    terminar({ ok: true, arquivo: CONFIRMADO });
    await fixture.whenStable();

    expect(envio.remover).toHaveBeenCalledWith('arquivo-1');
  });

  it('arquivo retirado enquanto sobe é descartado mesmo se a tela saiu antes do fim', async () => {
    let terminar: (d: unknown) => void = () => undefined;
    envio.enviar.mockImplementationOnce(() => new Promise((resolve) => (terminar = resolve)));
    const tela = montar();
    await escolher(arquivo('laudo.pdf'));

    (tela.querySelector('button[aria-label^="Remover"]') as HTMLButtonElement).click();
    fixture.destroy();
    terminar({ ok: true, arquivo: CONFIRMADO });
    await Promise.resolve();
    await Promise.resolve();

    expect(envio.remover).toHaveBeenCalledWith('arquivo-1');
  });

  it('anuncia as fases do envio no leitor de tela', async () => {
    let andar: (fase: 'enviando' | 'confirmando', progresso: number) => void = () => undefined;
    let terminar: (d: unknown) => void = () => undefined;
    envio.enviar.mockImplementationOnce((_alvo, _arquivo, aoAndar) => {
      andar = aoAndar;
      return new Promise((resolve) => (terminar = resolve));
    });
    const tela = montar();
    await escolher(arquivo('laudo.pdf'));
    const anuncio = (): string => tela.querySelector('[role="status"]')?.textContent?.trim() ?? '';

    andar('enviando', 50);
    fixture.detectChanges();
    const durante = anuncio();
    andar('confirmando', 100);
    fixture.detectChanges();

    expect(durante).not.toBe('');
    expect(anuncio()).not.toBe(durante);
    terminar({ ok: true, arquivo: CONFIRMADO });
  });

  it('remove o arquivo enviado pela API e avisa quem hospeda', async () => {
    const tela = montar();
    envio.arquivos.set([CONFIRMADO]);
    fixture.detectChanges();
    const removido = vi.fn();
    fixture.componentInstance.arquivoRemovido.subscribe(removido);

    (tela.querySelector('button[aria-label^="Remover"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(envio.remover).toHaveBeenCalledWith('arquivo-1');
    expect(removido).toHaveBeenCalledWith('arquivo-1');
    expect(tela.querySelector('.uni-uploader__item')).toBeNull();
  });

  it('arquivo removido não volta enquanto a avaliação que o trazia não é refeita', async () => {
    const tela = montar({ arquivos: [CONFIRMADO] });

    (tela.querySelector('button[aria-label^="Remover"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(tela.querySelector('.uni-uploader__item')).toBeNull();
  });

  it('com a inscrição enviada, não deixa remover nem enviar', () => {
    const tela = montar({ arquivos: [CONFIRMADO], podeAlterar: false });

    expect(tela.querySelector('button[aria-label^="Remover"]')).toBeNull();
    expect((tela.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(true);
  });

  it('com mínimo acima de 1, diz quantos arquivos enviar e liga a dica ao campo', () => {
    const tela = montar({ quantidadeMinima: 2 });

    const dica = tela.querySelector('.envio-do-documento__dica') as HTMLElement;
    expect(dica.textContent).toContain('Envie 2 arquivos');
    expect(
      (tela.querySelector('input[type="file"]') as HTMLInputElement).getAttribute(
        'aria-describedby',
      ),
    ).toContain(dica.id);
  });

  it('escreve a situação da exigência quando a avaliação a informa', () => {
    const tela = montar({ situacao: 'PENDENTE' });

    expect(tela.querySelector('ui-tag')?.textContent?.trim()).toBe('Pendente');
  });

  it('não tem violação de acessibilidade com o arquivo enviado, a situação e a dica', async () => {
    document.body.appendChild(montar({ situacao: 'PENDENTE', quantidadeMinima: 2 }));
    await escolher(arquivo('laudo.pdf'));

    // O contraste depende dos estilos globais do design system, que o teste de unidade não carrega.
    const resultado = await axe.run(fixture.nativeElement, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(resultado.violations.map((v) => v.id)).toEqual([]);
    fixture.nativeElement.remove();
  });
});

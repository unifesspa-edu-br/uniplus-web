import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
  apresentacaoId: 'apresentacao-1',
  chave: ALVO.chave,
  tipoDeMidia: 'application/pdf',
  tamanhoBytes: 2048,
  situacao: 'verificado',
  mensagem: null,
  rotulo: 'Arquivo 1',
  // 09:33 no fuso institucional (America/Belem)
  confirmadoEm: '2026-10-22T12:33:00Z',
};

const arquivo = (nome: string, bytes = 2048): File =>
  new File([new ArrayBuffer(bytes)], nome, { type: 'application/pdf' });

describe('Envio do arquivo de um documento exigido', () => {
  let fixture: ComponentFixture<EnvioDoDocumentoComponent>;
  let envio: {
    arquivos: ReturnType<typeof signal<readonly ArquivoEnviado[]>>;
    mudancas: ReturnType<typeof signal<number>>;
    ocupado: ReturnType<typeof signal<boolean>>;
    enviar: ReturnType<typeof vi.fn>;
    remover: ReturnType<typeof vi.fn>;
    baixar: ReturnType<typeof vi.fn>;
  };

  // Como o envio de quem hospeda: o arquivo confirmado fica na lista dele, e a remoção o tira.
  beforeEach(() => {
    const arquivos = signal<readonly ArquivoEnviado[]>([]);
    envio = {
      arquivos,
      mudancas: signal(0),
      ocupado: signal(false),
      enviar: vi.fn().mockImplementation(async () => {
        arquivos.update((lista) => [...lista, CONFIRMADO]);
        return { ok: true, arquivo: CONFIRMADO };
      }),
      remover: vi.fn().mockImplementation(async (id: string) => {
        arquivos.update((lista) => lista.filter((a) => a.arquivoId !== id));
        return { ok: true };
      }),
      baixar: vi.fn().mockResolvedValue({ ok: true }),
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

    const laudo = arquivo('laudo.pdf');
    await escolher(laudo);

    expect(envio.enviar).toHaveBeenCalledWith(ALVO, laudo, expect.any(Function));
    expect(tela.querySelector('.uni-uploader__item-name')?.textContent).toContain('Arquivo 1');
    expect(tela.textContent).not.toContain('laudo.pdf');
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

    expect(tela.querySelector('.uni-uploader__item-name')?.textContent).toContain('Arquivo 1');
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

  it('arquivo em verificação mostra a mensagem da API, sem erro e sem oferecer nova tentativa', () => {
    const tela = montar({
      arquivos: [
        {
          ...CONFIRMADO,
          situacao: 'emVerificacao',
          mensagem: 'Arquivo em verificação. Isso costuma levar poucos segundos.',
        },
      ],
    });

    expect(tela.querySelector('.uni-uploader__item')?.textContent).toContain(
      'Arquivo em verificação. Isso costuma levar poucos segundos.',
    );
    expect(tela.querySelector('[role="alert"]')).toBeNull();
    expect(tela.querySelector('.uni-uploader__item.is-success')).toBeNull();
  });

  it('arquivo recusado na verificação mostra a mensagem da API como erro, com a opção de remover', () => {
    const tela = montar({
      arquivos: [
        {
          ...CONFIRMADO,
          situacao: 'recusado',
          mensagem: 'Este PDF está protegido por senha. Envie o arquivo sem senha.',
        },
      ],
    });

    expect(tela.querySelector('[role="alert"]')?.textContent).toContain(
      'Este PDF está protegido por senha. Envie o arquivo sem senha.',
    );
    expect(tela.querySelector('button[aria-label^="Remover"]')).not.toBeNull();
    expect(tela.querySelector('button[aria-label^="Tentar enviar novamente"]')).toBeNull();
  });

  it('o resultado da avaliação prevalece sobre o arquivo que o envio guardou em verificação', () => {
    envio.arquivos.set([
      {
        ...CONFIRMADO,
        situacao: 'emVerificacao',
        mensagem: 'Em verificação.',
      },
    ]);
    const tela = montar({ arquivos: [CONFIRMADO] });

    expect(tela.querySelectorAll('.uni-uploader__item')).toHaveLength(1);
    expect(tela.querySelector('.uni-uploader__item.is-success')).not.toBeNull();
  });

  it('o arquivo da avaliação não apaga o tamanho que o envio desta sessão já conhecia', () => {
    envio.arquivos.set([
      {
        ...CONFIRMADO,
        situacao: 'emVerificacao',
        mensagem: 'Em verificação.',
      },
    ]);
    const tela = montar({
      arquivos: [{ ...CONFIRMADO, tamanhoBytes: null }],
    });

    expect(tela.querySelector('.uni-uploader__item-meta')?.textContent).toContain('2,0 KB');
  });

  describe('baixar o arquivo enviado', () => {
    const baixar = (tela: HTMLElement): HTMLButtonElement =>
      tela.querySelector('button[aria-label^="Baixar"]') as HTMLButtonElement;

    it('arquivo verificado: o botão Baixar tem nome contextual e pede o download do arquivo', async () => {
      const tela = montar({ arquivos: [CONFIRMADO] });

      expect(baixar(tela).getAttribute('aria-label')).toBe('Baixar Arquivo 1 de Laudo médico');
      baixar(tela).click();
      await fixture.whenStable();

      expect(envio.baixar).toHaveBeenCalledWith('arquivo-1');
    });

    it('arquivo em verificação: não oferece Baixar', () => {
      const tela = montar({
        arquivos: [{ ...CONFIRMADO, situacao: 'emVerificacao', mensagem: 'Em verificação.' }],
      });

      expect(baixar(tela)).toBeNull();
    });

    it('mostra o rótulo e a ordem que a API devolve, mesmo fora da ordem cronológica, e a data do envio, sem o nome original', () => {
      const tela = montar({
        arquivos: [
          {
            ...CONFIRMADO,
            arquivoId: 'b',
            apresentacaoId: 'apresentacao-2',
            rotulo: 'Arquivo 2',
            confirmadoEm: '2026-10-22T13:00:00Z',
          },
          CONFIRMADO,
        ],
      });

      const itens = Array.from(tela.querySelectorAll('.uni-uploader__item'));
      expect(
        itens.map((i) => i.querySelector('.uni-uploader__item-name')?.textContent?.trim()),
      ).toEqual(['Arquivo 2', 'Arquivo 1']);
      expect(itens[1].querySelector('.uni-uploader__item-meta')?.textContent).toBe(
        'PDF · 2,0 KB · enviado em 22/10/2026, 09:33',
      );
      expect(tela.textContent).not.toContain('.pdf');
    });

    it('o que o envio confirmou e a avaliação ainda não trouxe vem depois dos arquivos da avaliação, com o rótulo da confirmação', () => {
      envio.arquivos.set([{ ...CONFIRMADO, arquivoId: 'novo', rotulo: 'Arquivo 9' }]);
      const tela = montar({ arquivos: [CONFIRMADO] });

      const nomes = Array.from(tela.querySelectorAll('.uni-uploader__item-name')).map((n) =>
        n.textContent?.trim(),
      );
      expect(nomes).toEqual(['Arquivo 1', 'Arquivo 9']);
    });

    it('o botão Baixar leva o rótulo da API no nome acessível', () => {
      const tela = montar({ arquivos: [{ ...CONFIRMADO, rotulo: 'Arquivo 7' }] });

      expect(tela.querySelector('button[aria-label^="Baixar"]')?.getAttribute('aria-label')).toBe(
        'Baixar Arquivo 7 de Laudo médico',
      );
    });

    it('falha ao obter o acesso: mostra a mensagem com role alert', async () => {
      envio.baixar.mockResolvedValueOnce({ ok: false, mensagem: 'Arquivo não encontrado.' });
      const tela = montar({ arquivos: [CONFIRMADO] });

      baixar(tela).click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tela.querySelector('[role="alert"]')?.textContent).toContain(
        'Arquivo não encontrado.',
      );
    });

    it('o acesso que falha sem resposta também avisa o candidato', async () => {
      envio.baixar.mockRejectedValueOnce(new Error('rede'));
      const tela = montar({ arquivos: [CONFIRMADO] });

      baixar(tela).click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tela.querySelector('[role="alert"]')?.textContent).toContain(
        'Não foi possível baixar',
      );
    });

    it('imagem JPEG aparece com o rótulo JPG da zona de envio', () => {
      const tela = montar({ arquivos: [{ ...CONFIRMADO, tipoDeMidia: 'image/jpeg' }] });

      expect(tela.querySelector('.uni-uploader__item-meta')?.textContent).toMatch(/^JPG · /);
    });

    it('cliques repetidos enquanto o acesso é pedido disparam um download só', async () => {
      let terminar: (d: unknown) => void = () => undefined;
      envio.baixar.mockImplementationOnce(() => new Promise((resolve) => (terminar = resolve)));
      const tela = montar({ arquivos: [CONFIRMADO] });

      baixar(tela).click();
      baixar(tela).click();
      terminar({ ok: true });
      await fixture.whenStable();

      expect(envio.baixar).toHaveBeenCalledTimes(1);
    });
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
});

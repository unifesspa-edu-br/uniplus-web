import { TestBed } from '@angular/core/testing';
import { type AtoDoProcessoDto, SituacaoDoRegistroDoAto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { ArquivosDoAtoComponent } from './arquivos-do-ato.component';

type Documento = AtoDoProcessoDto['documentoPrincipal'];

function documento(id: string): Documento {
  return {
    documentoAPublicarId: id,
    nomeArquivo: `${id}.pdf`,
    nomeDeExibicao: null,
    tipoDeMidia: 'application/pdf',
    hashSha256: 'a'.repeat(64),
  };
}

function render(quantidadeDeAnexos: number, abrindo: string | null = null) {
  const fixture = TestBed.createComponent(ArquivosDoAtoComponent);
  const ato: AtoDoProcessoDto = {
    id: 'ato-1',
    tipoCodigo: 'AVISO',
    tipoNome: 'Aviso',
    numero: null,
    dataDoAto: '2027-01-10',
    publicadoEm: '2027-01-10T12:00:00Z',
    assinante: 'Reitoria',
    situacao: SituacaoDoRegistroDoAto.registrado,
    registradoEm: '2027-01-10T12:00:00Z',
    pendenciaAcimaDoLimiar: false,
    atoCorrigidoId: null,
    motivoDaCorrecao: null,
    politicaDeDivulgacaoConfirmada: true,
    documentoPrincipal: documento('principal'),
    anexos: Array.from({ length: quantidadeDeAnexos }, (_, i) => documento(`anexo-${i + 1}`)),
  };
  const abertos: string[] = [];
  fixture.componentInstance.abrir.subscribe((id) => abertos.push(id));
  fixture.componentRef.setInput('ato', ato);
  fixture.componentRef.setInput('abrindo', abrindo);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, abertos };
}

function titulos(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('.arquivos__titulo')).map(
    (t) => t.textContent?.trim() ?? '',
  );
}

describe('ArquivosDoAtoComponent', () => {
  it('agrupa os anexos sob um único título com a contagem, sem repetir o rótulo por linha', () => {
    const { el } = render(3);

    expect(titulos(el)).toEqual(['Documento principal', 'Anexos (3)']);
    expect(el.querySelectorAll('.arquivos__lista')[1].querySelectorAll('button')).toHaveLength(3);
    expect(el.querySelector('.arquivos__detalhe')).toBeNull();
  });

  it('nomeia cada lista pelo seu título e abre cada arquivo pelo próprio id', () => {
    const { el, abertos } = render(2);

    for (const lista of Array.from(el.querySelectorAll('.arquivos__lista'))) {
      const id = lista.getAttribute('aria-labelledby');
      expect(el.querySelector(`#${id}`)).not.toBeNull();
    }
    const botoes = Array.from(el.querySelectorAll('button'));
    expect(botoes.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Abrir o documento principal principal.pdf (abre em nova aba)',
      'Abrir o anexo anexo-1.pdf (abre em nova aba)',
      'Abrir o anexo anexo-2.pdf (abre em nova aba)',
    ]);
    botoes[2].click();
    expect(abertos).toEqual(['anexo-2']);
  });

  it('anuncia a espera só no arquivo pedido e trava os demais', () => {
    const { el } = render(1, 'anexo-1');
    const [principal, anexo] = Array.from(el.querySelectorAll('button'));

    expect(anexo.textContent?.trim()).toBe('Abrindo…');
    expect(anexo.getAttribute('aria-busy')).toBe('true');
    expect(principal.getAttribute('aria-busy')).toBeNull();
    expect(principal.disabled).toBe(true);
  });

  it('omite o grupo de anexos quando o ato não tem anexos', () => {
    const { el } = render(0);

    expect(titulos(el)).toEqual(['Documento principal']);
  });
});

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type {
  AusenteDoLoteDto,
  LoteDeNotasDoEnemDto,
  OcorrenciaDoLoteDto,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { LoteDeNotasComponent } from './lote-de-notas.component';

function ocorrencia(tipo: string, extra: Partial<OcorrenciaDoLoteDto> = {}): OcorrenciaDoLoteDto {
  return {
    tipo,
    inscricaoId: null,
    numeroDeInscricao: null,
    numerosDasLinhas: null,
    nomeDoCandidato: null,
    cpfMascarado: null,
    sexo: null,
    opcoesDeCurso: null,
    ...extra,
  };
}

function semNota(quantos: number): OcorrenciaDoLoteDto[] {
  return Array.from({ length: quantos }, (_, i) =>
    ocorrencia('INSCRITO_SEM_LINHA', {
      numeroDeInscricao: `INS-${String(i + 1).padStart(4, '0')}`,
    }),
  );
}

function lote(
  ocorrencias: OcorrenciaDoLoteDto[],
  ausentes: AusenteDoLoteDto[] | null = null,
): LoteDeNotasDoEnemDto {
  return { ocorrencias, ausentes } as unknown as LoteDeNotasDoEnemDto;
}

describe('LoteDeNotasComponent', () => {
  let fixture: ComponentFixture<LoteDeNotasComponent>;
  let host: HTMLElement;

  function abrir(dado: LoteDeNotasDoEnemDto): void {
    fixture = TestBed.createComponent(LoteDeNotasComponent);
    fixture.componentRef.setInput('lote', dado);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  }

  const abas = (): HTMLElement[] => Array.from(host.querySelectorAll('[role="tab"]'));
  const cabecalhos = (): string[] =>
    Array.from(host.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '');
  const linhas = (): HTMLElement[] => Array.from(host.querySelectorAll('tbody tr'));
  const celulas = (linha: HTMLElement): string[] =>
    Array.from(linha.children).map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim());
  const teclar = (aba: HTMLElement, key: string): void => {
    aba.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  it('a aba de linhas sem inscrito tem linha do arquivo, nome, sexo e CPF, com o CPF mascarado como veio', () => {
    abrir(
      lote([
        ocorrencia('LINHA_SEM_INSCRITO', {
          numerosDasLinhas: ['14'],
          nomeDoCandidato: 'Fernanda Laura Nicole Drumond',
          sexo: 'F',
          cpfMascarado: '***.836.371-**',
        }),
      ]),
    );

    expect(cabecalhos()).toEqual(['Linha do arquivo', 'Nome', 'Sexo', 'CPF']);
    expect(celulas(linhas()[0])).toEqual([
      '14',
      'Fernanda Laura Nicole Drumond',
      'Feminino',
      '***.836.371-**',
    ]);
  });

  it('as abas de inscrito mostram a segunda opção de curso sob a primeira', () => {
    abrir(
      lote([
        ocorrencia('INSCRITO_SEM_LINHA', {
          numeroDeInscricao: 'INS-0001',
          nomeDoCandidato: 'Diogo Bruno Filipe Souza',
          cpfMascarado: '***.836.371-**',
          opcoesDeCurso: [
            { ordem: '2', oferta: 'Medicina — Marabá' },
            { ordem: '1', oferta: 'Medicina — Xinguara' },
          ],
        }),
      ]),
    );

    const curso = celulas(linhas()[0])[2];
    expect(curso).toBe('Medicina — Xinguara 2ª opção: Medicina — Marabá');
  });

  it('dado ausente vira traço visual com "não informado" para o leitor de tela', () => {
    abrir(lote([ocorrencia('INSCRITO_SEM_LINHA', { numeroDeInscricao: 'INS-0001' })]));

    const [, candidato, curso, cpf] = Array.from(linhas()[0].children);
    for (const celula of [candidato, curso, cpf]) {
      expect(celula.querySelector('[aria-hidden="true"]')?.textContent).toBe('—');
      expect(celula.querySelector('.sr-only')?.textContent).toBe('não informado');
    }
  });

  it('o selo da aba mostra a contagem no formato pt-BR', () => {
    abrir(lote(semNota(1250)));

    expect(abas()[0].querySelector('.count-badge')?.textContent?.trim()).toBe('1.250');
  });

  it('mostra 20 por vez, oferece o restante e leva o foco à primeira linha que entrou', async () => {
    abrir(lote(semNota(45)));
    expect(linhas()).toHaveLength(20);
    const botao = (): HTMLButtonElement | undefined =>
      Array.from(host.querySelectorAll('button')).find((b) =>
        /Mostrar mais/.test(b.textContent ?? ''),
      );
    expect(botao()?.textContent?.trim()).toBe('Mostrar mais 20');

    botao()?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(linhas()).toHaveLength(40);
    expect(document.activeElement).toBe(linhas()[20].querySelector('th'));
    expect(botao()?.textContent?.trim()).toBe('Mostrar mais 5');

    botao()?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(linhas()).toHaveLength(45);
    expect(botao()).toBeUndefined();
  });

  it('setas, Home e End movem a seleção e o foco entre as abas', () => {
    abrir(
      lote([
        ocorrencia('INSCRITO_SEM_LINHA', { numeroDeInscricao: 'INS-0001' }),
        ocorrencia('LINHA_SEM_INSCRITO', { numerosDasLinhas: ['3'] }),
        ocorrencia('CONFLITO', { numeroDeInscricao: 'INS-0002', numerosDasLinhas: ['5'] }),
      ]),
    );
    const selecionada = (): string | null =>
      abas().find((a) => a.getAttribute('aria-selected') === 'true')?.id ?? null;
    expect(abas()).toHaveLength(3);

    teclar(abas()[0], 'ArrowRight');
    expect(selecionada()).toBe(abas()[1].id);
    expect(document.activeElement).toBe(abas()[1]);

    teclar(abas()[1], 'End');
    expect(selecionada()).toBe(abas()[2].id);

    teclar(abas()[2], 'ArrowRight');
    expect(selecionada()).toBe(abas()[0].id);

    teclar(abas()[0], 'ArrowLeft');
    expect(selecionada()).toBe(abas()[2].id);

    teclar(abas()[2], 'Home');
    expect(selecionada()).toBe(abas()[0].id);
  });
});

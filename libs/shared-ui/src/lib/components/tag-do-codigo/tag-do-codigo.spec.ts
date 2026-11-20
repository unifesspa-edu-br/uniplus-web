import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import {
  TagDoCodigoComponent,
  type CodigoComRotulo,
  type VariantesDosCodigos,
} from './tag-do-codigo';

// Enum e não união de literais: o gerador do cliente da API (--enum) emite enum para os códigos, e
// é desse tipo que o teste de mapa incompleto precisa.
enum SituacaoDaInscricaoCodigo {
  aberta = 'aberta',
  encerrada = 'encerrada',
  suspensa = 'suspensa',
}

const VARIANTES: VariantesDosCodigos<SituacaoDaInscricaoCodigo> = {
  [SituacaoDaInscricaoCodigo.aberta]: 'success',
  [SituacaoDaInscricaoCodigo.encerrada]: 'neutral',
  [SituacaoDaInscricaoCodigo.suspensa]: 'danger',
};
const ABERTA: CodigoComRotulo<SituacaoDaInscricaoCodigo> = {
  codigo: SituacaoDaInscricaoCodigo.aberta,
  rotulo: 'Recebendo inscrições',
};
const SUSPENSA: CodigoComRotulo<SituacaoDaInscricaoCodigo> = {
  codigo: SituacaoDaInscricaoCodigo.suspensa,
  rotulo: 'Pausada pela comissão',
};

describe('TagDoCodigoComponent', () => {
  let fixture: ComponentFixture<TagDoCodigoComponent<SituacaoDaInscricaoCodigo>>;

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const etiqueta = (): HTMLElement => {
    const encontrada = raiz().querySelector<HTMLElement>('.tag');
    if (encontrada === null) throw new Error('etiqueta ausente');
    return encontrada;
  };
  const variante = (): string | undefined =>
    [...etiqueta().classList].find((classe) => classe.startsWith('tag--'));

  function mostrar(
    valor: CodigoComRotulo<string>,
    variantes: VariantesDosCodigos<SituacaoDaInscricaoCodigo> = VARIANTES,
  ): void {
    fixture.componentRef.setInput('valor', valor);
    fixture.componentRef.setInput('variantes', variantes);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TagDoCodigoComponent] });
    fixture = TestBed.createComponent(TagDoCodigoComponent<SituacaoDaInscricaoCodigo>);
  });

  it('mostra o rótulo que a API devolveu, nunca o código', () => {
    mostrar(ABERTA);

    expect(etiqueta().textContent?.trim()).toBe(ABERTA.rotulo);
    expect(raiz().textContent).not.toContain(ABERTA.codigo);
  });

  it('a cor vem do mapa de variantes, pelo código', () => {
    mostrar(ABERTA);
    expect(variante()).toBe('tag--success');

    mostrar(SUSPENSA);
    expect(variante()).toBe('tag--danger');
  });

  it('o mapa decide a cor: o mesmo código muda de cor quando o mapa muda', () => {
    mostrar(ABERTA, { ...VARIANTES, [SituacaoDaInscricaoCodigo.aberta]: 'warning' });

    expect(variante()).toBe('tag--warning');
  });

  it('o código que o mapa não conhece aparece em cor neutra, com o rótulo recebido', () => {
    mostrar({ codigo: 'reaberta', rotulo: 'Reaberta pela comissão' });

    expect(variante()).toBe('tag--neutral');
    expect(etiqueta().textContent?.trim()).toBe('Reaberta pela comissão');
  });

  it('um código igual ao nome de um recurso interno da linguagem (constructor) também aparece em cor neutra', () => {
    mostrar({ codigo: 'constructor', rotulo: 'Construtor' });

    expect(variante()).toBe('tag--neutral');
    expect(etiqueta().textContent?.trim()).toBe('Construtor');
  });

  it('a cor não é o único sinal: cada etiqueta diz a situação pelo rótulo', () => {
    mostrar(ABERTA);
    const rotuloDaPrimeira = etiqueta().textContent?.trim();
    mostrar(SUSPENSA);
    const rotuloDaSegunda = etiqueta().textContent?.trim();

    expect([rotuloDaPrimeira, rotuloDaSegunda]).toEqual([ABERTA.rotulo, SUSPENSA.rotulo]);
  });

  it('a etiqueta é estática: não declara função nem região de aviso', () => {
    mostrar(SUSPENSA);

    expect(raiz().hasAttribute('role')).toBe(false);
    expect(raiz().querySelector('[role], [aria-live]')).toBeNull();
  });
});

describe('VariantesDosCodigos', () => {
  const mapaSemUmCodigo = {
    [SituacaoDaInscricaoCodigo.aberta]: 'success',
    [SituacaoDaInscricaoCodigo.encerrada]: 'neutral',
  } as const;
  const mapaCompleto = {
    ...mapaSemUmCodigo,
    [SituacaoDaInscricaoCodigo.suspensa]: 'danger',
  } as const;

  it('o mapa a que falta um código do tipo não é um mapa dos códigos', () => {
    expectTypeOf(mapaSemUmCodigo).not.toExtend<VariantesDosCodigos<SituacaoDaInscricaoCodigo>>();
  });

  it('o mapa com todos os códigos do tipo é um mapa dos códigos', () => {
    expectTypeOf(mapaCompleto).toExtend<VariantesDosCodigos<SituacaoDaInscricaoCodigo>>();
  });
});

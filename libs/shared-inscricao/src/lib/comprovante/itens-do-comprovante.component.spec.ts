import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { ItemDoComprovanteDto } from '@uniplus/shared-data/selecao';

import { ItensDoComprovanteComponent } from './itens-do-comprovante.component';

const item = (
  rotulo: string,
  tipo: string,
  valor: unknown,
  componente = 'padrao',
): ItemDoComprovanteDto => ({ rotulo, descricao: '', tipo, componente, valor: valor as never });

async function montar(itens: readonly ItemDoComprovanteDto[]): Promise<HTMLElement> {
  const fixture: ComponentFixture<ItensDoComprovanteComponent> = TestBed.createComponent(
    ItensDoComprovanteComponent,
  );
  fixture.componentRef.setInput('itens', itens);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const valorDe = (tela: HTMLElement, rotulo: string): string | undefined =>
  Array.from(tela.querySelectorAll('dl > div'))
    .find((d) => d.querySelector('dt')?.textContent?.trim() === rotulo)
    ?.querySelector('dd')
    ?.textContent?.trim()
    .replace(/\s+/g, ' ');

const ITENS_DE_TIPOS_DIFERENTES = [
  item('Aceita ser contatado', 'booleano', true),
  item('Data de nascimento', 'data', '2001-03-09'),
  item('Cor ou raça', 'opcao', { codigo: 'PARDA', rotulo: 'Parda' }),
];

const ITEM_DE_ENDERECO = item('Endereço', 'endereco', {
  logradouro: 'Folha 31',
  numero: '10',
  municipio: 'Marabá',
  uf: 'PA',
  cep: '68500-000',
});

describe('ItensDoComprovanteComponent', () => {
  it('mantém a ordem e o rótulo da API e formata o valor pelo tipo', async () => {
    const tela = await montar(ITENS_DE_TIPOS_DIFERENTES);

    expect(Array.from(tela.querySelectorAll('dt')).map((dt) => dt.textContent?.trim())).toEqual([
      'Aceita ser contatado',
      'Data de nascimento',
      'Cor ou raça',
    ]);
    expect(valorDe(tela, 'Aceita ser contatado')).toBe('Sim');
    expect(valorDe(tela, 'Data de nascimento')).toBe('09/03/2001');
    expect(valorDe(tela, 'Cor ou raça')).toBe('Parda');
  });

  it('o endereço sai em linhas e o item sem valor diz que não foi informado', async () => {
    const tela = await montar([ITEM_DE_ENDERECO, item('Complemento', 'texto', null)]);

    const linhas = Array.from(tela.querySelectorAll('.resposta__linha')).map((l) =>
      l.textContent?.trim(),
    );
    expect(linhas).toEqual(['Folha 31, 10', 'Marabá/PA', 'CEP 68500-000']);
    expect(valorDe(tela, 'Complemento')).toBe('Não informado');
  });
});

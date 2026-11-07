import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ResolucaoDeVinculo } from '@uniplus/shared-core/http';
import { LocalOfertaDto, TipoLocalOferta } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocaisOfertaListaComponent } from './locais-oferta-lista.component';

const local: LocalOfertaDto = {
  id: 'l1',
  tipo: TipoLocalOferta.poloEad,
  codigoEmec: null,
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '',
};

describe('LocaisOfertaListaComponent', () => {
  let fixture: ComponentFixture<LocaisOfertaListaComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LocaisOfertaListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(LocaisOfertaListaComponent);
  });

  function montar(locais: readonly LocalOfertaDto[], entradas: Record<string, unknown> = {}): void {
    const padrao: Record<string, unknown> = {
      locais,
      carregando: false,
      gravando: false,
      mensagemDeErro: null,
      temAnterior: true,
      temProximo: true,
      leituras: [],
      resolucoes: new Map<string, ResolucaoDeVinculo>(),
      localAfetadoId: null,
      andamento: '',
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas }))
      fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];
  const acionaveis = (): HTMLButtonElement[] =>
    botoes().filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true');
  const botao = (rotulo: string): HTMLButtonElement => {
    const achado = botoes().find(
      (b) => b.getAttribute('aria-label')?.startsWith(rotulo) || b.textContent?.includes(rotulo),
    );
    expect(achado, rotulo).toBeDefined();
    return achado as HTMLButtonElement;
  };
  const aguardarFoco = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('durante a gravação, deixa desabilitado todo botão, inclusive o do estado vazio e a paginação', () => {
    montar([local], { gravando: true });
    expect(botoes().length).toBeGreaterThanOrEqual(5);
    expect(acionaveis()).toEqual([]);
    montar([], { gravando: true });
    expect(acionaveis()).toEqual([]);
  });

  it('durante a carga, deixa as ações indisponíveis', () => {
    montar([local], { carregando: true });
    expect(acionaveis()).toEqual([]);
  });

  it('emite cadastro, edição e remoção quando disponível', () => {
    montar([local]);
    const emitidos: string[] = [];
    fixture.componentInstance.cadastrar.subscribe(() => emitidos.push('cadastrar'));
    fixture.componentInstance.editar.subscribe((l) => emitidos.push(`editar:${l.id}`));
    fixture.componentInstance.remover.subscribe((l) => emitidos.push(`remover:${l.id}`));
    botao('Novo local').click();
    botao('Editar').click();
    botao('Remover').click();
    expect(emitidos).toEqual(['cadastrar', 'editar:l1', 'remover:l1']);
  });

  it('mostra a cidade do endereço, o traço sem cidade e o rótulo do tipo desconhecido', () => {
    montar([
      { ...local, cidade: null } as unknown as LocalOfertaDto,
      {
        ...local,
        id: 'l2',
        tipo: 'invalido' as TipoLocalOferta,
        endereco: { cidade: { codigoIbge: '1', nome: 'Altamira', uf: 'PA' } } as never,
      },
    ]);
    const texto = raiz().textContent ?? '';
    expect(texto).toContain('—');
    expect(texto).toContain('Altamira — PA');
    expect(texto).toContain('invalido');
  });

  it('mostra o andamento só na linha afetada', () => {
    montar([local, { ...local, id: 'l2' }], { localAfetadoId: 'l2', andamento: 'Removendo…' });
    const andamentos = raiz().querySelectorAll('td span[aria-hidden="true"]');
    expect(andamentos).toHaveLength(1);
    expect(andamentos[0].closest('tr')).toBe(raiz().querySelectorAll('tbody tr')[1]);
  });

  it('com erro de carga, não mostra o estado vazio', () => {
    montar([], { mensagemDeErro: 'Falha' });
    expect(raiz().querySelector('ui-empty-state')).toBeNull();
  });

  const gravar = (): void => {
    fixture.componentRef.setInput('gravando', true);
    fixture.detectChanges();
  };
  const terminarGravacao = async (): Promise<void> => {
    fixture.componentRef.setInput('gravando', false);
    fixture.detectChanges();
    await aguardarFoco();
  };
  const linha = (id: string): HTMLElement =>
    raiz().querySelector(`tr[data-local-id="${id}"]`) as HTMLElement;
  const acaoDaLinha = (id: string, verbo: 'Editar' | 'Remover'): HTMLButtonElement =>
    linha(id).querySelector(`button[aria-label^="${verbo} local"]`) as HTMLButtonElement;

  it('terminada a gravação, devolve o foco ao botão da linha que a originou', async () => {
    montar([local]);
    botao('Editar').click();
    gravar();
    botao('Editar').blur();
    await terminarGravacao();
    expect(document.activeElement).toBe(botao('Editar'));
  });

  it('devolve o foco ao botão da linha mesmo que a recarga troque o tipo e o nome da ação', async () => {
    montar([local]);
    botao('Editar').click();
    gravar();
    fixture.componentRef.setInput('locais', [{ ...local, tipo: TipoLocalOferta.campusForaDeSede }]);
    await terminarGravacao();
    expect(acaoDaLinha('l1', 'Editar').getAttribute('aria-label')).toContain('Campus fora de sede');
    expect(document.activeElement).toBe(acaoDaLinha('l1', 'Editar'));
  });

  it('com dois locais de nome acessível igual, devolve o foco ao da linha acionada', async () => {
    montar([local, { ...local, id: 'l2' }]);
    expect(acaoDaLinha('l1', 'Remover').getAttribute('aria-label')).toBe(
      acaoDaLinha('l2', 'Remover').getAttribute('aria-label'),
    );
    acaoDaLinha('l2', 'Remover').click();
    gravar();
    await terminarGravacao();
    expect(document.activeElement).toBe(acaoDaLinha('l2', 'Remover'));
  });

  it('devolve o foco à ação acionada, não a outra ação da mesma linha', async () => {
    montar([local]);
    acaoDaLinha('l1', 'Remover').click();
    gravar();
    await terminarGravacao();
    expect(document.activeElement).toBe(acaoDaLinha('l1', 'Remover'));
  });

  it('terminada a gravação, devolve o foco ao botão do cabeçalho quando o cadastro a originou', async () => {
    montar([local]);
    botao('Novo local').click();
    gravar();
    await terminarGravacao();
    expect(document.activeElement).toBe(botao('Novo local'));
  });

  it('sem o botão da linha, leva o foco ao título da lista', async () => {
    montar([local]);
    botao('Remover').click();
    gravar();
    fixture.componentRef.setInput('locais', []);
    await terminarGravacao();
    expect(document.activeElement).toBe(raiz().querySelector('#cfg-locais-list-title'));
  });

  it('não tira o foco de quem o levou a outro ponto durante a gravação', async () => {
    montar([local]);
    botao('Editar').click();
    gravar();
    const outro = document.createElement('button');
    document.body.append(outro);
    outro.focus();
    await terminarGravacao();
    expect(document.activeElement).toBe(outro);
    outro.remove();
  });

  it('o foco que ficou num botão de sobreposição fechada é tomado pela linha acionada', async () => {
    montar([local]);
    botao('Editar').click();
    gravar();
    const sobreposicao = document.createElement('dialog');
    const dentro = document.createElement('button');
    sobreposicao.append(dentro);
    document.body.append(sobreposicao);
    dentro.focus();
    await terminarGravacao();
    expect(document.activeElement).toBe(acaoDaLinha('l1', 'Editar'));
    sobreposicao.remove();
  });
});

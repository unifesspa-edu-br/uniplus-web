import { TestBed } from '@angular/core/testing';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import { AtividadeDaPessoa } from './atividade-da-pessoa.service';

describe('AtividadeDaPessoa', () => {
  let agora: number;
  let atividade: AtividadeDaPessoa;

  beforeEach(() => {
    agora = 1_000;
    TestBed.configureTestingModule({
      providers: [{ provide: RELOGIO, useValue: () => new Date(agora) }],
    });
    atividade = TestBed.inject(AtividadeDaPessoa);
  });

  it('carregar a página não conta como atividade', () => {
    expect(atividade.houveDesde(1_000)).toBe(false);
  });

  it('não há atividade depois de um instante posterior ao início', () => {
    expect(atividade.houveDesde(2_000)).toBe(false);
  });

  it.each(['keydown', 'pointerdown', 'wheel'])('conta %s como atividade', (evento) => {
    agora = 5_000;

    document.dispatchEvent(new Event(evento));

    expect(atividade.houveDesde(5_000)).toBe(true);
  });

  it('não conta o movimento do ponteiro', () => {
    agora = 5_000;

    document.dispatchEvent(new Event('pointermove'));

    expect(atividade.houveDesde(5_000)).toBe(false);
  });

  it('proxima() resolve só quando a pessoa age', async () => {
    let resolvida = false;
    const espera = atividade.proxima().then(() => (resolvida = true));
    await Promise.resolve();
    expect(resolvida).toBe(false);

    document.dispatchEvent(new Event('keydown'));
    await espera;

    expect(resolvida).toBe(true);
  });
});

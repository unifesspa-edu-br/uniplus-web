import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';

import { NotificationHostComponent } from './notification-host';

export interface HostMontado {
  readonly fixture: ComponentFixture<NotificationHostComponent>;
  readonly service: NotificationService;
  readonly raiz: HTMLElement;
}

/** Simula a tela: compacta (celular, paisagem ou zoom alto) ou normal. */
export function simularTela(compacta: boolean): void {
  window.matchMedia = ((consulta: string) =>
    ({
      matches: compacta,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

/** Monta o host anexado ao documento, para o foco funcionar. */
export function montarHost(compacta: boolean): HostMontado {
  simularTela(compacta);
  TestBed.configureTestingModule({ imports: [NotificationHostComponent] });
  const service = TestBed.inject(NotificationService);
  const fixture = TestBed.createComponent(NotificationHostComponent);
  document.body.append(fixture.nativeElement);
  fixture.detectChanges();
  return { fixture, service, raiz: fixture.nativeElement };
}

/** Inclui avisos fixos (sem prazo) de títulos distintos, para não se agruparem. */
export function incluirAvisos(service: NotificationService, quantidade: number): void {
  for (let i = 1; i <= quantidade; i++) {
    service.info(`Aviso ${i}`, `Detalhe ${i}`, { persistent: true });
  }
}

/** Acha o elemento ou falha o teste com a mensagem do seletor. */
export function achar<T extends HTMLElement = HTMLElement>(raiz: ParentNode, seletor: string): T {
  const elemento = raiz.querySelector<T>(seletor);
  if (elemento === null) throw new Error(`Elemento não encontrado: ${seletor}`);
  return elemento;
}

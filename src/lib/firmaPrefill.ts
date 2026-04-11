/**
 * Einmaliger Deep-Link für das FirmaPanel.
 * Ermöglicht das gezielte Öffnen des Gründen-Tabs mit vorausgewähltem Typ.
 */

interface FirmaPrefill {
  /** Firmen-Typ-Code (z.B. 'transport') der vorausgewählt werden soll */
  typeCode: string;
}

let _prefill: FirmaPrefill | null = null;

export function setFirmaPrefill(data: FirmaPrefill) {
  _prefill = data;
}

/** Liest das Prefill einmal und löscht es danach */
export function consumeFirmaPrefill(): FirmaPrefill | null {
  const data = _prefill;
  _prefill = null;
  return data;
}

function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ") // keep only alphanumeric and space
    .trim();
}

const DIVIPOLA_CODES: Record<string, string> = {
  AMAZONAS: "91",
  ANTIOQUIA: "05",
  ARAUCA: "81",
  ATLANTICO: "08",
  BOLIVAR: "13",
  BOYACA: "15",
  CALDAS: "17",
  CAQUETA: "18",
  CASANARE: "85",
  CAUCA: "19",
  CESAR: "20",
  CHOCO: "27",
  CORDOBA: "23",
  CUNDINAMARCA: "25",
  GUAINIA: "94",
  GUAVIARE: "95",
  HUILA: "41",
  "LA GUAJIRA": "44",
  MAGDALENA: "47",
  META: "50",
  NARINO: "52",
  "NORTE DE SANTANDER": "54",
  PUTUMAYO: "86",
  QUINDIO: "63",
  RISARALDA: "66",
  "SAN ANDRES Y PROVIDENCIA": "88",
  "SAN ANDRES PROVIDENCIA Y SANTA CATALINA": "88",
  SANTANDER: "68",
  SUCRE: "70",
  TOLIMA: "73",
  "VALLE DEL CAUCA": "76",
  VAUPES: "97",
  VICHADA: "99",
  "BOGOTA D C": "11",
  BOGOTA: "11",
  "BOGOTA DC": "11",
  "DISTRITO CAPITAL": "11",
};

// Valid set of DIVIPOLA department codes in Colombia
const VALID_CODES = new Set(Object.values(DIVIPOLA_CODES));

/**
 * Normalizes a department name and returns its 2-digit DANE DIVIPOLA code.
 * If the input is already a valid 2-digit DIVIPOLA code, it returns it directly.
 */
export function getDepartmentCode(department: string | null | undefined): string | null {
  if (!department) return null;
  
  const trimmed = String(department).trim();
  if (VALID_CODES.has(trimmed)) {
    return trimmed;
  }
  
  const normalized = normalizeString(trimmed);
  return DIVIPOLA_CODES[normalized] || null;
}

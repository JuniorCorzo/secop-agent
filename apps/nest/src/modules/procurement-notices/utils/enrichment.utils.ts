export function cleanNit(nit: string | null | undefined): string | null {
  if (!nit) return null;
  const cleaned = nit.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned === "" ? null : cleaned;
}

function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ") // keep only alphanumeric and space
    .trim();
}

const DEPARTMENT_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  AMAZONAS: { latitude: -1.44139, longitude: -71.57222 },
  ANTIOQUIA: { latitude: 6.25184, longitude: -75.56359 },
  ARAUCA: { latitude: 7.0847, longitude: -70.7591 },
  ATLANTICO: { latitude: 10.96854, longitude: -74.78132 },
  BOLIVAR: { latitude: 10.39972, longitude: -75.51444 },
  BOYACA: { latitude: 5.53528, longitude: -73.36778 },
  CALDAS: { latitude: 5.06889, longitude: -75.51738 },
  CAQUETA: { latitude: 1.61438, longitude: -75.60623 },
  CASANARE: { latitude: 5.33775, longitude: -72.39586 },
  CAUCA: { latitude: 2.44111, longitude: -76.60639 },
  CESAR: { latitude: 10.46314, longitude: -73.25322 },
  CHOCO: { latitude: 5.69188, longitude: -76.6587 },
  CORDOBA: { latitude: 8.74798, longitude: -75.88143 },
  CUNDINAMARCA: { latitude: 4.711, longitude: -74.0721 },
  GUAINIA: { latitude: 3.8653, longitude: -67.9239 },
  GUAVIARE: { latitude: 2.5729, longitude: -72.6459 },
  HUILA: { latitude: 2.9273, longitude: -75.28189 },
  "LA GUAJIRA": { latitude: 11.54444, longitude: -72.90722 },
  MAGDALENA: { latitude: 11.24079, longitude: -74.19904 },
  META: { latitude: 4.142, longitude: -73.6266 },
  NARINO: { latitude: 1.21361, longitude: -77.28111 },
  "NORTE DE SANTANDER": { latitude: 7.89391, longitude: -72.50782 },
  PUTUMAYO: { latitude: 1.1492, longitude: -76.6471 },
  QUINDIO: { latitude: 4.53389, longitude: -75.68111 },
  RISARALDA: { latitude: 4.81333, longitude: -75.69611 },
  "SAN ANDRES Y PROVIDENCIA": { latitude: 12.58472, longitude: -81.70056 },
  "SAN ANDRES PROVIDENCIA Y SANTA CATALINA": { latitude: 12.58472, longitude: -81.70056 },
  SANTANDER: { latitude: 7.12539, longitude: -73.1198 },
  SUCRE: { latitude: 9.30472, longitude: -75.39778 },
  TOLIMA: { latitude: 4.43889, longitude: -75.23222 },
  "VALLE DEL CAUCA": { latitude: 3.43722, longitude: -76.5225 },
  VAUPES: { latitude: 1.1984, longitude: -70.1733 },
  VICHADA: { latitude: 6.1885, longitude: -67.4858 },
  "BOGOTA D C": { latitude: 4.711, longitude: -74.0721 },
  BOGOTA: { latitude: 4.711, longitude: -74.0721 },
  "BOGOTA DC": { latitude: 4.711, longitude: -74.0721 },
  "DISTRITO CAPITAL": { latitude: 4.711, longitude: -74.0721 },
};

export function geocodeDepartment(department: string | null | undefined): { latitude: number | null; longitude: number | null } {
  if (!department) {
    return { latitude: null, longitude: null };
  }
  const normalized = normalizeString(department);
  const coords = DEPARTMENT_COORDINATES[normalized];
  if (!coords) {
    return { latitude: null, longitude: null };
  }
  return coords;
}

export function calculateMetrics(
  pubDate: Date | string | null | undefined,
  deadlineDate: Date | string | null | undefined,
  value: number | string | null | undefined,
): { executionDurationDays: number | null; valuePerDay: number | null } {
  if (!pubDate || !deadlineDate) {
    return { executionDurationDays: null, valuePerDay: null };
  }

  const start = new Date(pubDate);
  const end = new Date(deadlineDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { executionDurationDays: null, valuePerDay: null };
  }

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { executionDurationDays: null, valuePerDay: null };
  }

  let numValue: number | null = null;
  if (value !== null && value !== undefined) {
    numValue = typeof value === "number" ? value : Number(value);
  }

  if (numValue === null || isNaN(numValue) || numValue < 0) {
    return { executionDurationDays: diffDays, valuePerDay: null };
  }

  if (diffDays === 0) {
    return { executionDurationDays: diffDays, valuePerDay: null };
  }

  const valPerDay = Number((numValue / diffDays).toFixed(2));
  return {
    executionDurationDays: diffDays,
    valuePerDay: valPerDay,
  };
}

export interface EnrichmentResult {
  latitude: number | null;
  longitude: number | null;
  executionDurationDays: number | null;
  valuePerDay: number | null;
  entityNit: string | null;
  awardedContractorNit: string | null;
  currency: string | null;
}

export function enrichRecord(record: {
  department?: string | null;
  publicationDate?: Date | string | null;
  deadlineDate?: Date | string | null;
  value?: number | string | null;
  entityNit?: string | null;
  awardedContractorNit?: string | null;
  currency?: string | null;
}): EnrichmentResult {
  const geo = geocodeDepartment(record.department);
  const metrics = calculateMetrics(record.publicationDate, record.deadlineDate, record.value);
  const cleanEntityNit = cleanNit(record.entityNit);
  const cleanAwardedContractorNit = cleanNit(record.awardedContractorNit);

  let normalizedCurrency = record.currency ? record.currency.trim().toUpperCase() : null;
  if (normalizedCurrency === "") normalizedCurrency = null;

  return {
    latitude: geo.latitude,
    longitude: geo.longitude,
    executionDurationDays: metrics.executionDurationDays,
    valuePerDay: metrics.valuePerDay,
    entityNit: cleanEntityNit,
    awardedContractorNit: cleanAwardedContractorNit,
    currency: normalizedCurrency,
  };
}

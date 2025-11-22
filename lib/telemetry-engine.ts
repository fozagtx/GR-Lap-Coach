import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import type {
  TelemetryRow,
  ParsedLap,
  Sector,
  SectorStats,
  PerfectLapResult,
} from '@/types/telemetry';

const COTA_SECTORS = [
  { name: 'S1', start: 0, end: 1000 },
  { name: 'S2', start: 1000, end: 2200 },
  { name: 'S3', start: 2200, end: 3500 },
  { name: 'S4', start: 3500, end: Infinity },
];

const DRAFTING_SPEED_THRESHOLD = 162;
const LAP_RESET_HIGH_THRESHOLD = 3000;
const LAP_RESET_LOW_THRESHOLD = 200;

function parseTelemetryCSV(filePath: string): TelemetryRow[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  const parseResult = Papa.parse<any>(fileContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  if (parseResult.errors.length > 0) {
    console.warn('CSV parsing warnings:', parseResult.errors);
  }

  return parseResult.data.map((row: any) => ({
    timestamp: Number(row.timestamp) || 0,
    Laptrigger_lapdist_dls: Number(row.Laptrigger_lapdist_dls) || 0,
    Speed: Number(row.Speed) || 0,
    Steering_Angle: Number(row.Steering_Angle) || 0,
    pbrake_f: Number(row.pbrake_f) || 0,
    aps: Number(row.aps) || 0,
  }));
}

function detectLaps(data: TelemetryRow[]): ParsedLap[] {
  const laps: ParsedLap[] = [];
  let currentLapStart = 0;
  let lapNumber = 1;

  for (let i = 1; i < data.length; i++) {
    const prevDistance = data[i - 1].Laptrigger_lapdist_dls;
    const currDistance = data[i].Laptrigger_lapdist_dls;

    if (prevDistance > LAP_RESET_HIGH_THRESHOLD && currDistance < LAP_RESET_LOW_THRESHOLD) {
      const lapData = data.slice(currentLapStart, i);

      if (lapData.length > 10) {
        const startTime = lapData[0].timestamp;
        const endTime = lapData[lapData.length - 1].timestamp;
        const lapTime = endTime - startTime;

        laps.push({
          lapNumber,
          startIndex: currentLapStart,
          endIndex: i - 1,
          data: lapData,
          lapTime,
        });

        lapNumber++;
      }

      currentLapStart = i;
    }
  }

  if (currentLapStart < data.length - 1) {
    const lapData = data.slice(currentLapStart);
    if (lapData.length > 10) {
      const startTime = lapData[0].timestamp;
      const endTime = lapData[lapData.length - 1].timestamp;
      const lapTime = endTime - startTime;

      laps.push({
        lapNumber,
        startIndex: currentLapStart,
        endIndex: data.length - 1,
        data: lapData,
        lapTime,
      });
    }
  }

  return laps;
}

function extractSector(
  lap: ParsedLap,
  sectorDef: { name: string; start: number; end: number }
): Sector | null {
  const sectorData = lap.data.filter(
    (row) =>
      row.Laptrigger_lapdist_dls >= sectorDef.start &&
      row.Laptrigger_lapdist_dls < sectorDef.end
  );

  if (sectorData.length < 2) {
    return null;
  }

  const startTime = sectorData[0].timestamp;
  const endTime = sectorData[sectorData.length - 1].timestamp;
  const sectorTime = endTime - startTime;

  const maxSpeed = Math.max(...sectorData.map((row) => row.Speed));

  return {
    name: sectorDef.name,
    distanceStart: sectorDef.start,
    distanceEnd: sectorDef.end,
    time: sectorTime,
    data: sectorData,
    lapNumber: lap.lapNumber,
    maxSpeed,
  };
}

function isCornerSector(sectorName: string): boolean {
  return sectorName !== 'S1';
}

function isDrafting(sector: Sector): boolean {
  return sector.maxSpeed > DRAFTING_SPEED_THRESHOLD && isCornerSector(sector.name);
}

export function synthesizePerfectLap(trackId: string): PerfectLapResult {
  const csvPath = path.join(process.cwd(), 'public', 'data', `${trackId}.csv`);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`Telemetry file not found: ${trackId}.csv`);
  }

  const telemetryData = parseTelemetryCSV(csvPath);

  if (telemetryData.length === 0) {
    throw new Error('No telemetry data found in CSV file');
  }

  const laps = detectLaps(telemetryData);

  if (laps.length === 0) {
    throw new Error('No valid laps detected in telemetry data');
  }

  const bestSectors: Sector[] = [];
  const sectorStats: SectorStats[] = [];

  for (const sectorDef of COTA_SECTORS) {
    let bestSector: Sector | null = null;

    for (const lap of laps) {
      const sector = extractSector(lap, sectorDef);

      if (!sector || isDrafting(sector)) {
        continue;
      }

      if (!bestSector || sector.time < bestSector.time) {
        bestSector = sector;
      }
    }

    if (bestSector) {
      bestSectors.push(bestSector);

      const allSectorTimes = laps
        .map((lap) => extractSector(lap, sectorDef))
        .filter((s): s is Sector => s !== null && !isDrafting(s))
        .map((s) => s.time);

      const avgTime = allSectorTimes.reduce((a, b) => a + b, 0) / allSectorTimes.length;
      const timeGain = avgTime - bestSector.time;

      const avgSpeed =
        bestSector.data.reduce((sum, row) => sum + row.Speed, 0) / bestSector.data.length;

      sectorStats.push({
        sectorName: bestSector.name,
        bestTime: bestSector.time,
        lapNumber: bestSector.lapNumber,
        timeGain,
        avgSpeed,
      });
    }
  }

  if (bestSectors.length === 0) {
    throw new Error('Could not find any valid sectors');
  }

  const theoreticalTime = bestSectors.reduce((sum, sector) => sum + sector.time, 0);

  const chartData: Array<{ distance: number; speed: number; sector: string }> = [];

  for (const sector of bestSectors) {
    for (const row of sector.data) {
      chartData.push({
        distance: row.Laptrigger_lapdist_dls,
        speed: row.Speed,
        sector: sector.name,
      });
    }
  }

  return {
    theoreticalTime,
    chartData,
    sectorStats,
    bestSectors,
  };
}

export function formatLapTime(timeInSeconds: number): string {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const milliseconds = Math.floor((timeInSeconds % 1) * 1000);

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

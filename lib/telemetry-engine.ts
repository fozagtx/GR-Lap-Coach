import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import type {
  TelemetryRow,
  ParsedLap,
  Sector,
  SectorStats,
  PerfectLapResult,
  ConsistencyMetrics,
  ImprovementArea,
  BrakingZone,
  AccelerationZone,
  CornerAnalysis,
  SpeedDeficit,
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

function analyzeConsistency(laps: ParsedLap[]): ConsistencyMetrics {
  const lapTimes = laps.map((lap) => lap.lapTime);
  const avgLapTime = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length;
  const bestLapTime = Math.min(...lapTimes);
  const worstLapTime = Math.max(...lapTimes);

  const variance =
    lapTimes.reduce((sum, time) => sum + Math.pow(time - avgLapTime, 2), 0) / lapTimes.length;
  const stdDeviation = Math.sqrt(variance);

  const lapTimeVariation = lapTimes.map((time) => time - bestLapTime);

  const consistencyScore = Math.max(0, Math.min(100, 100 - stdDeviation * 10));

  return {
    avgLapTime,
    bestLapTime,
    worstLapTime,
    stdDeviation,
    lapTimeVariation,
    consistencyScore,
  };
}

function analyzeBrakingZones(laps: ParsedLap[]): BrakingZone[] {
  const brakingZones: BrakingZone[] = [];

  for (const lap of laps) {
    let inBrakingZone = false;
    let zoneStartIndex = 0;

    for (let i = 0; i < lap.data.length; i++) {
      const row = lap.data[i];
      const isBraking = row.pbrake_f > 0.3;

      if (isBraking && !inBrakingZone) {
        zoneStartIndex = i;
        inBrakingZone = true;
      } else if (!isBraking && inBrakingZone) {
        if (i - zoneStartIndex > 3) {
          const zoneData = lap.data.slice(zoneStartIndex, i);
          const entrySpeed = zoneData[0].Speed;
          const exitSpeed = zoneData[zoneData.length - 1].Speed;
          const avgBrakePressure =
            zoneData.reduce((sum, r) => sum + r.pbrake_f, 0) / zoneData.length;
          const distance = zoneData[Math.floor(zoneData.length / 2)].Laptrigger_lapdist_dls;

          const sector = COTA_SECTORS.find((s) => distance >= s.start && distance < s.end);

          brakingZones.push({
            sector: sector?.name || 'Unknown',
            distance,
            entrySpeed,
            exitSpeed,
            brakePressure: avgBrakePressure,
            lapNumber: lap.lapNumber,
          });
        }
        inBrakingZone = false;
      }
    }
  }

  return brakingZones;
}

function analyzeAccelerationZones(laps: ParsedLap[]): AccelerationZone[] {
  const accelZones: AccelerationZone[] = [];

  for (const lap of laps) {
    let inAccelZone = false;
    let zoneStartIndex = 0;

    for (let i = 0; i < lap.data.length; i++) {
      const row = lap.data[i];
      const isAccelerating = row.aps > 0.7 && row.pbrake_f < 0.1;

      if (isAccelerating && !inAccelZone) {
        zoneStartIndex = i;
        inAccelZone = true;
      } else if (!isAccelerating && inAccelZone) {
        if (i - zoneStartIndex > 3) {
          const zoneData = lap.data.slice(zoneStartIndex, i);
          const entrySpeed = zoneData[0].Speed;
          const exitSpeed = zoneData[zoneData.length - 1].Speed;
          const avgThrottle = zoneData.reduce((sum, r) => sum + r.aps, 0) / zoneData.length;
          const distance = zoneData[Math.floor(zoneData.length / 2)].Laptrigger_lapdist_dls;

          const sector = COTA_SECTORS.find((s) => distance >= s.start && distance < s.end);

          accelZones.push({
            sector: sector?.name || 'Unknown',
            distance,
            entrySpeed,
            exitSpeed,
            avgThrottle,
            lapNumber: lap.lapNumber,
          });
        }
        inAccelZone = false;
      }
    }
  }

  return accelZones;
}

function analyzeCorners(laps: ParsedLap[]): CornerAnalysis[] {
  const corners: CornerAnalysis[] = [];

  for (const lap of laps) {
    for (const sectorDef of COTA_SECTORS) {
      const sectorData = lap.data.filter(
        (row) =>
          row.Laptrigger_lapdist_dls >= sectorDef.start &&
          row.Laptrigger_lapdist_dls < sectorDef.end
      );

      if (sectorData.length < 5) continue;

      const minSpeedRow = sectorData.reduce((min, row) => (row.Speed < min.Speed ? row : min));
      const minSpeedIndex = sectorData.indexOf(minSpeedRow);

      const entrySpeed = sectorData[0].Speed;
      const exitSpeed = sectorData[sectorData.length - 1].Speed;

      corners.push({
        sector: sectorDef.name,
        distance: minSpeedRow.Laptrigger_lapdist_dls,
        minSpeed: minSpeedRow.Speed,
        lapNumber: lap.lapNumber,
        entrySpeed,
        exitSpeed,
      });
    }
  }

  return corners;
}

function analyzeSpeedDeficits(
  laps: ParsedLap[],
  bestSectors: Sector[]
): SpeedDeficit[] {
  const deficits: SpeedDeficit[] = [];

  for (const bestSector of bestSectors) {
    const sectorDef = COTA_SECTORS.find((s) => s.name === bestSector.name);
    if (!sectorDef) continue;

    const allSectorSpeeds: number[][] = [];

    for (const lap of laps) {
      const sectorData = lap.data.filter(
        (row) =>
          row.Laptrigger_lapdist_dls >= sectorDef.start &&
          row.Laptrigger_lapdist_dls < sectorDef.end
      );

      if (sectorData.length > 0) {
        allSectorSpeeds.push(sectorData.map((r) => r.Speed));
      }
    }

    if (allSectorSpeeds.length < 2) continue;

    const minLength = Math.min(...allSectorSpeeds.map((s) => s.length));

    for (let i = 0; i < minLength; i += Math.floor(minLength / 5)) {
      const speedsAtPoint = allSectorSpeeds.map((s) => s[i] || 0);
      const avgSpeed = speedsAtPoint.reduce((a, b) => a + b, 0) / speedsAtPoint.length;
      const bestSpeed = Math.max(...speedsAtPoint);
      const speedLoss = bestSpeed - avgSpeed;

      if (speedLoss > 5) {
        const distance =
          bestSector.data[Math.min(i, bestSector.data.length - 1)]?.Laptrigger_lapdist_dls ||
          sectorDef.start;

        deficits.push({
          sector: bestSector.name,
          distance,
          speedLoss,
          bestSpeed,
          avgSpeed,
          description: `${speedLoss.toFixed(1)} km/h slower than best at ${distance.toFixed(0)}m`,
        });
      }
    }
  }

  return deficits;
}

function identifyImprovementAreas(
  sectorStats: SectorStats[],
  consistency: ConsistencyMetrics,
  brakingZones: BrakingZone[],
  accelerationZones: AccelerationZone[],
  corners: CornerAnalysis[],
  speedDeficits: SpeedDeficit[]
): ImprovementArea[] {
  const improvements: ImprovementArea[] = [];

  for (const stat of sectorStats) {
    if (stat.timeGain > 0.1) {
      const deficit = speedDeficits.find((d) => d.sector === stat.sectorName);
      const description = deficit
        ? `Losing ${stat.timeGain.toFixed(3)}s in ${stat.sectorName}. ${deficit.description}.`
        : `Losing ${stat.timeGain.toFixed(3)}s in ${stat.sectorName} compared to your best.`;

      improvements.push({
        area: `${stat.sectorName} Pace`,
        sector: stat.sectorName,
        timeLoss: stat.timeGain,
        description,
        recommendation: `Focus on maintaining higher minimum speeds through corners and earlier throttle application.`,
        priority: stat.timeGain > 0.3 ? 'high' : stat.timeGain > 0.15 ? 'medium' : 'low',
      });
    }
  }

  if (consistency.consistencyScore < 70) {
    improvements.push({
      area: 'Consistency',
      sector: 'All',
      timeLoss: consistency.stdDeviation,
      description: `Lap times vary by ${consistency.stdDeviation.toFixed(2)}s (score: ${consistency.consistencyScore.toFixed(0)}/100).`,
      recommendation: `Work on repeatable reference points for braking and turn-in to improve consistency.`,
      priority: 'high',
    });
  }

  const brakingVariance = new Map<string, number[]>();
  for (const zone of brakingZones) {
    const key = `${zone.sector}-${Math.floor(zone.distance / 100) * 100}`;
    if (!brakingVariance.has(key)) {
      brakingVariance.set(key, []);
    }
    brakingVariance.get(key)!.push(zone.distance);
  }

  Array.from(brakingVariance.entries()).forEach(([key, distances]) => {
    if (distances.length < 2) return;
    const variance = Math.max(...distances) - Math.min(...distances);
    if (variance > 30) {
      const sector = key.split('-')[0];
      improvements.push({
        area: 'Braking Consistency',
        sector,
        timeLoss: variance / 100,
        description: `Braking point varies by ${variance.toFixed(0)}m in ${sector}.`,
        recommendation: `Establish fixed reference points for braking zones to improve consistency.`,
        priority: 'medium',
      });
    }
  });

  const cornersByDistance = corners.reduce((acc, corner) => {
    const key = `${corner.sector}-${Math.floor(corner.distance / 100) * 100}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(corner);
    return acc;
  }, {} as Record<string, CornerAnalysis[]>);

  for (const [key, cornerGroup] of Object.entries(cornersByDistance)) {
    if (cornerGroup.length < 2) continue;
    const minSpeeds = cornerGroup.map((c) => c.minSpeed);
    const bestMinSpeed = Math.max(...minSpeeds);
    const avgMinSpeed = minSpeeds.reduce((a, b) => a + b, 0) / minSpeeds.length;
    const speedDeficit = bestMinSpeed - avgMinSpeed;

    if (speedDeficit > 3) {
      const sector = cornerGroup[0].sector;
      improvements.push({
        area: 'Corner Speed',
        sector,
        timeLoss: speedDeficit / 50,
        description: `Minimum speed ${speedDeficit.toFixed(1)} km/h lower than best in ${sector}.`,
        recommendation: `Work on carrying more speed through the corner with smoother inputs and better line.`,
        priority: speedDeficit > 8 ? 'high' : 'medium',
      });
    }
  }

  improvements.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.timeLoss - a.timeLoss;
  });

  return improvements.slice(0, 8);
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

  const consistency = analyzeConsistency(laps);
  const brakingZones = analyzeBrakingZones(laps);
  const accelerationZones = analyzeAccelerationZones(laps);
  const corners = analyzeCorners(laps);
  const speedDeficits = analyzeSpeedDeficits(laps, bestSectors);
  const improvementAreas = identifyImprovementAreas(
    sectorStats,
    consistency,
    brakingZones,
    accelerationZones,
    corners,
    speedDeficits
  );

  return {
    theoreticalTime,
    chartData,
    sectorStats,
    bestSectors,
    consistency,
    improvementAreas,
    brakingZones,
    accelerationZones,
    cornerAnalysis: corners,
    speedDeficits,
  };
}

export function formatLapTime(timeInSeconds: number): string {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const milliseconds = Math.floor((timeInSeconds % 1) * 1000);

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

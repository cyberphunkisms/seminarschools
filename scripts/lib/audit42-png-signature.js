#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const zlib = require('zlib');

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const DEFAULT_VISUAL_THRESHOLDS = Object.freeze({
  mean_cell_rgb_mae: 5,
  p95_cell_rgb_mae: 18,
  changed_cell_rgb_mae: 12,
  changed_cell_ratio: 0.12,
  largest_changed_cluster_ratio: 0.04,
  luma_histogram_total_variation: 0.08,
  mean_rgb_max_delta: 7,
  edge_density_delta: 0.035,
});

function round(value, digits = 5) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(fraction * sorted.length) - 1),
  );
  return sorted[index];
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function decodePng(file) {
  const encoded = fs.readFileSync(file);
  if (encoded.length < PNG_SIGNATURE.length
    || !encoded.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${file} is not a PNG file`);
  }

  let cursor = PNG_SIGNATURE.length;
  let header = null;
  const imageChunks = [];
  while (cursor + 12 <= encoded.length) {
    const length = encoded.readUInt32BE(cursor);
    const type = encoded.toString('ascii', cursor + 4, cursor + 8);
    const dataStart = cursor + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > encoded.length) {
      throw new Error(`${file} has a truncated ${type || 'unknown'} chunk`);
    }
    const data = encoded.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      imageChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    cursor = dataEnd + 4;
  }

  if (!header || !imageChunks.length) {
    throw new Error(`${file} omits required IHDR or IDAT chunks`);
  }
  if (header.bitDepth !== 8
    || header.compression !== 0
    || header.filter !== 0
    || header.interlace !== 0) {
    throw new Error(
      `${file} uses an unsupported PNG encoding `
        + `(bit depth ${header.bitDepth}, compression ${header.compression}, `
        + `filter ${header.filter}, interlace ${header.interlace})`,
    );
  }

  const channelsByColorType = {
    0: 1,
    2: 3,
    4: 2,
    6: 4,
  };
  const channels = channelsByColorType[header.colorType];
  if (!channels) {
    throw new Error(`${file} uses unsupported PNG color type ${header.colorType}`);
  }

  const rowBytes = header.width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(imageChunks));
  const expectedBytes = header.height * (rowBytes + 1);
  if (inflated.length !== expectedBytes) {
    throw new Error(
      `${file} expands to ${inflated.length} bytes; expected ${expectedBytes}`,
    );
  }

  const pixels = Buffer.allocUnsafe(rowBytes * header.height);
  let inputOffset = 0;
  for (let y = 0; y < header.height; y += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;
    const rowOffset = y * rowBytes;
    const priorOffset = rowOffset - rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const encodedByte = inflated[inputOffset + x];
      const left = x >= channels ? pixels[rowOffset + x - channels] : 0;
      const up = y > 0 ? pixels[priorOffset + x] : 0;
      const upperLeft = y > 0 && x >= channels
        ? pixels[priorOffset + x - channels]
        : 0;
      let reconstructed;
      if (filterType === 0) reconstructed = encodedByte;
      else if (filterType === 1) reconstructed = encodedByte + left;
      else if (filterType === 2) reconstructed = encodedByte + up;
      else if (filterType === 3) {
        reconstructed = encodedByte + Math.floor((left + up) / 2);
      } else if (filterType === 4) {
        reconstructed = encodedByte + paethPredictor(left, up, upperLeft);
      } else {
        throw new Error(`${file} uses invalid PNG filter ${filterType} on row ${y}`);
      }
      pixels[rowOffset + x] = reconstructed & 0xff;
    }
    inputOffset += rowBytes;
  }

  return {
    ...header,
    channels,
    pixels,
    encoded,
  };
}

function compositeChannel(channel, alpha) {
  return Math.round((channel * alpha + 255 * (255 - alpha)) / 255);
}

function rgbAt(image, x, y) {
  const offset = (y * image.width + x) * image.channels;
  if (image.colorType === 0) {
    const gray = image.pixels[offset];
    return [gray, gray, gray];
  }
  if (image.colorType === 2) {
    return [
      image.pixels[offset],
      image.pixels[offset + 1],
      image.pixels[offset + 2],
    ];
  }
  if (image.colorType === 4) {
    const gray = image.pixels[offset];
    const alpha = image.pixels[offset + 1];
    const composited = compositeChannel(gray, alpha);
    return [composited, composited, composited];
  }
  const alpha = image.pixels[offset + 3];
  return [
    compositeChannel(image.pixels[offset], alpha),
    compositeChannel(image.pixels[offset + 1], alpha),
    compositeChannel(image.pixels[offset + 2], alpha),
  ];
}

function visualSignature(file, options = {}) {
  const image = decodePng(file);
  const columns = options.columns || 32;
  const rows = options.rows || 18;
  const targetSamples = options.targetSamples || 350000;
  const sampleStride = Math.max(
    1,
    Math.floor(Math.sqrt((image.width * image.height) / targetSamples)),
  );
  const cells = Array.from(
    { length: columns * rows },
    () => ({ red: 0, green: 0, blue: 0, count: 0 }),
  );
  const histogram = new Array(16).fill(0);
  const total = { red: 0, green: 0, blue: 0, count: 0 };
  let horizontalEdges = 0;
  let verticalEdges = 0;
  let edgeComparisons = 0;
  let priorRowLuma = [];

  for (let y = 0, sampledY = 0; y < image.height; y += sampleStride, sampledY += 1) {
    const currentRowLuma = [];
    let priorLuma = null;
    for (let x = 0, sampledX = 0; x < image.width; x += sampleStride, sampledX += 1) {
      const [red, green, blue] = rgbAt(image, x, y);
      const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const gridX = Math.min(columns - 1, Math.floor((x * columns) / image.width));
      const gridY = Math.min(rows - 1, Math.floor((y * rows) / image.height));
      const cell = cells[gridY * columns + gridX];
      cell.red += red;
      cell.green += green;
      cell.blue += blue;
      cell.count += 1;
      total.red += red;
      total.green += green;
      total.blue += blue;
      total.count += 1;
      histogram[Math.min(15, Math.floor(luma / 16))] += 1;

      if (priorLuma !== null) {
        horizontalEdges += Math.abs(luma - priorLuma) >= 24 ? 1 : 0;
        edgeComparisons += 1;
      }
      if (priorRowLuma[sampledX] !== undefined) {
        verticalEdges += Math.abs(luma - priorRowLuma[sampledX]) >= 24 ? 1 : 0;
        edgeComparisons += 1;
      }
      priorLuma = luma;
      currentRowLuma.push(luma);
    }
    priorRowLuma = currentRowLuma;
  }

  return {
    width: image.width,
    height: image.height,
    bytes: image.encoded.length,
    sha256: crypto.createHash('sha256').update(image.encoded).digest('hex'),
    png: {
      bit_depth: image.bitDepth,
      color_type: image.colorType,
      interlaced: Boolean(image.interlace),
    },
    sampling: {
      stride: sampleStride,
      samples: total.count,
      grid_columns: columns,
      grid_rows: rows,
    },
    mean_rgb: [
      round(total.red / total.count, 3),
      round(total.green / total.count, 3),
      round(total.blue / total.count, 3),
    ],
    luma_histogram: histogram.map(count => round(count / total.count, 7)),
    edge_density: round((horizontalEdges + verticalEdges) / edgeComparisons, 7),
    grid_rgb: cells.map(cell => [
      round(cell.red / cell.count, 3),
      round(cell.green / cell.count, 3),
      round(cell.blue / cell.count, 3),
    ]),
  };
}

function largestClusterRatio(changed, columns, rows) {
  const visited = new Set();
  let largest = 0;
  for (const start of changed) {
    if (visited.has(start)) continue;
    const pending = [start];
    visited.add(start);
    let size = 0;
    while (pending.length) {
      const current = pending.pop();
      size += 1;
      const x = current % columns;
      const y = Math.floor(current / columns);
      const neighbours = [];
      if (x > 0) neighbours.push(current - 1);
      if (x + 1 < columns) neighbours.push(current + 1);
      if (y > 0) neighbours.push(current - columns);
      if (y + 1 < rows) neighbours.push(current + columns);
      for (const neighbour of neighbours) {
        if (changed.has(neighbour) && !visited.has(neighbour)) {
          visited.add(neighbour);
          pending.push(neighbour);
        }
      }
    }
    largest = Math.max(largest, size);
  }
  return largest / (columns * rows);
}

function compareVisualSignatures(
  baseline,
  candidate,
  thresholds = DEFAULT_VISUAL_THRESHOLDS,
) {
  const reasons = [];
  if (baseline.width !== candidate.width || baseline.height !== candidate.height) {
    reasons.push(
      `dimensions changed from ${baseline.width}x${baseline.height} `
        + `to ${candidate.width}x${candidate.height}`,
    );
  }
  const columns = baseline.sampling?.grid_columns;
  const rows = baseline.sampling?.grid_rows;
  if (!Number.isInteger(columns)
    || !Number.isInteger(rows)
    || baseline.grid_rgb?.length !== columns * rows
    || candidate.grid_rgb?.length !== columns * rows) {
    reasons.push('visual signature grid geometry is incompatible');
    return {
      pass: false,
      exact: baseline.sha256 === candidate.sha256,
      reasons,
      metrics: {},
    };
  }

  const cellErrors = baseline.grid_rgb.map((cell, index) => (
    cell.reduce(
      (sum, channel, channelIndex) => (
        sum + Math.abs(channel - candidate.grid_rgb[index][channelIndex])
      ),
      0,
    ) / 3
  ));
  const changedCells = new Set();
  cellErrors.forEach((error, index) => {
    if (error > thresholds.changed_cell_rgb_mae) changedCells.add(index);
  });
  const histogramVariation = baseline.luma_histogram.reduce(
    (sum, value, index) => (
      sum + Math.abs(value - candidate.luma_histogram[index])
    ),
    0,
  ) / 2;
  const meanRgbMaxDelta = Math.max(
    ...baseline.mean_rgb.map(
      (value, index) => Math.abs(value - candidate.mean_rgb[index]),
    ),
  );
  const metrics = {
    mean_cell_rgb_mae: round(
      cellErrors.reduce((sum, value) => sum + value, 0) / cellErrors.length,
      4,
    ),
    p95_cell_rgb_mae: round(percentile(cellErrors, 0.95), 4),
    p99_cell_rgb_mae: round(percentile(cellErrors, 0.99), 4),
    changed_cell_ratio: round(changedCells.size / cellErrors.length, 5),
    largest_changed_cluster_ratio: round(
      largestClusterRatio(changedCells, columns, rows),
      5,
    ),
    luma_histogram_total_variation: round(histogramVariation, 5),
    mean_rgb_max_delta: round(meanRgbMaxDelta, 4),
    edge_density_delta: round(
      Math.abs(baseline.edge_density - candidate.edge_density),
      5,
    ),
  };

  const checks = [
    ['mean_cell_rgb_mae', thresholds.mean_cell_rgb_mae],
    ['p95_cell_rgb_mae', thresholds.p95_cell_rgb_mae],
    ['changed_cell_ratio', thresholds.changed_cell_ratio],
    ['largest_changed_cluster_ratio', thresholds.largest_changed_cluster_ratio],
    [
      'luma_histogram_total_variation',
      thresholds.luma_histogram_total_variation,
    ],
    ['mean_rgb_max_delta', thresholds.mean_rgb_max_delta],
    ['edge_density_delta', thresholds.edge_density_delta],
  ];
  for (const [name, limit] of checks) {
    if (metrics[name] > limit) {
      reasons.push(`${name} ${metrics[name]} exceeds tolerant limit ${limit}`);
    }
  }

  return {
    pass: reasons.length === 0,
    exact: baseline.sha256 === candidate.sha256,
    reasons,
    metrics,
  };
}

module.exports = {
  DEFAULT_VISUAL_THRESHOLDS,
  compareVisualSignatures,
  decodePng,
  visualSignature,
};

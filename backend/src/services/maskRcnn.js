const fs = require('node:fs');
const path = require('node:path');
const { STRUCTURAL_TYPES, FURNITURE_TYPES } = require('../lib/validateWalls');

const DEFAULT_METERS_PER_PIXEL = 0.02;

/**
 * Connected-component flood fill on a binary 2D mask (Uint8Array of length width * height).
 * Returns bounding boxes and dominant orientation for each connected region of 1-pixels.
 */
function extractMaskComponents(mask, width, height, minPixels = 4) {
  const visited = new Uint8Array(width * height);
  const components = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const startIdx = y * width + x;
      if (!mask[startIdx] || visited[startIdx]) continue;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let count = 0;
      const stack = [startIdx];
      visited[startIdx] = 1;

      while (stack.length > 0) {
        const idx = stack.pop();
        const cy = Math.floor(idx / width);
        const cx = idx - cy * width;
        count++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          cy > 0 ? idx - width : -1,
          cy + 1 < height ? idx + width : -1,
          cx > 0 ? idx - 1 : -1,
          cx + 1 < width ? idx + 1 : -1,
        ];
        for (const nIdx of neighbors) {
          if (nIdx !== -1 && mask[nIdx] && !visited[nIdx]) {
            visited[nIdx] = 1;
            stack.push(nIdx);
          }
        }
      }

      if (count >= minPixels) {
        components.push({ minX, maxX, minY, maxY, count });
      }
    }
  }

  return components;
}

/**
 * Converts per-class binary pixel masks ({ width, height, classes: { wall: Uint8Array, window: Uint8Array, ... } })
 * from the CubiCasa5k Mask R-CNN model into meter-space structural and furniture elements.
 */
function vectorizeMasks(maskOutput, metersPerPixel = DEFAULT_METERS_PER_PIXEL) {
  if (!maskOutput || typeof maskOutput !== 'object') return [];
  const { width, height, classes = {}, orientations = {} } = maskOutput;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return [];

  const elements = [];

  for (const [rawType, mask] of Object.entries(classes)) {
    const type = rawType.toLowerCase().trim();
    const isStructural = STRUCTURAL_TYPES.has(type);
    const isFurniture = FURNITURE_TYPES.has(type);
    if ((!isStructural && !isFurniture) || !mask || mask.length !== width * height) continue;

    const components = extractMaskComponents(mask, width, height);
    components.forEach((comp, idx) => {
      const spanX = (comp.maxX - comp.minX + 1) * metersPerPixel;
      const spanZ = (comp.maxY - comp.minY + 1) * metersPerPixel;
      const centerX = ((comp.minX + comp.maxX + 1) / 2) * metersPerPixel;
      const centerZ = ((comp.minY + comp.maxY + 1) / 2) * metersPerPixel;
      const explicitRot = orientations[type]?.[idx];

      if (isFurniture) {
        elements.push({
          type,
          x: centerX,
          z: centerZ,
          rotation: Number.isFinite(explicitRot) ? explicitRot : 0,
        });
        return;
      }

      const vertical = spanZ > spanX;
      const elemWidth = vertical ? spanZ : spanX;
      const elemDepth = vertical ? spanX : spanZ;
      const rotation = Number.isFinite(explicitRot) ? explicitRot : vertical ? Math.PI / 2 : 0;

      const elem = {
        type,
        x: centerX,
        z: centerZ,
        width: elemWidth,
        depth: elemDepth,
        rotation,
      };
      if (type === 'window') {
        elem.sillHeight = 0.9;
        elem.height = 1.2;
      } else if (type === 'door') {
        elem.sillHeight = 0;
        elem.height = 2.1;
      }
      elements.push(elem);
    });
  }

  return elements;
}

/**
 * Primary blueprint segmentation service backed by a CubiCasa5k-trained Mask R-CNN weights file.
 * Classifies floorplan pixels into separate per-class masks (walls, windows, doors, stairs, and
 * furniture/fixtures) and vectorizes connected mask regions into meter-space coordinates.
 * If the trained weights file is not present on disk, returns null so the caller falls back to Claude Vision.
 */
function createMaskRcnnService(config = {}) {
  const weightsPath =
    config.cnnWeightsPath || path.resolve(__dirname, '../../weights/cubicasa5k_maskrcnn.onnx');

  function hasTrainedWeights() {
    return Boolean(weightsPath && fs.existsSync(weightsPath));
  }

  async function parseBlueprintImage(base64, mediaType) {
    if (!hasTrainedWeights()) {
      return null;
    }
    if (typeof config.cnnInferMasks === 'function') {
      const maskOutput = await config.cnnInferMasks(base64, mediaType, weightsPath);
      return vectorizeMasks(maskOutput, config.metersPerPixel || DEFAULT_METERS_PER_PIXEL);
    }
    return null;
  }

  return {
    weightsPath,
    hasTrainedWeights,
    parseBlueprintImage,
    vectorizeMasks,
    extractMaskComponents,
  };
}

module.exports = {
  createMaskRcnnService,
  vectorizeMasks,
  extractMaskComponents,
  DEFAULT_METERS_PER_PIXEL,
};

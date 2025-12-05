/**
 * H.264 NAL unit types
 */
export enum NALUnitType {
  UNSPECIFIED = 0,
  CODED_SLICE_NON_IDR = 1,
  CODED_SLICE_DATA_PARTITION_A = 2,
  CODED_SLICE_DATA_PARTITION_B = 3,
  CODED_SLICE_DATA_PARTITION_C = 4,
  CODED_SLICE_IDR = 5,
  SEI = 6,
  SPS = 7,
  PPS = 8,
  ACCESS_UNIT_DELIMITER = 9,
  END_OF_SEQUENCE = 10,
  END_OF_STREAM = 11,
  FILLER_DATA = 12,
}

/**
 * H.264 stream format types
 */
export enum H264Format {
  ANNEX_B = 'Annex B', // Uses start codes (0x00 0x00 0x01 or 0x00 0x00 0x00 0x01)
  AVCC = 'AVCC', // Uses length prefixes
  UNKNOWN = 'Unknown',
}

/**
 * Result of analyzing a video chunk for H.264 NAL units
 */
export interface ChunkAnalysisResult {
  /**
   *
   */
  hasIDR: boolean
  /**
   *
   */
  hasSPS: boolean
  /**
   *
   */
  hasPPS: boolean
  /**
   *
   */
  format: H264Format
  /**
   *
   */
  nalUnits: Array<{
    /**
     *
     */
    type: NALUnitType
    /**
     *
     */
    typeName: string
  }>
}

/**
 * Analyze a video chunk for H.264 NAL units (IDR, SPS, PPS)
 * @param {Blob} chunkBlob - The video chunk to analyze
 * @returns {Promise<ChunkAnalysisResult>} Analysis result with detected NAL units
 */
export async function analyzeChunkForNALUnits(chunkBlob: Blob): Promise<ChunkAnalysisResult> {
  const arrayBuffer = await chunkBlob.arrayBuffer()
  const data = new Uint8Array(arrayBuffer)

  const result: ChunkAnalysisResult = {
    hasIDR: false,
    hasSPS: false,
    hasPPS: false,
    format: H264Format.UNKNOWN,
    nalUnits: [],
  }

  let foundStartCode = false

  // Search for NAL units using start codes (0x00 0x00 0x00 0x01 or 0x00 0x00 0x01)
  let i = 0
  while (i < data.length - 4) {
    // Check for 4-byte start code (0x00 0x00 0x00 0x01)
    if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x00 && data[i + 3] === 0x01) {
      foundStartCode = true
      if (i + 4 < data.length) {
        const nalHeader = data[i + 4]
        const nalType = nalHeader & 0x1f // Lower 5 bits contain the NAL unit type

        const typeName = NALUnitType[nalType] || `UNKNOWN_${nalType}`
        result.nalUnits.push({ type: nalType, typeName })

        if (nalType === NALUnitType.CODED_SLICE_IDR) {
          result.hasIDR = true
        } else if (nalType === NALUnitType.SPS) {
          result.hasSPS = true
        } else if (nalType === NALUnitType.PPS) {
          result.hasPPS = true
        }
      }
      i += 4
    }
    // Check for 3-byte start code (0x00 0x00 0x01)
    else if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01) {
      foundStartCode = true
      if (i + 3 < data.length) {
        const nalHeader = data[i + 3]
        const nalType = nalHeader & 0x1f

        const typeName = NALUnitType[nalType] || `UNKNOWN_${nalType}`
        result.nalUnits.push({ type: nalType, typeName })

        if (nalType === NALUnitType.CODED_SLICE_IDR) {
          result.hasIDR = true
        } else if (nalType === NALUnitType.SPS) {
          result.hasSPS = true
        } else if (nalType === NALUnitType.PPS) {
          result.hasPPS = true
        }
      }
      i += 3
    } else {
      i++
    }
  }

  // Determine format based on whether we found start codes
  if (foundStartCode) {
    result.format = H264Format.ANNEX_B
  } else if (data.length > 0) {
    // If no start codes found but we have data, it might be AVCC format
    // AVCC uses length-prefixed NAL units instead of start codes
    result.format = H264Format.AVCC
  }

  return result
}

import Phaser from 'phaser';

const CRT_FRAG_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;
uniform vec2 uResolution;
uniform float uDistortion;
uniform float uAberration;
uniform float uScanlineIntensity;
uniform float uFlickerSpeed;
uniform vec3 uTint;

varying vec2 outTexCoord;

void main(void) {
    vec2 uv = outTexCoord;

    // Barrel distortion (channel-adjustable)
    vec2 centered = uv - 0.5;
    float dist = dot(centered, centered);
    vec2 distorted = uv + centered * dist * uDistortion;

    // Chromatic aberration (channel-adjustable)
    float r = texture2D(uMainSampler, vec2(distorted.x + uAberration, distorted.y)).r;
    float g = texture2D(uMainSampler, distorted).g;
    float b = texture2D(uMainSampler, vec2(distorted.x - uAberration, distorted.y)).b;
    vec3 color = vec3(r, g, b);

    // Channel tint
    color *= uTint;

    // Scanlines (channel-adjustable intensity)
    float scanline = sin(distorted.y * uResolution.y * 1.5) * uScanlineIntensity;
    color -= scanline;

    // Vignette
    float vignette = 1.0 - dist * 1.5;
    color *= vignette;

    // Subtle flicker (channel-adjustable speed)
    float flicker = 1.0 - (sin(uTime * uFlickerSpeed) * 0.005 + 0.005);
    color *= flicker;

    // Clamp edges to black (barrel distortion can go out of bounds)
    if (distorted.x < 0.0 || distorted.x > 1.0 || distorted.y < 0.0 || distorted.y > 1.0) {
        color = vec3(0.0);
    }

    gl_FragColor = vec4(color, 1.0);
}
`;

export interface CRTChannelParams {
  distortion: number;
  aberration: number;
  scanlineIntensity: number;
  flickerSpeed: number;
  tint: [number, number, number]; // RGB 0-1
}

/** Default CRT params (CH 2 STATIC) */
const DEFAULT_PARAMS: CRTChannelParams = {
  distortion: 0.08,
  aberration: 0.002,
  scanlineIntensity: 0.08,
  flickerSpeed: 8.0,
  tint: [1.0, 1.0, 1.0],
};

/** Per-channel CRT visual presets */
export const CRT_CHANNEL_PRESETS: Record<string, CRTChannelParams> = {
  static: {
    distortion: 0.08,
    aberration: 0.002,
    scanlineIntensity: 0.08,
    flickerSpeed: 8.0,
    tint: [1.0, 1.0, 1.0],
  },
  test_pattern: {
    distortion: 0.05,
    aberration: 0.004,
    scanlineIntensity: 0.05,
    flickerSpeed: 4.0,
    tint: [1.0, 1.0, 1.05],
  },
  emergency: {
    distortion: 0.12,
    aberration: 0.003,
    scanlineIntensity: 0.12,
    flickerSpeed: 15.0,
    tint: [1.1, 0.85, 0.85],
  },
  late_night: {
    distortion: 0.06,
    aberration: 0.002,
    scanlineIntensity: 0.06,
    flickerSpeed: 6.0,
    tint: [1.05, 1.0, 0.9],
  },
  channel_9: {
    distortion: 0.10,
    aberration: 0.004,
    scanlineIntensity: 0.04,
    flickerSpeed: 10.0,
    tint: [1.1, 0.95, 1.1],
  },
  channel_13: {
    distortion: 0.06,
    aberration: 0.002,
    scanlineIntensity: 0.10,
    flickerSpeed: 5.0,
    tint: [0.9, 1.1, 0.9],
  },
  sports: {
    distortion: 0.01,
    aberration: 0.001,
    scanlineIntensity: 0.08,
    flickerSpeed: 4.0,
    tint: [0.85, 1.0, 0.85],
  },
  news: {
    distortion: 0.005,
    aberration: 0.001,
    scanlineIntensity: 0.06,
    flickerSpeed: 3.0,
    tint: [0.9, 0.9, 1.05],
  },
  music_video: {
    distortion: 0.06,
    aberration: 0.008,
    scanlineIntensity: 0.06,
    flickerSpeed: 5.0,
    tint: [1.0, 0.95, 1.1],
  },
  off_air: {
    distortion: 0.15,
    aberration: 0.006,
    scanlineIntensity: 0.15,
    flickerSpeed: 15.0,
    tint: [0.7, 0.7, 0.7],
  },
};

function buildCRTConfig(arg: Phaser.Game | Phaser.Types.Renderer.WebGL.WebGLPipelineConfig): Phaser.Types.Renderer.WebGL.WebGLPipelineConfig {
  // Phaser 3.90+ passes (game, config) when instantiating PostFX pipelines.
  if (arg instanceof Phaser.Game) {
    return { game: arg, name: 'CRTPipeline', fragShader: CRT_FRAG_SHADER };
  }
  return { ...arg, name: 'CRTPipeline', fragShader: CRT_FRAG_SHADER };
}

export class CRTPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _time = 0;
  private _params: CRTChannelParams = { ...DEFAULT_PARAMS };

  /** Temporary overrides applied on top of _params (cleared each frame unless re-set) */
  private _aberrationOverride: number | null = null;
  private _distortionOverride: number | null = null;

  constructor(game: Phaser.Game | Phaser.Types.Renderer.WebGL.WebGLPipelineConfig) {
    super(buildCRTConfig(game));
  }

  /** Set channel-specific CRT visual parameters */
  setChannelParams(channelId: string): void {
    this._params = CRT_CHANNEL_PRESETS[channelId] ?? DEFAULT_PARAMS;
  }

  /** Temporarily override aberration (resets on next call to resetOverrides) */
  setAberrationOverride(value: number): void {
    this._aberrationOverride = value;
  }

  /** Temporarily override distortion (resets on next call to resetOverrides) */
  setDistortionOverride(value: number): void {
    this._distortionOverride = value;
  }

  /** Clear all temporary overrides, restoring channel defaults */
  resetOverrides(): void {
    this._aberrationOverride = null;
    this._distortionOverride = null;
  }

  onPreRender(): void {
    if (!this.renderer) return;
    this._time += 0.016;
    this.set1f('uTime', this._time);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.set1f('uDistortion', this._distortionOverride ?? this._params.distortion);
    this.set1f('uAberration', this._aberrationOverride ?? this._params.aberration);
    this.set1f('uScanlineIntensity', this._params.scanlineIntensity);
    this.set1f('uFlickerSpeed', this._params.flickerSpeed);
    this.set3f('uTint', this._params.tint[0], this._params.tint[1], this._params.tint[2]);
  }
}

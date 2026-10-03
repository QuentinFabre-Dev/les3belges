// Éclairage par pixel « 2D enrichie » :
//  1. la scène est rendue à sa résolution native dans une texture (pixels nets), puis agrandie ;
//  2. une passe de normales (relief des salles) est rendue avec la même caméra ;
//  3. un shader additionne les lumières (lampes, écrans, torches, gyrophares) sur une lumière ambiante
//     par étage ; le résultat multiplie la scène.
import { ColorMatrixFilter, Container, Filter, GlProgram, Graphics, RenderTexture, Sprite, type Renderer } from 'pixi.js';

export const MAX_LIGHTS = 48;

export interface Light {
  x: number; // coordonnées monde
  y: number;
  r: number; // rayon
  i: number; // intensité
  color: number;
  h?: number; // hauteur au-dessus du mur (relief)
}

const vertex = `in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vPixel;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    vPixel = position;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

const fragment = `in vec2 vTextureCoord;
in vec2 vPixel;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uLights[${MAX_LIGHTS}];  // x, y, rayon, intensité
uniform vec4 uColors[${MAX_LIGHTS}];  // r, g, b, hauteur
uniform int uCount;
uniform float uRelief;

void main()
{
    vec3 n = texture(uTexture, vTextureCoord).rgb * 2.0 - 1.0;
    n = normalize(mix(vec3(0.0, 0.0, 1.0), n, uRelief));
    // Pixels nets : on éclaire le centre du texel.
    vec2 p = floor(vPixel) + 0.5;
    vec3 sum = vec3(0.0);
    for (int k = 0; k < ${MAX_LIGHTS}; k++) {
        if (k >= uCount) break;
        vec4 L = uLights[k];
        vec2 d = L.xy - p;
        float dist = length(d);
        if (dist > L.z) continue;
        float att = 1.0 - dist / L.z;
        att *= att;
        vec3 dir = normalize(vec3(d, uColors[k].w));
        float diff = max(dot(n, dir), 0.0);
        sum += uColors[k].rgb * L.w * att * (0.15 + 0.85 * diff);
    }
    // Quantification légère : la lumière tombe par paliers, comme en pixel art.
    sum = floor(sum * 24.0 + 0.5) / 24.0;
    finalColor = vec4(sum, 1.0);
}
`;

export class Lighting {
  /** Scène des normales (une image par aile de salle), même repère que le monde. */
  readonly normalWorld = new Container();
  private ambientGfx = new Graphics();
  private quad = new Sprite();
  private lightRoot = new Container();
  private sceneRT?: RenderTexture;
  private normalRT?: RenderTexture;
  private lightRT?: RenderTexture;
  readonly display = new Sprite();
  readonly lightSprite = new Sprite();
  readonly grade = new ColorMatrixFilter();
  private filter: Filter;
  private lightData = new Float32Array(MAX_LIGHTS * 4);
  private colorData = new Float32Array(MAX_LIGHTS * 4);
  private w = 0;
  private h = 0;

  constructor(private renderer: Renderer) {
    this.filter = new Filter({
      glProgram: GlProgram.from({ vertex, fragment, name: 'silo-lights' }),
      resources: {
        lightUniforms: {
          uLights: { value: this.lightData, type: 'vec4<f32>', size: MAX_LIGHTS },
          uColors: { value: this.colorData, type: 'vec4<f32>', size: MAX_LIGHTS },
          uCount: { value: 0, type: 'i32' },
          uRelief: { value: 1, type: 'f32' },
        },
      },
      blendMode: 'add',
    });
    this.quad.filters = [this.filter];
    this.lightRoot.addChild(this.ambientGfx, this.quad);
    this.lightSprite.blendMode = 'multiply';
    this.display.filters = [this.grade];
  }

  private ensure(w: number, h: number) {
    w = Math.min(w, 4096);
    h = Math.min(h, 4096);
    // Tailles arrondies pour éviter de réallouer à chaque cran de zoom.
    const W = Math.ceil(w / 64) * 64;
    const H = Math.ceil(h / 64) * 64;
    if (this.sceneRT && W === this.w && H === this.h) return;
    this.sceneRT?.destroy(true);
    this.normalRT?.destroy(true);
    this.lightRT?.destroy(true);
    const opts = { width: W, height: H, resolution: 1, scaleMode: 'nearest' as const };
    this.sceneRT = RenderTexture.create(opts);
    this.normalRT = RenderTexture.create(opts);
    this.lightRT = RenderTexture.create(opts);
    this.display.texture = this.sceneRT;
    this.lightSprite.texture = this.lightRT;
    this.quad.texture = this.normalRT;
    this.w = W;
    this.h = H;
  }

  /**
   * Rend le monde (déjà positionné en -vx, -vy, échelle 1) et compose la lumière.
   * ambient : bandes horizontales [y0, y1, niveau] en coordonnées monde.
   */
  render(world: Container, vx: number, vy: number, vw: number, vh: number, lights: Light[], ambient: [number, number, number][], relief: number) {
    this.ensure(vw, vh);
    const r = this.renderer;
    r.render({ container: world, target: this.sceneRT!, clear: true, clearColor: [0.04, 0.05, 0.06, 1] });
    this.normalWorld.position.set(-vx, -vy);
    r.render({ container: this.normalWorld, target: this.normalRT!, clear: true, clearColor: [0.5, 0.5, 1, 1] });

    const g = this.ambientGfx;
    g.clear();
    for (const [y0, y1, v] of ambient) {
      const a = Math.max(0, Math.min(255, Math.round(v * 255)));
      g.rect(0, y0 - vy, this.w, y1 - y0).fill((a << 16) | (a << 8) | a);
    }
    const list = lights
      .filter((l) => l.i > 0.01 && l.x + l.r > vx && l.x - l.r < vx + vw && l.y + l.r > vy && l.y - l.r < vy + vh)
      .sort((a, b) => b.i * b.r - a.i * a.r)
      .slice(0, MAX_LIGHTS);
    list.forEach((l, k) => {
      this.lightData.set([l.x - vx, l.y - vy, l.r, l.i], k * 4);
      this.colorData.set([((l.color >> 16) & 255) / 255, ((l.color >> 8) & 255) / 255, (l.color & 255) / 255, l.h ?? 18], k * 4);
    });
    const u = this.filter.resources.lightUniforms.uniforms;
    u.uCount = list.length;
    u.uRelief = relief;
    r.render({ container: this.lightRoot, target: this.lightRT!, clear: true, clearColor: [0, 0, 0, 1] });
  }

  /** Place l'image finale à l'écran (agrandissement entier ou non, au plus proche). */
  place(screenX: number, screenY: number, zoom: number) {
    for (const s of [this.display, this.lightSprite]) {
      s.position.set(screenX, screenY);
      s.scale.set(zoom);
    }
  }

  destroy() {
    this.sceneRT?.destroy(true);
    this.normalRT?.destroy(true);
    this.lightRT?.destroy(true);
  }
}

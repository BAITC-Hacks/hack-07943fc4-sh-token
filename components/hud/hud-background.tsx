"use client"
/* ORION HUD — фон «Атмосфера»: fbm-туман, оранжевые топо-линии, небесная дымка,
   зерно и сканлайны. Кладётся в components/hud/hud-background.tsx,
   ставится один раз в app/layout.tsx первым элементом <body>. */
import * as React from "react"

const FS = `precision highp float;uniform vec2 r;uniform float t;uniform float k;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*2.2;float T=t*.035;
vec2 q=vec2(fbm(p+T),fbm(p+vec2(5.2,1.3)-T));float f=fbm(p+2.2*q+vec2(T*2.,-T));
vec3 bg=vec3(.039,.043,.051),sky=vec3(.557,.788,1.),org=vec3(1.,.478,.184);
float sk=smoothstep(.3,1.,uv.y)*f;float og=smoothstep(.65,0.,uv.y)*smoothstep(.4,.85,f)*(.55+.45*uv.x);
vec3 c=bg+(sky*sk*.15+org*og*.26)*k;
float ln=abs(fract(f*9.)-.5);c+=(org*smoothstep(.035,0.,ln)*og*.35+sky*smoothstep(.02,0.,ln)*sk*.12)*k;
c+=(h(gl_FragCoord.xy+fract(t*.7)*91.)-.5)*.045;c-=.018*step(.5,fract(gl_FragCoord.y*.5));
c*=.72+.28*smoothstep(1.25,.25,length(uv-.5));gl_FragColor=vec4(c,1.);}`

export function HudBackground({ intensity = 1, className }: { intensity?: number; className?: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null)
  const kRef = React.useRef(intensity)
  React.useEffect(() => { kRef.current = intensity }, [intensity])
  React.useEffect(() => {
    const cv = ref.current!
    const gl = cv.getContext("webgl", { antialias: false })
    if (!gl) return
    const sh = (type: number, src: string) => { const o = gl.createShader(type)!; gl.shaderSource(o, src); gl.compileShader(o); return o }
    const pr = gl.createProgram()!
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"))
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(pr); gl.useProgram(pr)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const ur = gl.getUniformLocation(pr, "r"), ut = gl.getUniformLocation(pr, "t"), uk = gl.getUniformLocation(pr, "k")
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0; const t0 = performance.now()
    const size = () => { const d = Math.min(devicePixelRatio, 1.5); cv.width = innerWidth * d; cv.height = innerHeight * d; gl.viewport(0, 0, cv.width, cv.height) }
    size(); addEventListener("resize", size)
    const draw = (n: number) => {
      if (!document.hidden) { gl.uniform2f(ur, cv.width, cv.height); gl.uniform1f(ut, still ? 20 : (n - t0) / 1000); gl.uniform1f(uk, kRef.current); gl.drawArrays(gl.TRIANGLES, 0, 3) }
      if (!still) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", size) }
  }, [])
  return <canvas ref={ref} aria-hidden className={className} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />
}

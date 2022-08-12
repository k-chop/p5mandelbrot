import "./style.css";

import p5 from "p5";

const sketch = (p: p5) => {
  p.setup = () => {
    p.createCanvas(720, 540);
    p.pixelDensity(1);
    p.noLoop();
  };

  p.draw = () => {
    p.background(0);

    const row = p.height;
    const col = p.width;
    const x = -0.3;
    const y = 0;
    const r = 1.4;
    const N = 100;
    const R = 2;

    const xmin = x - r * ((col - 1) / (row - 1));
    const ymax = y + r;
    const dpp = (2 * r) / (row - 1);
    const R2 = R * R;

    p.loadPixels();

    for (let i = 0; i < row; i++) {
      for (let j = 0; j < col; j++) {
        let zr = 0.0;
        let zi = 0.0;
        const cr = xmin + dpp * j;
        const ci = ymax - dpp * i;

        let k = 0;
        while (k < N) {
          const tzr = zr * zr - zi * zi + cr;
          zi = zr * zi * 2 + ci;
          zr = tzr;

          const absz = zr * zr + zi * zi;
          if (absz > R2) {
            break;
          }
          k++;
        }

        const pixelIndex = (j + i * p.width) * 4;
        const norm = p.map(k, 0, N, 0, 1);
        let bright = p.map(p.sqrt(norm), 0, 1, 0, 255);
        if (k == N) {
          bright = 0;
        } else {
          p.pixels[pixelIndex + 0] = bright;
          p.pixels[pixelIndex + 1] = bright;
          p.pixels[pixelIndex + 2] = bright;
          p.pixels[pixelIndex + 3] = 255;
        }
      }
    }
    p.updatePixels();
  };
};

new p5(sketch);

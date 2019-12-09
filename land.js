/* const topGeometry = new THREE.BoxBufferGeometry(0.01, 1, 0.01);
const leftGeometry = topGeometry.clone().applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
  new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0))
));
const boxGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries([
  topGeometry.clone().applyMatrix(new THREE.Matrix4().makeTranslation(-0.5, 0, -0.5)),
  topGeometry.clone().applyMatrix(new THREE.Matrix4().makeTranslation(0.5, 0, -0.5)),
  leftGeometry.clone().applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, -0.5)),
  leftGeometry.clone().applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.5, -0.5)),
]);
THREE.Guardian = function Guardian(extents, distanceFactor, color) {
  const _makeGeometry = () => {
    const pixels = {};
    for (let i = 0; i < extents.length; i++) {
      const [x1, y1, x2, y2] = extents[i];
      for (let x = x1; x < x2; x++) {
        for (let y = y1; y < y2; y++) {
          pixels[`${x}:${y}`] = true;
        }
      }
    }

    const boxGeometries = [];
    for (let i = 0; i < extents.length; i++) {
      const [x1, y1, x2, y2] = extents[i];
      for (let x = x1; x < x2; x++) {
        for (let y = y1; y < y2; y++) {
          const hasCoords = {
            left: pixels[`${x-1}:${y}`],
            right: pixels[`${x+1}:${y}`],
            up: pixels[`${x}:${y-1}`],
            down: pixels[`${x}:${y+1}`],
          };

          if (!hasCoords.up) {
            for (let h = 0; h <= 2; h++) {
              boxGeometries.push(boxGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeTranslation(x, h + 0.5, y))
              );
            }
          }
          if (!hasCoords.down) {
            for (let h = 0; h <= 2; h++) {
              boxGeometries.push(boxGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)))
                .applyMatrix(new THREE.Matrix4().makeTranslation(x, h + 0.5, y))
              );
            }
          }
          if (!hasCoords.left) {
            for (let h = 0; h <= 2; h++) {
              boxGeometries.push(boxGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI/2)))
                .applyMatrix(new THREE.Matrix4().makeTranslation(x, h + 0.5, y))
              );
            }
          }
          if (!hasCoords.right) {
            for (let h = 0; h <= 2; h++) {
              boxGeometries.push(boxGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI/2)))
                .applyMatrix(new THREE.Matrix4().makeTranslation(x, h + 0.5, y))
              );
            }
          }
        }
      }
    }

    return THREE.BufferGeometryUtils.mergeBufferGeometries(boxGeometries);
  };
  const geometry = _makeGeometry();
  const gridVsh = `
    varying vec3 vWorldPos;
    // varying vec2 vUv;
    varying float vDepth;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      // vUv = uv;
      vWorldPos = abs(position);
      vDepth = gl_Position.z / ${distanceFactor.toFixed(8)};
    }
  `;
  const gridFsh = `
    // uniform sampler2D uTex;
    uniform vec3 uColor;
    uniform float uAnimation;
    varying vec3 vWorldPos;
    varying float vDepth;
    void main() {
      gl_FragColor = vec4(uColor, (1.0-vDepth)*uAnimation);
    }
  `;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: {
        type: 'c',
        value: new THREE.Color(color),
      },
      uAnimation: {
        type: 'f',
        value: 1,
      },
    },
    vertexShader: gridVsh,
    fragmentShader: gridFsh,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.setColor = c => {
    mesh.material.uniforms.uColor.value.setHex(c);
  };
  return mesh;
}; */

const wallGeometry = (() => {
  const panelGeometries = [];
  for (let x = -8; x <= 8; x++) {
    panelGeometries.push(
      new THREE.BoxBufferGeometry(0.01, 2, 0.01)
        .applyMatrix(new THREE.Matrix4().makeTranslation(x, 1, -8))
    );
  }
  for (let h = 0; h <= 2; h++) {
    panelGeometries.push(
      new THREE.BoxBufferGeometry(16, 0.01, 0.01)
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, h, -8))
    );
  }
  return THREE.BufferGeometryUtils.mergeBufferGeometries(panelGeometries);
})();
const topWallGeometry = wallGeometry.clone()
  // .applyMatrix(new THREE.Matrix4().makeTranslation(-0.5, 0, -0.5));
const leftWallGeometry = wallGeometry.clone()
  .applyMatrix(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), Math.PI/2))
  // .applyMatrix(new THREE.Matrix4().makeTranslation(-0.5, 0, -0.5));
const rightWallGeometry = wallGeometry.clone()
  .applyMatrix(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), -Math.PI/2))
  // .applyMatrix(new THREE.Matrix4().makeTranslation(-0.5, 0, -0.5));
const bottomWallGeometry = wallGeometry.clone()
  .applyMatrix(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), Math.PI))
  // .applyMatrix(new THREE.Matrix4().makeTranslation(-0.5, 0, -0.5));
const distanceFactor = 64;
THREE.Parcel = function Guardian(extents, color) {
  const geometry = (() => {
    const geometries = [];
    const [[x1, y1, x2, y2]] = extents;
    const ax1 = (x1 + 8)/16;
    const ay1 = (y1 + 8)/16;
    const ax2 = (x2 + 8)/16;
    const ay2 = (y2 + 8)/16;
    for (let x = ax1; x < ax2; x++) {
      geometries.push(
        topWallGeometry.clone()
          .applyMatrix(new THREE.Matrix4().makeTranslation(x*16, 0, ay1*16))
      );
      geometries.push(
        bottomWallGeometry.clone()
          .applyMatrix(new THREE.Matrix4().makeTranslation(x*16, 0, (ay2-1)*16))
      );
    }
    for (let y = ay1; y < ay2; y++) {
      geometries.push(
        leftWallGeometry.clone()
          .applyMatrix(new THREE.Matrix4().makeTranslation(ax1*16, 0, y*16))
      );
      geometries.push(
        rightWallGeometry.clone()
          .applyMatrix(new THREE.Matrix4().makeTranslation((ax2-1)*16, 0, y*16))
      );
    }
    return THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
  })();
  const gridVsh = `
    // varying vec3 vWorldPos;
    // varying vec2 vUv;
    varying float vDepth;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      // vUv = uv;
      // vWorldPos = abs(position);
      vDepth = gl_Position.z / ${distanceFactor.toFixed(8)};
    }
  `;
  const gridFsh = `
    // uniform sampler2D uTex;
    uniform vec3 uColor;
    // uniform float uAnimation;
    // varying vec3 vWorldPos;
    varying float vDepth;
    void main() {
      gl_FragColor = vec4(uColor, (1.0-vDepth));
    }
  `;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: {
        type: 'c',
        value: new THREE.Color(color),
      },
    },
    vertexShader: gridVsh,
    fragmentShader: gridFsh,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.setColor = c => {
    mesh.material.uniforms.uColor.value.setHex(c);
  };
  return mesh;
};

/* const planeGeometry = new THREE.PlaneBufferGeometry(1, 1)
  .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI/2)))
  .applyMatrix(new THREE.Matrix4().makeTranslation(0.5, 0.01, 0.5));
THREE.Land = function Land(extents, color) {
  const _makeGeometry = () => {
    const geometries = [];
    for (let i = 0; i < extents.length; i++) {
      const [x1, y1, x2, y2] = extents[i];
      for (let x = x1; x < x2; x++) {
        for (let y = y1; y < y2; y++) {
          geometries.push(
            planeGeometry.clone()
              .applyMatrix(new THREE.Matrix4().makeTranslation(x, 0, y))
          );
        }
      }
    }
    return THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
  };
  const geometry = _makeGeometry();
  const baseVsh = `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    }
  `;
  const baseFsh = `
    uniform vec3 uColor;
    uniform float uAnimation;
    void main() {
      gl_FragColor = vec4(uColor, uAnimation*0.5);
    }
  `;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: {
        type: 'c',
        value: new THREE.Color(color),
      },
      uAnimation: {
        type: 'f',
        value: 1,
      },
    },
    vertexShader: baseVsh,
    fragmentShader: baseFsh,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.setColor = c => {
    mesh.material.uniforms.uColor.value.setHex(c);
  };
  return mesh;
}; */
THREE.Land = {};
THREE.Land.parseExtents = s => {
  const regex = /(?:\[(-?[0-9]+)\s+(-?[0-9]+)\s+(-?[0-9]+)\s+(-?[0-9]+)\]|(-?[0-9]+)\s+(-?[0-9]+))\s*/g;
  const result = [];
  let match;
  while (match = regex.exec(s)) {
    if (match[1]) {
      const x1 = parseFloat(match[1]);
      const y1 = parseFloat(match[2]);
      const x2 = parseFloat(match[3]);
      const y2 = parseFloat(match[4]);
      result.push([x1, y1, x2, y2]);
    } else if (match[5]) {
      const x = parseFloat(match[5]);
      const y = parseFloat(match[6]);
      result.push([x, y, x, y]);
    }
  }
  return result;
};
THREE.Land.serializeExtents = extents => {
  let result = '';
  for (let i = 0; i < extents.length; i++) {
    if (result) {
      result += ' ';
    }
    const [x1, y1, x2, y2] = extents[i];
    if (x1 !== x2 || y1 !== y2) {
      result += `[${x1} ${y1} ${x2} ${y2}]`;
    } else {
      result += `${x1} ${y1}`;
    }
  }
  return result;
};

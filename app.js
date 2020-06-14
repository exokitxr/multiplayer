import './three.js';
import './BufferGeometryUtils.js';
import './OutlineEffect.js';
import './OrbitControls.js';
import './TransformControls.js';
import './Reflector.js';
import './land.js';
import './bmfont.js';

import {XRChannelConnection} from './multiplayer.js';
import HTMLClient from 'https://sync.exokit.org/sync-client.js';
import {parseHtml, serializeHtml} from 'https://sync.exokit.org/html-utils.js';
import Avatar from 'https://avatars.exokit.org/avatars.js';
import MicrophoneWorker from 'https://avatars.exokit.org/microphone-worker.js';
import ModelLoader from 'https://model-loader.exokit.org/model-loader.js';
import {parcelSize, colors} from './constants.js';
import {ToolManager} from './tools.js';
import siteUrls from 'https://site-urls.exokit.org/site-urls.js';
import avatarModels from 'https://avatar-models.exokit.org/avatar-models.js';
import itemModels from 'https://item-models.exokit.org/item-models.js';
// import renderItems from './render-items.js';

const {document: topDocument} = window.top;

const peerPoseUpdateRate = 50;
const walkSpeed = 0.0015;
const floorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localVector4 = new THREE.Vector3();
const localVector5 = new THREE.Vector3();
const localVector2D = new THREE.Vector2();
const localVector2D2 = new THREE.Vector2();
const localQuaternion = new THREE.Quaternion();
const localQuaternion2 = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localEuler = new THREE.Euler();
const localRay = new THREE.Ray();
const localRaycaster = new THREE.Raycaster();
const localColor = new THREE.Color();

const z180Quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

const _patchModel = object => {
  object.scene.traverse(o => {
    if (o.isMesh) {
      o.frustumCulled = false;

      if (o.material.opacity === 0) {
        o.material.opacity = 1;
      }
    }
  });
};
const _loadModelUrl = async (url, filename) => {
  const model = await ModelLoader.loadModelUrl(url, filename);
  _patchModel(model);
  return model;
};

const scene = new THREE.Scene();

// renderItems(scene);

const container = new THREE.Object3D();
scene.add(container);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 1.5;
camera.position.z = 2;
// camera.rotation.y = Math.PI;

const ambientLight = new THREE.AmbientLight(0x808080);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 3);
directionalLight.position.set(0.5, 1, 0.5);
scene.add(directionalLight);

/* const directionalLight2 = new THREE.DirectionalLight(0xFFFFFF, 4);
directionalLight2.position.set(-0.5, 1, -0.5);
scene.add(directionalLight2); */

const _makeTextMesh = (s = '', color = 0x000000, size = 1) => {
  // create a geometry of packed bitmap glyphs,
  // word wrapped to 300px and right-aligned
  var geometry = createTextGeometry({
    width: Infinity,
    font: fontJson,
  });

  // change text and other options as desired
  // the options sepcified in constructor will
  // be used as defaults
  geometry.update(s);

  // the resulting layout has metrics and bounds
  // console.log(geometry.layout.height)
  // console.log(geometry.layout.descender)

  var material = new THREE.RawShaderMaterial(createSDFShader({
    map: fontTexture,
    transparent: true,
    color,
    // color: palette[Math.floor(Math.random() * palette.length)]
    // negate: false,
    side: THREE.DoubleSide,
  }));

  const _getWidth = () => {
    const lastGlyph = geometry.layout.glyphs[geometry.layout.glyphs.length - 1];
    return lastGlyph.x + lastGlyph.width;
  };
  const _updatePosition = () => {
    mesh.position.set(-_getWidth() * 0.002, 0, 0);
  };
  const scaleFactor = 0.002 * size;

  const mesh = new THREE.Mesh(geometry, material);

  _updatePosition();
  mesh.scale.set(scaleFactor, -scaleFactor, -scaleFactor);
  mesh.frustumCulled = false;
  mesh.getText = () => s;
  mesh.setText = newS => {
    if (newS !== s) {
      s = newS;
      geometry.update(s);
      _updatePosition();
    }
  };
  return mesh;
};
const _makeNametagMesh = textMesh => {
  const o = new THREE.Object3D();
  o.add(textMesh);
  o.setName = name => {
    textMesh.setText(name);
  };
  return o;
};
function mod(a, n) {
  return ((a%n)+n)%n;
}
const distanceFactor = 64;
const parcelGeometry = (() => {
  const tileGeometry = new THREE.PlaneBufferGeometry(1, 1)
    .applyMatrix(localMatrix.makeScale(0.95, 0.95, 1))
    .applyMatrix(localMatrix.makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI/2)))
    .toNonIndexed();
  const numCoords = tileGeometry.attributes.position.array.length;
  const numVerts = numCoords/3;
  const positions = new Float32Array(numCoords*parcelSize*parcelSize);
  const centers = new Float32Array(numCoords*parcelSize*parcelSize);
  const typesx = new Float32Array(numVerts*parcelSize*parcelSize);
  const typesz = new Float32Array(numVerts*parcelSize*parcelSize);
  let i = 0;
  for (let x = -parcelSize/2+0.5; x < parcelSize/2; x++) {
    for (let z = -parcelSize/2+0.5; z < parcelSize/2; z++) {
      const newTileGeometry = tileGeometry.clone()
        .applyMatrix(localMatrix.makeTranslation(x, 0, z));
      positions.set(newTileGeometry.attributes.position.array, i * newTileGeometry.attributes.position.array.length);
      for (let j = 0; j < newTileGeometry.attributes.position.array.length/3; j++) {
        localVector.set(x, 0, z).toArray(centers, i*newTileGeometry.attributes.position.array.length + j*3);
      }
      let typex = 0;
      if (mod((x + parcelSize/2-0.5), parcelSize) === 0) {
        typex = 1/8;
      } else if (mod((x + parcelSize/2-0.5), parcelSize) === parcelSize-1) {
        typex = 2/8;
      }
      let typez = 0;
      if (mod((z + parcelSize/2-0.5), parcelSize) === 0) {
        typez = 1/8;
      } else if (mod((z + parcelSize/2-0.5), parcelSize) === parcelSize-1) {
        typez = 2/8;
      }
      for (let j = 0; j < numVerts; j++) {
        typesx[i*numVerts + j] = typex;
        typesz[i*numVerts + j] = typez;
      }
      i++;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('center', new THREE.BufferAttribute(centers, 3));
  geometry.setAttribute('typex', new THREE.BufferAttribute(typesx, 1));
  geometry.setAttribute('typez', new THREE.BufferAttribute(typesz, 1));
  return geometry;
})();
const floorVsh = `
  #define PI 3.1415926535897932384626433832795

  uniform vec3 uPosition;
  uniform float uAnimation;
  uniform vec4 uSelectedParcel;
  attribute vec3 center;
  attribute float typex;
  attribute float typez;
  varying vec3 vPosition;
  varying float vTypex;
  varying float vTypez;
  varying float vDepth;
  varying float vPulse;

  float range = 1.0;

  void main() {
    float height;
    vec3 c = center + uPosition;
    float selectedWidth = uSelectedParcel.z - uSelectedParcel.x;
    float selectedHeight = uSelectedParcel.w - uSelectedParcel.y;
    if (c.x >= uSelectedParcel.x && c.x < uSelectedParcel.z && c.z >= uSelectedParcel.y && c.z < uSelectedParcel.w) {
      vec2 selectedCenter = vec2((uSelectedParcel.x+uSelectedParcel.z) / 2.0, (uSelectedParcel.y+uSelectedParcel.w) / 2.0);
      float selectedSize = max(selectedWidth, selectedHeight)/2.0;
      float selectedRadius = sqrt(selectedSize*selectedSize+selectedSize*selectedSize);

      float animationRadius = uAnimation * selectedRadius;
      float currentRadius = length(c.xz - selectedCenter);
      float radiusDiff = abs(animationRadius - currentRadius);
      height = max((range - radiusDiff)/range, 0.0);
      height = sin(height*PI/2.0);
      height *= 0.2;

      vPulse = 1.0 + (1.0 - mod(uAnimation * 2.0, 1.0)/2.0) * 0.5;
    } else {
      vPulse = 1.0;
    }
    vec3 p = vec3(position.x, position.y + height, position.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    vPosition = position;
    vTypex = typex;
    vTypez = typez;
    vDepth = gl_Position.z / ${distanceFactor.toFixed(8)};
  }
`;
const floorFsh = `
  #define PI 3.1415926535897932384626433832795

  uniform vec3 uColor;
  uniform float uHover;
  uniform float uAnimation;
  varying vec3 vPosition;
  varying float vTypex;
  varying float vTypez;
  varying float vDepth;
  varying float vPulse;

  void main() {
    float add = uHover * 0.2;
    vec3 f = fract(vPosition);
    if (vTypex >= 2.0/8.0) {
      if (f.x >= 0.8) {
        add = 0.2;
      }
    } else if (vTypex >= 1.0/8.0) {
      if (f.x <= 0.2) {
        add = 0.2;
      }
    }
    if (vTypez >= 2.0/8.0) {
      if (f.z >= 0.8) {
        add = 0.2;
      }
    } else if (vTypez >= 1.0/8.0) {
      if (f.z <= 0.2) {
        add = 0.2;
      }
    }
    vec3 c = (uColor + add) * vPulse;
    float a = (1.0-vDepth)*0.8;
    gl_FragColor = vec4(c, a);
  }
`;
const _makeFloorMesh = (x, z) => {
  const geometry = parcelGeometry;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPosition: {
        type: 'v3',
        value: new THREE.Vector3(),
      },
      uColor: {
        type: 'c',
        value: new THREE.Color().setHex(colors.normal),
      },
      uHover: {
        type: 'f',
        value: 0,
      },
      uSelectedParcel: {
        type: 'v4',
        value: new THREE.Vector4(),
      },
      uAnimation: {
        type: 'f',
        value: 1,
      },
    },
    vertexShader: floorVsh,
    fragmentShader: floorFsh,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x*parcelSize, 0, z*parcelSize);
  mesh.material.uniforms.uPosition.value.copy(mesh.position);
  mesh.frustumCulled = false;
  mesh.update = () => {
    const xrSite = _getFloorMeshXrSite(mesh);
    const color = _getSelectedColor(xrSite);
    material.uniforms.uColor.value.setHex(color);
  };
  return mesh;
};
const _containsPosition = (x1, y1, x2, y2, position) =>
  position.x >= x1 &&
  position.x <= x2 &&
  position.z >= y1 &&
  position.z <= y2;
/* const _floorMeshContains = (x, z, floorMesh) =>
  x >= (floorMesh.position.x-parcelSize/2) &&
  x < (floorMesh.position.x+parcelSize/2) &&
  z <= (floorMesh.position.z-parcelSize/2) &&
  z > (floorMesh.position.z+parcelSize/2);
const _findFloorMesh = (x, z) => {
  for (let i = 0; i < floorMeshes.length; i++) {
    const floorMesh = floorMeshes[i];
    if (_floorMeshContains(x, z, floorMesh)) {
      return floorMesh;
    }
  }
  return null;
}; */
const floorMeshes = [];
for (let z = -3; z <= 3; z++) {
  for (let x = -3; x <= 3; x++) {
    const floorMesh = _makeFloorMesh(x, z);
    container.add(floorMesh);
    floorMeshes.push(floorMesh);
  }
}
const gridMeshSwitchWrap = topDocument.getElementById('grid-mesh-switch-wrap');
if (localStorage.getItem('gridHelper') !== 'false') {
  for (let i = 0; i < floorMeshes.length; i++) {
    floorMeshes[i].visible = true;
  }
  gridMeshSwitchWrap.classList.add('on');
} else {
  for (let i = 0; i < floorMeshes.length; i++) {
    floorMeshes[i].visible = false;
  }
}

let renderingMirror = false;
const mirrorMesh = (() => {
  const mirrorWidth = 3;
  const mirrorHeight = 2;
  const geometry = new THREE.PlaneBufferGeometry(mirrorWidth, mirrorHeight)
    .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1, 0));
  const mesh = new THREE.Reflector(geometry, {
    clipBias: 0.003,
    textureWidth: 1024 * window.devicePixelRatio,
    textureHeight: 2048 * window.devicePixelRatio,
    color: 0x889999,
    backgroundColor: 0x000000,
    recursion: 1,
    transparent: true,
  });
  mesh.position.set(0, 0, -1);

  const borderMesh = new THREE.Mesh(
    new THREE.BoxBufferGeometry(mirrorWidth + 0.1, mirrorHeight + 0.1, 0.1)
      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1, -0.1/2 - 0.01)),
    new THREE.MeshPhongMaterial({
      color: 0x5c6bc0,
    })
  );
  mesh.add(borderMesh);

  mesh.onBeforeRender2 = () => {
    if (rig) {
      rig.undecapitate();
    }
    renderingMirror = true;
  };
  mesh.onAfterRender2 = () => {
    if (rig && possessRig) {
      rig.decapitate();
    }
    renderingMirror = false;
  };

  return mesh;
})();
container.add(mirrorMesh);
const mirrorMeshSwitchWrap = topDocument.getElementById('mirror-mesh-switch-wrap');
if (localStorage.getItem('mirrorMesh')) {
  mirrorMesh.visible = true;
  mirrorMeshSwitchWrap.classList.add('on');
} else {
  mirrorMesh.visible = false;
}
container.add(mirrorMesh);

const backgroundColorInput = topDocument.getElementById('background-color-input');
backgroundColorInput.addEventListener('change', () => {
  const c = backgroundColorInput.value;

  const xrSite = document.querySelector('xr-site');
  if (xrSite) {
    xrSite.setAttribute('bg', c);
  } else {
    console.warn('no xr-site to set background on');
  }
});
const greenScreenButton = topDocument.getElementById('green-screen-button');
greenScreenButton.addEventListener('click', e => {
  backgroundColorInput.value = '#00FF00';
  backgroundColorInput.dispatchEvent(new CustomEvent('change'));
});
const whiteScreenButton = topDocument.getElementById('white-screen-button');
whiteScreenButton.addEventListener('click', e => {
  backgroundColorInput.value = '#FFFFFF';
  backgroundColorInput.dispatchEvent(new CustomEvent('change'));
});
const blackScreenButton = topDocument.getElementById('black-screen-button');
blackScreenButton.addEventListener('click', e => {
  backgroundColorInput.value = '#000000';
  backgroundColorInput.dispatchEvent(new CustomEvent('change'));
});
const solidScreenButton = topDocument.getElementById('solid-screen-button');
solidScreenButton.addEventListener('click', e => {
  const xrSite = document.querySelector('xr-site');
  if (xrSite) {
    xrSite.setAttribute('bga', 1);
  } else {
    console.warn('no xr-site to set background alpha on');
  }
});
const transparentScreenButton = topDocument.getElementById('transparent-screen-button');
transparentScreenButton.addEventListener('click', e => {
  const xrSite = document.querySelector('xr-site');
  if (xrSite) {
    xrSite.setAttribute('bga', 0);
  } else {
    console.warn('no xr-site to set background alpha on');
  }
});

const clearAvatarButton = topDocument.getElementById('clear-avatar-button');
clearAvatarButton.addEventListener('click', () => {
  _setLocalModel(null);
});

const goFullscreenButton = topDocument.getElementById('go-fullscreen-button');
const topBody = topDocument.querySelector('.body');
goFullscreenButton.addEventListener('click', () => {
  topBody.classList.toggle('fullscreen');
});

const wristUi = (() => {
  const geometry = new THREE.PlaneBufferGeometry(0.2, 0.1);
  const material = new THREE.MeshPhongMaterial({
    color: 0xFFFFFF,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  return mesh;
})();
container.add(wristUi);

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
});
// console.log('set size', window.innerWidth, window.innerHeight);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.sortObjects = false;
renderer.getContext().canvas.addEventListener('webglcontextlost', e => {
  console.log('webglcontextlost', e);
  debugger;
});
const iframeWrapper = document.getElementById('iframe-wrapper');
iframeWrapper.appendChild(renderer.domElement);
renderer.domElement.addEventListener('mousedown', e => {
  if (topDocument.activeElement) {
    topDocument.activeElement.blur();
  }
});

const outlineEffect = new THREE.OutlineEffect(renderer, {
  defaultThickness: 0.01,
  defaultColor: [0, 0, 1],
  defaultAlpha: 0.5,
  defaultKeepAlive: false,//true,
});
const outlineScene = new THREE.Scene();
let renderingOutline = false;
scene.onAfterRender = () => {
  if (renderingOutline || renderingMirror) return;
  renderingOutline = true;

  const selectedEl = toolManager.getSelectedElement();
  const hoveredEl = toolManager.getHoveredElement();
  const outlineEl = [selectedEl, hoveredEl].find(el => el && (el.tagName === 'XR-IFRAME' || el.tagName === 'XR-MODEL')) || null;
  const outlineModel = outlineEl && outlineEl.bindState && outlineEl.bindState.model;
  let oldParent = null;
  if (outlineModel) {
    oldParent = outlineModel.parent;
    outlineScene.add(outlineModel);

    const color = localColor.setHex(colors.normal).toArray();
    if (outlineEl === selectedEl) {
      localColor.setHex(colors.select6).toArray(color);
    } else if (outlineEl === hoveredEl) {
      localColor.setHex(colors.select5).toArray(color);
    }
    outlineModel.traverse(o => {
      if (o.isMesh) {
        if (!o.material.userData) {
          o.material.userData = {};
        }
        if (!o.material.userData.outlineParameters) {
          o.material.userData.outlineParameters = {};
        }
        o.material.userData.outlineParameters.color = color;
        /* o.material.userData.outlineParameters = {
         // thickness: 0.01,
         color,
         // alpha: 0.8,
         // visible: true,
         // keepAlive: true,
        }; */
      }
    });
  }

  outlineEffect.renderOutline(outlineScene, camera);

  if (oldParent) {
    oldParent.add(outlineModel);
  }

  renderingOutline = false;
};

const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
orbitControls.screenSpacePanning = true;
orbitControls.enableMiddleZoom = false;
orbitControls.update();

const teleportGeometry = new THREE.TorusBufferGeometry(0.5, 0.15, 3, 5)
  .applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)))
  .applyMatrix(new THREE.Matrix4().makeRotationY((1 / 20) * (Math.PI * 2)));
const teleportMaterial = new THREE.MeshBasicMaterial({
  color: 0x44c2ff,
});
const _makeTeleportMesh = () => {
  const geometry = teleportGeometry;
  const material = teleportMaterial;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.frustumCulled = false;
  return mesh;
};
const teleportMeshes = [
  _makeTeleportMesh(),
  _makeTeleportMesh(),
];
container.add(teleportMeshes[0]);
container.add(teleportMeshes[1]);

const canSelect = intersection => {
  return !landConnection || intersection.type === 'floor' || intersection.type === 'parcel';
};
const canDrag = (startPoint, endPoint) => {
  if (
    !!landConnection &&
    (!startPoint || startPoint.distanceTo(endPoint) < 100)
  ) {
    const coveredPoints = [];
    for (let y = startPoint.z; y < endPoint.z; y += parcelSize) {
      for (let x = startPoint.x; x < endPoint.x; x += parcelSize) {
        coveredPoints.push(new THREE.Vector3(x + parcelSize/2, 0, y + parcelSize/2));
      }
    }
    return !Array.from(document.querySelectorAll('xr-site')).some(xrSite => {
      return !xrSite.getAttribute('pending') &&
        THREE.Land.parseExtents(xrSite.getAttribute('extents')).some(([x1, y1, x2, y2]) =>
          coveredPoints.some(coveredPoint => _containsPosition(x1, y1, x2, y2, coveredPoint))
        );
      });
  } else {
    return false;
  }
};
const landElement = document.createElement('div');
landElement.classList.add('land');
document.body.appendChild(landElement);
const toolManager = new ToolManager({
  domElement: renderer.domElement,
  camera,
  container,
  orbitControls,
  landElement,
  canSelect,
  canDrag,
});
/* toolManager.addEventListener('toolchange', e => {
  const toolName = e.data;
  const cameraSelected = toolName === 'camera';
  const selectSelected = toolName === 'select';
  const moveSelected = toolName === 'move';

  orbitControls.enabled = cameraSelected;

  Array.from(document.querySelectorAll('xr-iframe')).concat(Array.from(document.querySelectorAll('xr-model'))).forEach(xrNode => {
    const {bindState: {control}} = xrNode;
    control.visible = moveSelected;
    control.enabled = moveSelected;
  });
}); */
const _incr = (a, b) => a - b;
const parcelCoords = topDocument.getElementById('parcel-coords');
const parcelCreate = topDocument.getElementById('parcel-create');
toolManager.addEventListener('selectchange', e => {
  const selection = e.data;

  Array.from(document.querySelectorAll('xr-iframe')).concat(Array.from(document.querySelectorAll('xr-model'))).forEach(xrNode => {
    xrNode.bindState.control.visible = false;
    xrNode.bindState.control.enabled = false;
  });
  Array.from(document.querySelectorAll('xr-site')).forEach(xrSite => {
    if (xrSite !== (selection && selection.element) && xrSite.getAttribute('pending')) {
      xrSite.parentNode.removeChild(xrSite);
    } else if (xrSite.guardianMesh) {
      const color = _getSelectedColor(xrSite);
      xrSite.guardianMesh.material.uniforms.uColor.value.setHex(color);
      xrSite.guardianMesh.visible = color !== colors.normal;
    }
  });
  for (let i = 0; i < floorMeshes.length; i++) {
    const floorMesh = floorMeshes[i];
    floorMesh.material.uniforms.uSelectedParcel.value.set(0, 0, 0, 0);
    floorMesh.update();
  }
  parcelCreate.classList.remove('open');
  parcelCoords.innerText = '';

  if (selection) {
    if (selection.type === 'element') {
      selection.element.bindState.control.visible = true;
      selection.element.bindState.control.enabled = true;
    } else if (selection.type === 'parcel') {
      const xs = [selection.start.x, selection.end.x];
      const ys = [selection.start.z, selection.end.z];
      for (let i = 0; i < floorMeshes.length; i++) {
        const floorMesh = floorMeshes[i];
        floorMesh.material.uniforms.uSelectedParcel.value.set(xs[0], ys[0], xs[1], ys[1]);
      }

      parcelCreate.classList.add('open');
      parcelCoords.innerText = `[${xs[0]}, ${ys[0]}, ${xs[1]}, ${ys[1]}]`;
    }
  }
});
toolManager.addEventListener('hoverchange', e => {
  const intersection = e.data;
  orbitControls.clickEnabled = !(intersection && intersection.type === 'element');
});
toolManager.addEventListener('editchange', e => {
  const edit = e.data;

  // console.log('got edit', edit);

  const xrSites = Array.from(document.querySelectorAll('xr-site'));
  for (let i = 0; i < xrSites.length; i++) {
    xrSites[i].removeAttribute('edit');
  }
  if (edit) {
    edit.element.setAttribute('edit', 'true');
  }

  lastParcelKey = '';
});

const _bindXrIframe = xrIframe => {
  const model = new THREE.Object3D();
  container.add(model);

  const boundingBoxMesh = _makeBoundingBoxMesh(model);
  model.boundingBoxMesh = boundingBoxMesh;
  model.add(model.boundingBoxMesh);
  model.element = xrIframe;

  const control = new THREE.TransformControls(camera, renderer.domElement);
  control.setMode(transformMode);
  control.size = 3;
  control.visible = toolManager.getSelectedElement() === xrIframe;
  control.enabled = control.visible;
  control.addEventListener('dragging-changed', e => {
    orbitControls.enabled = !e.value;
  });
  control.addEventListener('mouseEnter', () => {
    control.draggable = true;
    orbitControls.draggable = false;
  });
  control.addEventListener('mouseLeave', () => {
    control.draggable = false;
    orbitControls.draggable = true;
  });
  control.attach(model);
  scene.add(control);

  const observer = new MutationObserver(mutationRecords => {
    for (let i = 0; i < mutationRecords.length; i++) {
      const {target, attributeName, oldValue} = mutationRecords[i];
      const attributeValue = target.getAttribute(attributeName);
      attributeChangedCallback.call(xrIframe, attributeName, oldValue, attributeValue);
    }
  });
  xrIframe.bindState = {
    model,
    control,
    observer,
  };

  function attributeChangedCallback(name, oldValue, newValue) {
    if (this.bindState) {
      if (name === 'src') {
        let url = this.getAttribute('src');
        console.log('set url', url);
      } else if (name === 'position') {
        let position = (newValue || '0 0 0').split(' ');
        if (position.length === 3) {
          position = position.map(s => parseFloat(s));
          if (position.every(n => isFinite(n))) {
            this.bindState.control.object.position.fromArray(position);
          }
        }
      } else if (name === 'orientation') {
        let orientation = (newValue || '0 0 0 1').split(' ');
        if (orientation.length === 4) {
          orientation = orientation.map(s => parseFloat(s));
          if (orientation.every(n => isFinite(n))) {
            this.bindState.control.object.quaternion.fromArray(orientation);
          }
        }
      } else if (name === 'scale') {
        let scale = (newValue || '1 1 1').split(' ');
        if (scale.length === 3) {
          scale = scale.map(s => parseFloat(s));
          if (scale.every(n => isFinite(n))) {
            this.bindState.control.object.scale.fromArray(scale);
          }
        }
      }
    }
  }
  const observedAttributes = [
    'src',
    'position',
    'orientation',
    'scale',
    'highlight',
    'extents',
    'load-distance',
    'data',
  ];
  for (let i = 0; i < observedAttributes.length; i++) {
    const attributeName = observedAttributes[i];
    attributeChangedCallback.call(xrIframe, attributeName, null, xrIframe.getAttribute(attributeName));
  }
  
  observer.observe(xrIframe, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: observedAttributes,
  });

  control.addEventListener('change', e => {
    /* const editedEl = toolManager.getEditedElement();
    if (editedEl) {
      toolManager.clampPositionToElementExtent(control.object.position, editedEl);
    } */

    xrIframe.position = control.object.position.toArray();
    xrIframe.orientation = control.object.quaternion.toArray();
    xrIframe.scale = control.object.scale.toArray();
  });
};
const _unbindXrIframe = xrIframe => {
  const {model, control, observer} = xrIframe.bindState;
  container.remove(model);
  scene.remove(control);
  control.dispose();
  observer.disconnect();

  xrIframe.bindState = null;
};
const _getFloorMeshXrSite = floorMesh => Array.from(document.querySelectorAll('xr-site')).find(xrSite => {
  return THREE.Land.parseExtents(xrSite.getAttribute('extents')).some(([x1, y1, x2, y2]) => _containsPosition(x1, y1, x2, y2, floorMesh.position));
});
const _getSelectedColor = xrSite => {
  if (xrSite) {
    if (xrSite.getAttribute('pending')) {
      return colors.select3;
    } else {
      /* const editedEl = toolManager.getEditedElement();
      if (editedEl) {
        if (editedEl === xrSite) {
          return colors.select4;
        } else {
          return colors.normal;
        }
      } else { */
        if (toolManager.getSelectedElement() === xrSite) {
          return colors.select4;
        } else {
          return colors.select5;
        }
      // }
    }
  } else {
    return colors.normal;
  }
}
const _bindXrSite = xrSite => {
  const _update = mutationRecords => {
    for (let i = 0; i < mutationRecords.length; i++) {
      const mutationRecord = mutationRecords[i];
      const {target, attributeName} = mutationRecord;
      if (attributeName === 'bg' || attributeName === 'bga') { // XXX average this
        const c = target.getAttribute('bg') || '#000000';
        let a = parseInt(target.getAttribute('bga'), 10);
        if (isNaN(a)) {
          a = 1;
        }
        const color = new THREE.Color().setStyle(c);

        const xrEngine = topDocument.querySelector('xr-engine');
        renderer.setClearColor(color, a);
        if (xrEngine) {
          xrEngine.setClearColor(color.r, color.g, color.b, a);
        }
        mirrorMesh.setBackgroundColor(color, a);

        if (backgroundColorInput.value !== c) {
          backgroundColorInput.value = c;
        }
      } else if (attributeName === 'extents') {
        if (xrSite.guardianMesh) {
          container.remove(xrSite.guardianMesh);
          xrSite.guardianMesh = null;
        }

        const extents = THREE.Land.parseExtents(xrSite.getAttribute('extents'));
        if (extents.length > 0) {
          const color = _getSelectedColor(xrSite);
          xrSite.guardianMesh = new THREE.Parcel(extents, color);
          container.add(xrSite.guardianMesh);
        }

        for (let i = 0; i < floorMeshes.length; i++) {
          floorMeshes[i].update();
        }
      } else if (attributeName === 'pending') {
        Array.from(document.querySelectorAll('xr-site')).some(xrSite => {
          if (xrSite.guardianMesh) {
            const color = _getSelectedColor(xrSite);
            xrSite.guardianMesh.material.uniforms.uColor.value.setHex(color);
            xrSite.guardianMesh.visible = color !== colors.normal;
          }
        });
        for (let i = 0; i < floorMeshes.length; i++) {
          floorMeshes[i].update();
        }
      } else if (attributeName === 'edit') {
        Array.from(document.querySelectorAll('xr-site')).some(xrSite => {
          if (xrSite.guardianMesh) {
            const color = _getSelectedColor(xrSite);
            xrSite.guardianMesh.material.uniforms.uColor.value.setHex(color);
            xrSite.guardianMesh.visible = color !== colors.normal;
          }
        });
        for (let i = 0; i < floorMeshes.length; i++) {
          floorMeshes[i].update();
        }
      } else {
        console.warn('unknown attribute name', attributeName);
      }
    }
  };
  _update([{
    target: xrSite,
    attributeName: 'extents',
  }]);
  const observer = new MutationObserver(_update);
  observer.observe(xrSite, {
    attributes: true,
    attributeFilter: [
      'bg',
      'bga',
      'extents',
      'pending',
      'edit',
    ],
  });
  xrSite.bindState = {
    observer,
  };
};
const _unbindXrSite = xrSite => {
  container.remove(xrSite.guardianMesh);
  xrSite.guardianMesh = null;

  const {observer} = xrSite.bindState;
  observer.disconnect();
  xrSite.bindState = null;
};
new MutationObserver(mutationRecords => {
  for (let i = 0; i < mutationRecords.length; i++) {
    const {addedNodes, removedNodes} = mutationRecords[i];

    for (let j = 0; j < addedNodes.length; j++) {
      const node = addedNodes[j];
      if (node.tagName === 'XR-SITE' && !node.bindState) {
        _bindXrSite(node);
        Array.from(node.querySelectorAll('xr-iframe')).forEach(childNode => {
          if (childNode.tagName === 'XR-IFRAME' && !childNode.bindState) {
            _bindXrIframe(childNode);
          }
        });
        if (node.requestSession && !session) {
          node.requestSession().then(_setSession);
        }
      } else if (node.tagName === 'XR-IFRAME' && !node.bindState) {
        _bindXrIframe(node);
      }
    }
    for (let j = 0; j < removedNodes.length; j++) {
      const node = removedNodes[j];
      if (node.tagName === 'XR-SITE' && node.bindState) {
        _unbindXrSite(node);
        Array.from(node.querySelectorAll('xr-iframe')).forEach(childNode => {
          if (childNode.tagName === 'XR-IFRAME' && childNode.bindState) {
            _unbindXrIframe(childNode);
          }
        });
      } else if (node.tagName === 'XR-IFRAME' && node.bindState) {
        _unbindXrIframe(node);
      }
    }
  }
}).observe(document, {
  childList: true,
  subtree: true,
});
if (typeof XRIFrame === 'undefined') {
  class XRIFrame extends HTMLElement {
    get src() {
      return this.getAttribute('src');
    }
    set src(src) {
      this.setAttribute('src', src);
    }

    get position() {
      const s = this.getAttribute('position');
      return s ? s.split(' ').map(s => parseFloat(s)) : [0, 0, 0];
    }
    set position(position) {
      if (!Array.isArray(position)) {
        position = Array.from(position);
      }
      if (position.length === 3 && position.every(n => isFinite(n))) {
        const oldPosition = this.position;
        if (position.some((n, i) => n !== oldPosition[i])) {
          this.setAttribute('position', position.join(' '));
        }
      }
    }

    get orientation() {
      const s = this.getAttribute('orientation');
      return s ? s.split(' ').map(s => parseFloat(s)) : [0, 0, 0, 1];
    }
    set orientation(orientation) {
      if (!Array.isArray(orientation)) {
        orientation = Array.from(orientation);
      }
      if (orientation.length === 4 && orientation.every(n => isFinite(n))) {
        const oldOrientation = this.orientation;
        if (orientation.some((n, i) => n !== oldOrientation[i])) {
          this.setAttribute('orientation', orientation.join(' '));
        }
      }
    }

    get scale() {
      const s = this.getAttribute('scale');
      return s ? s.split(' ').map(s => parseFloat(s)) : [1, 1, 1];
    }
    set scale(scale) {
      if (!Array.isArray(scale)) {
        scale = Array.from(scale);
      }
      if (scale.length === 3 && scale.every(n => isFinite(n))) {
        const oldScale = this.scale;
        if (scale.some((n, i) => n !== oldScale[i])) {
          this.setAttribute('scale', scale.join(' '));
        }
      }
    }
  }
  customElements.define('xr-iframe', XRIFrame);
  window.XRIFrame = XRIFrame;
}

const boundingBoxGeometry = new THREE.BoxBufferGeometry(1, 1, 1);
const _makeBoundingBoxMesh = target => {
  const boundingBox = target.type === 'Object3D' ?
    new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1))
  :
    new THREE.Box3().setFromObject(target);
  ;
  const material = new THREE.MeshPhongMaterial({
    color: colors.normal,
    transparent: true,
    opacity: 0.3,
  });
  const mesh = new THREE.Mesh(boundingBoxGeometry, material);
  boundingBox.getCenter(mesh.position);
  boundingBox.getSize(mesh.scale);
  if (mesh.scale.x === 0 || mesh.scale.y === 0 || mesh.scale.z === 0) {
    mesh.visible = false;
  }
  mesh.target = target;
  let hover = false;
  let select = false;
  const _updateColor = () => {
    let color;
    if (select) {
      color = colors.select;
    } else if (hover) {
      color = colors.highlight;
    } else {
      color = colors.normal;
    }
    mesh.material.color.setHex(color);
  };
  mesh.setHover = newHover => {
    hover = newHover;
    _updateColor();
  };
  mesh.setSelect = newSelect => {
    select = newSelect;
    _updateColor();
  };
  mesh.intersect = raycaster => raycaster.intersectObject(mesh);

  return mesh;
};
const _makeBoundingModelMesh = target => {
  const mesh = new THREE.Object3D();
  mesh.target = target;
  mesh.setHover = hover => {};
  mesh.setSelect = select => {};
  mesh.intersect = raycaster => raycaster.intersectObject(target, true);
  return mesh;
};
class XRModel extends HTMLElement {
  constructor() {
    super();

    this.bindState = null;
  }
  async attributeChangedCallback(name, oldValue, newValue) {
    if (this.bindState) {
      if (name === 'src') {
        const url = this.src;

        // console.log('load 2', url, new Error().stack);

        const object = await _loadModelUrl(url);
        if (!this.bindState) return;
        const model = object.scene;
        const boundingBoxMesh = _makeBoundingModelMesh(model);
        model.boundingBoxMesh = boundingBoxMesh;
        model.add(model.boundingBoxMesh);
        model.element = this;
        model.position.fromArray(this.position);
        model.quaternion.fromArray(this.orientation);
        model.scale.fromArray(this.scale);

        container.remove(this.bindState.model);
        container.add(model);

        // this.bindState.control.detach();
        this.bindState.control.attach(model);

        this.bindState.model = model;
      } else if (name === 'position') {
        let position = (newValue || '0 0 0').split(' ');
        if (position.length === 3) {
          position = position.map(s => parseFloat(s));
          if (position.every(n => isFinite(n))) {
            this.bindState.control.object.position.fromArray(position);
          }
        }
      } else if (name === 'orientation') {
        let orientation = (newValue || '0 0 0 1').split(' ');
        if (orientation.length === 4) {
          orientation = orientation.map(s => parseFloat(s));
          if (orientation.every(n => isFinite(n))) {
            this.bindState.control.object.quaternion.fromArray(orientation);
          }
        }
      } else if (name === 'scale') {
        let scale = (newValue || '1 1 1').split(' ');
        if (scale.length === 3) {
          scale = scale.map(s => parseFloat(s));
          if (scale.every(n => isFinite(n))) {
            this.bindState.control.object.scale.fromArray(scale);
          }
        }
      }
    }
  }
  static get observedAttributes() {
    return [
      'src',
      'position',
      'orientation',
      'scale',
    ];
  }
  connectedCallback() {
    console.log('connected', this, this.getAttribute('src'), this.getAttribute('orientation'), this.getAttribute('scale'));

    const model = new THREE.Object3D();
    model.boundingBoxMesh = _makeBoundingBoxMesh(model);
    container.add(model);

    const control = new THREE.TransformControls(camera, renderer.domElement);
    control.setMode(transformMode);
    control.size = 3;
    control.visible = toolManager.getSelectedElement() === this;
    control.enabled = control.visible;
    control.addEventListener('dragging-changed', e => {
      orbitControls.enabled = !e.value;
    });
    control.addEventListener('mouseEnter', () => {
      control.draggable = true;
      orbitControls.draggable = false;
    });
    control.addEventListener('mouseLeave', () => {
      control.draggable = false;
      orbitControls.draggable = true;
    });
    control.attach(model);
    scene.add(control);
    this.control = control;

    this.bindState = {
      model,
      control,
    };

    this.attributeChangedCallback('src', null, this.getAttribute('src'));
    this.attributeChangedCallback('position', null, this.getAttribute('position'));
    this.attributeChangedCallback('orientation', null, this.getAttribute('orientation'));
    this.attributeChangedCallback('scale', null, this.getAttribute('scale'));

    control.addEventListener('change', e => {
      /* const editedEl = toolManager.getEditedElement();
      if (editedEl) {
        toolManager.clampPositionToElementExtent(control.object.position, editedEl);
      } */

      this.position = control.object.position.toArray();
      this.orientation = control.object.quaternion.toArray();
      this.scale = control.object.scale.toArray();
    });
  }
  disconnectedCallback() {
    console.log('disconnected', this);

    const {model, control} = this.bindState;

    container.remove(model);
    scene.remove(control);
    control.dispose();

    this.bindState = null;
  }

  get src() {
    return this.getAttribute('src');
  }
  set src(src) {
    this.setAttribute('src', src);
  }

  get position() {
    const s = this.getAttribute('position');
    return s ? s.split(' ').map(s => parseFloat(s)) : [0, 0, 0];
  }
  set position(position) {
    if (!Array.isArray(position)) {
      position = Array.from(position);
    }
    if (position.length === 3 && position.every(n => isFinite(n))) {
      const oldPosition = this.position;
      if (position.some((n, i) => n !== oldPosition[i])) {
        this.setAttribute('position', position.join(' '));
      }
    }
  }

  get orientation() {
    const s = this.getAttribute('orientation');
    return s ? s.split(' ').map(s => parseFloat(s)) : [0, 0, 0, 1];
  }
  set orientation(orientation) {
    if (!Array.isArray(orientation)) {
      orientation = Array.from(orientation);
    }
    if (orientation.length === 4 && orientation.every(n => isFinite(n))) {
      const oldOrientation = this.orientation;
      if (orientation.some((n, i) => n !== oldOrientation[i])) {
        this.setAttribute('orientation', orientation.join(' '));
      }
    }
  }

  get scale() {
    const s = this.getAttribute('scale');
    return s ? s.split(' ').map(s => parseFloat(s)) : [1, 1, 1];
  }
  set scale(scale) {
    if (!Array.isArray(scale)) {
      scale = Array.from(scale);
    }
    if (scale.length === 3 && scale.every(n => isFinite(n))) {
      const oldScale = this.scale;
      if (scale.some((n, i) => n !== oldScale[i])) {
        this.setAttribute('scale', scale.join(' '));
      }
    }
  }
}
customElements.define('xr-model', XRModel);

const userHeight = 1.7;
const _getHeightFactor = rigHeight => rigHeight / userHeight;

let rig = null;
let modelUrl = '';
let heightFactor = 0;
const _updateXrIframeMatrices = () => {
  container.updateMatrix();
  const xrIframes = document.querySelectorAll('xr-iframe');
  const numXrIframes = xrIframes.length;
  for (let i = 0; i < numXrIframes; i++) {
    const xrIframe = xrIframes[i];
    container.matrix.toArray(xrIframe.parentXrOffset.matrix);
    xrIframe.parentXrOffset.flagUpdate();
  }
};
const _makeAvatar = (model, options, name) => {
  const rig = new Avatar(model, options);
  rig.nametagMesh = null;
  fontPromise.then(() => {
    rig.nametagMesh = _makeNametagMesh(_makeTextMesh(name, 0xFFFFFF, 2));
    rig.nametagMesh.visible = nameTagsSwitchWrap.classList.contains('on');
    container.add(rig.nametagMesh);
  });
  rig.destroy = (destroy => function() {
    container.remove(rig.model);
    container.remove(rig.nametagMesh);
  })(rig.destroy);
  container.add(rig.model);
  return rig;
};
const _setLocalModel = newModel => {
  if (rig) {
    container.remove(rig.model);
    rig.destroy();
    rig = null;
  }

  rig = _makeAvatar(newModel, {
    fingers: true,
    hair: true,
    visemes: true,
    decapitate: possessRig,
    microphoneMediaStream,
    // debug: !newModel,
  }, loginToken ? loginToken.name : 'Anonymous');
  // window.model = newModel;

  heightFactor = _getHeightFactor(rig.height);

  container.scale.set(1, 1, 1).divideScalar(heightFactor);
  _updateXrIframeMatrices();
};

const lastPresseds = [false, false];
const lastBs = [false, false];
const lastPads = [false, false];
const lastPadXs = [0, 0];
const lastPositions = [new THREE.Vector3(), new THREE.Vector3()];
const startGripPositions = [new THREE.Vector3(), new THREE.Vector3()];
const startSceneMatrix = new THREE.Matrix4();
let startModelScale = 1;
const dateOffset = Math.floor(Math.random() * 60 * 1000);
const realDateNow = (now => () => dateOffset + now())(Date.now);
let fakeXrDisplay = null;
let possessRig = false;
let lastTimestamp = Date.now();
function animate(timestamp, frame, referenceSpace) {
  const now = Date.now();
  const timeDiff = now - lastTimestamp;

  for (let i = 0; i < floorMeshes.length; i++) {
    floorMeshes[i].material.uniforms.uAnimation.value = (now%2000)/2000;
  }

  if (rig) {
    if (possessRig) {
      const vrCameras = renderer.vr.getCamera(camera).cameras;
      const vrCamera = vrCameras[0];
      const vrCamera2 = vrCameras[1];
      vrCamera.matrixWorld.decompose(vrCamera.position, vrCamera.quaternion, vrCamera.scale);
      vrCamera2.matrixWorld.decompose(vrCamera2.position, vrCamera2.quaternion, vrCamera2.scale);
      vrCamera.position.add(vrCamera2.position).divideScalar(2);
      const inputSources = Array.from(session.inputSources);
      const gamepads = navigator.getGamepads();

      const containerMatrixInverse = localMatrix.getInverse(localMatrix.compose(container.position, container.quaternion, localVector.set(1, 1, 1)));
      localMatrix2
        .compose(vrCamera.position, vrCamera.quaternion, localVector.set(1, 1, 1))
        .premultiply(containerMatrixInverse)
        .decompose(rig.inputs.hmd.position, rig.inputs.hmd.quaternion, localVector);
      rig.inputs.hmd.position.multiplyScalar(heightFactor);

      const _getGamepad = i => {
        const handedness = i === 0 ? 'left' : 'right';
        const inputSource = inputSources.find(inputSource => inputSource.handedness === handedness);
        let pose, gamepad;
        if (inputSource && (pose = frame.getPose(inputSource.gripSpace, referenceSpace)) && (gamepad = inputSource.gamepad || gamepads[i])) {
          const {transform} = pose;
          const {position, orientation, matrix} = transform;
          if (position) {
            const rawP = localVector.copy(position);
            const p = localVector2;
            const q = localQuaternion;
            localMatrix2
              .compose(p.copy(rawP), q.copy(orientation), localVector3.set(1, 1, 1))
              .premultiply(containerMatrixInverse)
              .decompose(p, q, localVector3);
            p.multiplyScalar(heightFactor);
            const pressed = gamepad.buttons[0].pressed;
            const lastPressed = lastPresseds[i];
            const pointer = gamepad.buttons[0].value;
            const grip = gamepad.buttons[1].value;
            const pad = gamepad.axes[1] <= -0.5 || gamepad.axes[3] <= -0.5;
            const lastPad = lastPads[i];
            const padX = gamepad.axes[0] !== 0 ? gamepad.axes[0] : gamepad.axes[2];
            const lastPadX = lastPadXs[i];
            const padY = gamepad.axes[1] !== 0 ? gamepad.axes[1] : gamepad.axes[3];
            const stick = !!gamepad.buttons[3] && gamepad.buttons[3].pressed;
            const a = !!gamepad.buttons[4] && gamepad.buttons[4].pressed;
            const b = !!gamepad.buttons[5] && gamepad.buttons[5].pressed;
            const lastB = lastBs[i];
            return {
              rawPosition: rawP,
              position: p,
              quaternion: q,
              pressed,
              lastPressed,
              pointer,
              grip,
              pad,
              lastPad,
              padX,
              lastPadX,
              padY,
              stick,
              a,
              b,
              lastB,
            };
          } else {
            return null;
          }
        } else {
          return null;
        }
      };
      const _updateTeleportMesh = (i, pad, lastPad, position, quaternion, padX, lastPadX) => {
        const teleportMesh = teleportMeshes[i];
        teleportMesh.visible = false;

        if (pad) {
          localVector.copy(position);
          localEuler.setFromQuaternion(quaternion, 'YXZ');

          for (let i = 0; i < 20; i++, localVector.add(localVector2), localEuler.x = Math.max(localEuler.x - Math.PI*0.07, -Math.PI/2)) {
            localRay.set(localVector, localVector2.set(0, 0, -1).applyQuaternion(localQuaternion.setFromEuler(localEuler)));
            const intersection = localRay.intersectPlane(floorPlane, localVector3);
            if (intersection && intersection.distanceTo(localRay.origin) <= 1) {
              teleportMesh.position.copy(intersection);
              localEuler.setFromQuaternion(localQuaternion, 'YXZ');
              localEuler.x = 0;
              localEuler.z = 0;
              teleportMesh.quaternion.setFromEuler(localEuler);
              teleportMesh.visible = true;
              break;
            }
          }
        } else if (lastPad) {
          localVector.copy(teleportMesh.position).applyMatrix4(container.matrix).sub(vrCamera.position);
          localVector.y = 0;
          container.position.sub(localVector);
        }

        if (padX >= 0.9 && lastPadX < 0.9) {
          container.quaternion.multiply(localQuaternion.setFromAxisAngle(localVector.set(0, 1, 0), Math.PI*0.25));
          container.position.applyQuaternion(localQuaternion);
        }
        if (padX <= -0.9 && lastPadX >= -0.9) {
          container.quaternion.multiply(localQuaternion.setFromAxisAngle(localVector.set(0, 1, 0), -Math.PI*0.25));
          container.position.applyQuaternion(localQuaternion);
        }
      };
      const _updateWalkMesh = (i, position, quaternion, padX, padY, stick) => {
        const teleportMesh = teleportMeshes[i];
        teleportMesh.visible = false;

        if (padX !== 0 || padY !== 0) {
          localVector.set(padX, 0, padY);
          const moveLength = localVector.length();
          if (moveLength > 1) {
            localVector.divideScalar(moveLength);
          }
          const hmdEuler = localEuler.setFromQuaternion(rig.inputs.hmd.quaternion, 'YXZ');
          localEuler.x = 0;
          localEuler.z = 0;
          container.position.sub(
            localVector.multiplyScalar(walkSpeed * timeDiff * (stick ? 3 : 1) * rig.height)
              .applyEuler(hmdEuler)
              .applyQuaternion(container.quaternion)
          );

          _updateXrIframeMatrices();
        }
      };

      const wasLastBd = lastBs[0] && lastBs[1];

      const lg = _getGamepad(1);
      if (lg) {
        const {rawPosition, position, quaternion, pressed, lastPressed, pointer, grip, pad, lastPad, padX, lastPadX, padY, b} = lg;
        rig.inputs.leftGamepad.quaternion.copy(quaternion);
        rig.inputs.leftGamepad.position.copy(position);
        rig.inputs.leftGamepad.pointer = pointer;
        rig.inputs.leftGamepad.grip = grip;

        _updateTeleportMesh(1, pad, lastPad, position, quaternion, padX, lastPadX);

        lastPresseds[1] = pressed;
        lastPads[1] = pad;
        lastPadXs[1] = padX;
        lastBs[1] = b;
        lastPositions[1].copy(rawPosition);
      }
      const rg = _getGamepad(0);
      if (rg) {
        const {rawPosition, position, quaternion, pressed, lastPressed, pointer, grip, pad, padX, padY, stick, b} = rg;
        rig.inputs.rightGamepad.quaternion.copy(quaternion);
        rig.inputs.rightGamepad.position.copy(position);
        rig.inputs.rightGamepad.pointer = pointer;
        rig.inputs.rightGamepad.grip = grip;

        _updateWalkMesh(0, position, quaternion, padX, padY, stick);

        lastPresseds[0] = pressed;
        lastPads[0] = pad;
        lastPadXs[0] = padX;
        lastBs[0] = b;
        lastPositions[0].copy(rawPosition);
      }

      const _startScale = () => {
        for (let i = 0; i < startGripPositions.length; i++) {
          startGripPositions[i].copy(lastPositions[i]);
        }
        startSceneMatrix.copy(container.matrix);
        startModelScale = rig ? rig.inputs.hmd.scaleFactor : 1;
      };
      const _processScale = () => {
        const startDistance = startGripPositions[0].distanceTo(startGripPositions[1]);
        const currentDistance = lastPositions[0].distanceTo(lastPositions[1]);
        const scaleFactor = currentDistance / startDistance;

        let startGripPosition = localVector3.copy(startGripPositions[0]).add(startGripPositions[1]).divideScalar(2)
        let currentGripPosition = localVector4.copy(lastPositions[0]).add(lastPositions[1]).divideScalar(2)
        startGripPosition.applyMatrix4(localMatrix.getInverse(startSceneMatrix));
        currentGripPosition.applyMatrix4(localMatrix/*.getInverse(startSceneMatrix)*/);

        const positionDiff = localVector5.copy(currentGripPosition).sub(startGripPosition);

        container.matrix.copy(startSceneMatrix)
          .multiply(localMatrix.makeTranslation(currentGripPosition.x, currentGripPosition.y, currentGripPosition.z))
          .multiply(localMatrix.makeScale(scaleFactor, scaleFactor, scaleFactor))
          .multiply(localMatrix.makeTranslation(-currentGripPosition.x, -currentGripPosition.y, -currentGripPosition.z))
          .multiply(localMatrix.makeTranslation(positionDiff.x, positionDiff.y, positionDiff.z))
          .decompose(container.position, container.quaternion, container.scale);

        _updateXrIframeMatrices();

        if (rig) {
          rig.inputs.hmd.scaleFactor = startModelScale / scaleFactor;
        }

        // _startScale();
      };
      const isLastBd = lastBs[0] && lastBs[1];
      if (!wasLastBd && isLastBd) {
        _startScale();
      } else if (isLastBd) {
        _processScale();
      }

      /* for (let i = 0; i < mirrorMesh.buttonMeshes.length; i++) {
        mirrorMesh.buttonMeshes[i].material.color.setHex((i === li || i === ri) ? colors.highlight : colors.normal);
      } */

      rig.update();
    } else if (controlsBound) {
      // defer
    } else {
      const positionOffset = Math.sin((realDateNow()%10000)/10000*Math.PI*2)*2;
      const positionOffset2 = -Math.sin((realDateNow()%5000)/5000*Math.PI*2)*1;
      const standFactor = rig.height - 0.1*rig.height + Math.sin((realDateNow()%2000)/2000*Math.PI*2)*0.2*rig.height;
      const rotationAngle = (realDateNow()%5000)/5000*Math.PI*2;

      // rig.inputs.hmd.position.set(positionOffset, 0.6 + standFactor, 0);
      rig.inputs.hmd.position.set(positionOffset, standFactor, positionOffset2);
      rig.inputs.hmd.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationAngle)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin((realDateNow()%2000)/2000*Math.PI*2)*Math.PI*0.2))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin((realDateNow()%2000)/2000*Math.PI*2)*Math.PI*0.25));

      rig.inputs.rightGamepad.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationAngle)
        // .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin((realDateNow()%5000)/5000*Math.PI*2)*Math.PI*0.6));
      rig.inputs.rightGamepad.position.set(positionOffset, rig.height*0.7 + Math.sin((realDateNow()%2000)/2000*Math.PI*2)*0.1, positionOffset2).add(
        new THREE.Vector3(-rig.shoulderWidth/2, 0, -0.2).applyQuaternion(rig.inputs.rightGamepad.quaternion)
      )/*.add(
        new THREE.Vector3(-0.1, 0, -1).normalize().multiplyScalar(rig.rightArmLength*0.4).applyQuaternion(rig.inputs.rightGamepad.quaternion)
      ); */
      rig.inputs.leftGamepad.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationAngle);
      rig.inputs.leftGamepad.position.set(positionOffset, rig.height*0.7, positionOffset2).add(
        new THREE.Vector3(rig.shoulderWidth/2, 0, -0.2).applyQuaternion(rig.inputs.leftGamepad.quaternion)
      )/*.add(
        new THREE.Vector3(0.1, 0, -1).normalize().multiplyScalar(rig.leftArmLength*0.4).applyQuaternion(rig.inputs.leftGamepad.quaternion)
      );*/

      rig.inputs.leftGamepad.pointer = (Math.sin((now%10000)/10000*Math.PI*2) + 1) / 2;
      rig.inputs.leftGamepad.grip = (Math.sin((now%10000)/10000*Math.PI*2) + 1) / 2;

      rig.inputs.rightGamepad.pointer = (Math.sin((now%10000)/10000*Math.PI*2) + 1) / 2;
      rig.inputs.rightGamepad.grip = (Math.sin((now%10000)/10000*Math.PI*2) + 1) / 2;

      rig.update();
    }
  }

  if (rig && rig.nametagMesh && rig.nametagMesh.visible) {
    rig.nametagMesh.position.copy(rig.inputs.hmd.position).add(localVector.set(0, 0.2, 0));
    rig.nametagMesh.quaternion.copy(camera.quaternion);
  }
  for (let i = 0; i < peerConnections.length; i++) {
    const peerConnection = peerConnections[i];
    if (peerConnection.rig && peerConnection.rig.nametagMesh && peerConnection.rig.nametagMesh.visible) {
      peerConnection.rig.nametagMesh.position.copy(peerConnection.rig.inputs.hmd.position).add(localVector.set(0, 0.2, 0));
      peerConnection.rig.nametagMesh.quaternion.copy(camera.quaternion);
    }
  }

  if (landConnection) {
    const intersection = toolManager.getHover();
    if (intersection && (intersection.type === 'floor' || intersection.type === 'parcel')) {
      const xs = [intersection.start.x, intersection.end.x];
      const ys = [intersection.start.z, intersection.end.z];
      for (let i = 0; i < floorMeshes.length; i++) {
        const floorMesh = floorMeshes[i];
        floorMesh.material.uniforms.uHover.value = +_containsPosition(xs[0], ys[0], xs[1], ys[1], floorMesh.position);
      }
    } else {
      for (let i = 0; i < floorMeshes.length; i++) {
        floorMeshes[i].material.uniforms.uHover.value = 0;
      }
    }
  } /* else {
    for (let i = 0; i < floorMeshes.length; i++) {
      const floorMesh = floorMeshes[i];
      floorMesh.material.uniforms.uCurrentParcel.value.set(0, 0, 0, 0);
      floorMesh.material.uniforms.uHoverParcel.value.set(0, 0, 0, 0);
    }
  } */

  renderer.render(scene, camera);

  for (let i = 0; i < peerConnections.length; i++) {
    const peerConnection = peerConnections[i];
    if (peerConnection.rig) {
      peerConnection.rig.update();
    }
  }

  if (rig) {
    if (controlsBound) {
      localEuler.setFromQuaternion(rig.inputs.hmd.quaternion, 'YXZ');
      localEuler.x = Math.min(Math.max(localEuler.x - mouse.movementY * 0.01, -Math.PI/2), Math.PI/2);
      localEuler.y -= mouse.movementX * 0.01
      localEuler.z = 0;
      rig.inputs.hmd.quaternion.setFromEuler(localEuler);
      mouse.movementX = 0;
      mouse.movementY = 0;

      localEuler.setFromQuaternion(rig.inputs.hmd.quaternion, 'YXZ');
      localEuler.x = 0;
      localEuler.z = 0;
      const floorRotation = localQuaternion.setFromEuler(localEuler);

      localVector.set(0, 0, 0);
      if (keys.left) {
        localVector.x += -1;
      }
      if (keys.right) {
        localVector.x += 1;
      }
      if (keys.up) {
        localVector.z += -1;
      }
      if (keys.down) {
        localVector.z += 1;
      }
      rig.inputs.hmd.position.add(localVector.normalize().multiplyScalar(walkSpeed * timeDiff * (keys.shift ? 3 : 1) * rig.height).applyQuaternion(floorRotation));
      if (keys.space) {
        const lerpFactor = 0.3;
        rig.inputs.hmd.position.y = rig.inputs.hmd.position.y * (1-lerpFactor) + rig.height*1.1 * lerpFactor;
      } else if (keys.z) {
        const lerpFactor = 0.05;
        rig.inputs.hmd.position.y = rig.inputs.hmd.position.y * (1-lerpFactor) + rig.height*0.2 * lerpFactor;
      } else if (keys.c) {
        const lerpFactor = 0.2;
        rig.inputs.hmd.position.y = rig.inputs.hmd.position.y * (1-lerpFactor) + rig.height*0.7 * lerpFactor;
      } else {
        const lerpFactor = 0.3;
        rig.inputs.hmd.position.y = rig.inputs.hmd.position.y * (1-lerpFactor) + rig.height*0.9 * lerpFactor;
      }

      rig.inputs.leftGamepad.position.copy(rig.inputs.hmd.position)
        .add(localVector.set(0.15, -0.15, -0.2).multiplyScalar(rig.height).applyQuaternion(rig.inputs.hmd.quaternion));
      rig.inputs.leftGamepad.quaternion.copy(rig.inputs.hmd.quaternion)
        .multiply(localQuaternion2.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI*0.5));
      rig.inputs.rightGamepad.position.copy(rig.inputs.hmd.position)
        .add(localVector.set(-0.15, -0.15, -0.2).multiplyScalar(rig.height).applyQuaternion(rig.inputs.hmd.quaternion));
      rig.inputs.rightGamepad.quaternion.copy(rig.inputs.hmd.quaternion)
        .multiply(localQuaternion2.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI*0.5))

      if (controlsBound === 'firstperson') {
        rig.decapitate();
      } else {
        rig.undecapitate();
      }

      rig.update();

      if (controlsBound === 'firstperson') {
        rig.outputs.eyes.matrixWorld.decompose(camera.position, camera.quaternion, localVector);
        camera.position.divideScalar(heightFactor).add(container.position);
        camera.quaternion.multiply(z180Quaternion);
      } else if (controlsBound === 'thirdperson') {
        rig.outputs.eyes.matrixWorld.decompose(camera.position, camera.quaternion, localVector);
        camera.position.divideScalar(heightFactor).add(container.position);
        camera.quaternion.multiply(z180Quaternion);
        camera.position.add(localVector.set(0, 0.5, 2).applyQuaternion(camera.quaternion));
      }
    }
  }

  if (fakeXrDisplay && !possessRig) {
    fakeXrDisplay.position.copy(camera.position);
    fakeXrDisplay.quaternion.copy(camera.quaternion);
    fakeXrDisplay.pushUpdate();
  }

  lastTimestamp = now;
}
renderer.setAnimationLoop(animate);

let fontJson, fontTexture;
const fontPromise = Promise.all([
  fetch('DejaVu-sdf.json').then(res => res.json()),
  new Promise((accept, reject) => {
    new THREE.TextureLoader().load('DejaVu-sdf.png', accept);
  }),
]).then(results => {
  fontJson = results[0];
  fontTexture = results[1];
});

const mouse = {
  movementX: 0,
  movementY: 0,
};
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  z: false,
  c: false,
  space: false,
  shift: false,
};
let controlsBound = null;
let unbindControls = null;
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && unbindControls) {
    unbindControls();
    unbindControls = null;
  }
});

const inventoryContentTab = topDocument.getElementById('inventory-content-tab');
const chat = topDocument.getElementById('chat');
const chatMessages = topDocument.getElementById('chat-messages');
const chatInput = topDocument.getElementById('chat-input');
let transformMode = 'translate';
chat.addEventListener('submit', e => {
  e.preventDefault();

  if (chatInput.value) {
    const messageEl = topDocument.createElement('message');
    messageEl.classList.add('message');
    messageEl.innerHTML = `<div class=message><b>you</b>: <span class=text></span></div>`;
    const textEl = messageEl.querySelector('.text');
    textEl.innerText = chatInput.value;
    chatMessages.appendChild(messageEl);

    chatInput.value = '';
    chatInput.dispatchEvent(new CustomEvent('change'));

    setTimeout(() => {
      chatMessages.removeChild(messageEl);
    }, 10000);
  }
});
const _inputFocused = () => {
  const {activeElement} = topDocument;
  return activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
};
const _keydown = e => {
  if (!controlsBound) {
    const _setMode = mode => {
      transformMode = mode;
      Array.from(document.querySelectorAll('xr-iframe')).concat(Array.from(document.querySelectorAll('xr-model'))).forEach(xrNode => {
        xrNode.bindState.control.setMode(mode);
      });
    };
    switch (e.which) {
      case 87: { // W
        if (!_inputFocused()) {
          _setMode('translate');
        }
        break;
      }
      case 69: { // E
        if (!_inputFocused()) {
          _setMode('rotate');
        }
        break;
      }
      case 82: { // R
        if (!_inputFocused()) {
          _setMode('scale');
        }
        break;
      }
      case 83: { // S
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          saveDialog.classList.add('open');
          saveNameInput.focus();
        }
        break;
      }
      case 79: { // O
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          console.log('click');
          inventoryContentTab.click();
        }
        break;
      }
      /* case 49: // 1
      case 50: // 2
      case 51: // 3
      case 52: // 4
      {
        toolManager.selectTool(e.which - 49);
        break;
      } */
      case 27: { // esc
        if (saveDialog.classList.contains('open')) {
          saveDialog.classList.remove('open');
        } else if (chatInput.classList.contains('open')) {
          chatInput.classList.remove('open');
          chatInput.value = '';
        } else {
          toolManager.reset();
        }
        break;
      }
      case 46: { // del
        if (!chatInput.classList.contains('open') && !saveDialog.classList.contains('open')) {
          toolManager.delete();
        }
        break;
      }
      case 13: { // enter
        const {activeElement} = topDocument;
        if (activeElement === saveNameInput) {
          saveDialog.dispatchEvent(new CustomEvent('submit'));
        } else {
          chatInput.classList.toggle('open');
          if (chatInput.classList.contains('open')) {
            chatInput.focus();
          } else {
            chat.dispatchEvent(new CustomEvent('submit'));
          }
        }
        break;
      }
    }
  }
  switch (e.which) {
    case 71: { // G
      if (!_inputFocused() && !e.ctrlKey && !e.metaKey) {
        topBody.classList.toggle('fullscreen');
      }
      break;
    }
  }
};
window.addEventListener('keydown', _keydown);

const header = topDocument.getElementById('header');
const mainSelector = topDocument.getElementById('main-selector');
mainSelector.addEventListener('focus', () => {
  mainSelector.classList.add('open');
});
mainSelector.addEventListener('blur', () => {
  mainSelector.classList.remove('open');
});
const mainOptions = Array.from(mainSelector.querySelectorAll('.option'));
for (let i = 0; i < mainOptions.length; i++) {
  const mainOption = mainOptions[i];
  mainOption.addEventListener('click', e => {
    if (!header.classList.contains(`main-${i+1}`)) {
      for (let i = 0; i < mainOptions.length; i++) {
        header.classList.remove(`main-${i+1}`);
        mainOptions[i].classList.remove('open');
      }
      mainOption.classList.add('open');
      mainSelector.blur();
      mainSelector.dispatchEvent(new CustomEvent('blur'));
      header.classList.add(`main-${i+1}`);

      if (channelConnection) {
        channelConnection.disconnect();
        channelConnection = null;
      }
      if (landConnection) {
        landConnection.disconnect();
        landConnection = null;

        setTimeout(() => {
          toolManager.reset();
        });
      } else {
        toolManager.reset();
      }
      landElement.innerHTML = '';
      lastParcelKey = '';

      switch (i) {
        case 0: {
          break;
        }
        case 1: {
          break;
        }
        case 2: {
          console.log('connect to land');
          landConnection = _connectLand();
          break;
        }
      }
    }
  });
}

const saveDialog = topDocument.getElementById('save-dialog');
const saveNameInput = topDocument.getElementById('save-name-input');
saveDialog.addEventListener('submit', e => {
  e.preventDefault();

  const username = loginToken.name;
  const filename = saveNameInput.value;
  const headers = {
    'Content-Type': 'text/html',
  };
  fetch(`https://upload.exokit.org/${username}/${filename}?email=${encodeURIComponent(loginToken.email)}&token=${encodeURIComponent(loginToken.token)}`, {
    method: 'POST',
    headers,
  })
    .then(res => {
      if (res.ok) {
        return res.text();
      } else {
        throw new Errors(`invalid status code: ${res.status}`);
      }
    })
    .then(u => {
      console.log('save result 1', u);
      return fetch(u, {
        method: 'PUT',
        body: codeInput.value,
        headers,
      });
    })
    .then(res => {
      if (res.ok) {
        return res.text();
      } else {
        throw new Errors(`invalid status code: ${res.status}`);
      }
    })
    .then(s => {
      console.log('save result 2', `https://content.exokit.org/${username}/${filename}`);

      saveDialog.classList.remove('open');
      saveNameInput.value = '';
    });
});

let landConnection = null;
const _getCameraPosition = () => {
  const position = (() => {
    if (renderer.vr.enabled) {
      const vrCameras = renderer.vr.getCamera(camera).cameras;
      const vrCamera = vrCameras[0];
      vrCamera.matrixWorld.decompose(vrCamera.position, vrCamera.quaternion, vrCamera.scale);
      return vrCamera.position;
    } else {
      return camera.position;
    }
  })();
  return [position.x, position.z];
};
const _getCurrentParcelCoords = () => {
  const [x, z] = _getCameraPosition();
  return [Math.floor((x + parcelSize/2)/parcelSize), Math.floor((z + parcelSize/2)/parcelSize)];
};
const _getRequiredParcelCoords = (x, z) => [
  [x-1, z-1],
  [x-1, z],
  [x-1, z+1],
  [x, z-1],
  [x, z],
  [x, z+1],
  [x+1, z-1],
  [x+1, z],
  [x+1, z+1],
];
let lastParcelKey = '';
const _getAllParcelXrSites = dom => Array.from(dom.childNodes).filter(node => node.tagName === 'XR-SITE');
const _getParcelCoords = xrSite => {
  const extents = THREE.Land.parseExtents(xrSite.getAttribute('extents'));
  return extents.flatMap(extent => {
    const [x1, y1, x2, y2] = extent;
    const result = [];
    for (let x = x1 + parcelSize/2; x < x2; x += parcelSize) {
      for (let y = y1 + parcelSize/2; y < y2; y += parcelSize) {
        result.push([x/parcelSize, y/parcelSize]);
      }
    }
    return result;
  });
};
const _removeParcelDomNode = (dom, removeNode) => {
  const _recurse = node => {
    if (node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        const childNode = node.childNodes[i];
        if (childNode === removeNode) {
          node.childNodes.splice(i, 1);
          break;
        } else {
          _recurse(childNode);
        }
      }
    }
  };
  _recurse(dom);
};
const _getParcelXrSite = (landElement, coord) => {
  const xrSites = _getAllParcelXrSites(landElement);
  const ax = coord[0]*parcelSize;
  const ay = coord[1]*parcelSize;
  for (let i = 0; i < xrSites.length; i++) {
    const xrSite = xrSites[i];
    const extents = THREE.Land.parseExtents(xrSite.getAttribute('extents'));
    for (let j = 0; j < extents.length; j++) {
      const [x1, y1, x2, y2] = extents[j];
      for (let x = x1 + parcelSize/2; x < x2; x += parcelSize) {
        for (let y = y1 + parcelSize/2; y < y2; y += parcelSize) {
          if (ax === x && ay === y) {
            return xrSite;
          }
        }
      }
    }
  }
  return null;
};
/* const _setParcelAttribute = (node, attributeName, attributeValue) => {
  let attr = null;
  for (const name in node.attrs) {
    if (name === attributeName) {
      attr = node.attrs[name];
    }
  }
  if (!attr) {
    attr = {name: '', value: ''};
    node.attrs[attributeName] = attr;
  }
  attr.name = attributeName;
  attr.value = attributeValue;
}; */
const _htmlToDomNode = html => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.childNodes[0];
};
const _connectLand = () => {
  let running = false;
  const _updateGrid = async () => {
    if (!running) {
      running = true;

      // if (!toolManager.getEditedElement()) {
        const coord = _getCurrentParcelCoords();
        const k = coord.join(':');
        if (k !== lastParcelKey) {
          const [x, z] = coord;
          const requiredParcelCoords = _getRequiredParcelCoords(x, z);
          const outrangedFloors = floorMeshes.filter(floorMesh => !requiredParcelCoords.some(coord2 =>
            floorMesh.position.x/parcelSize === coord2[0] && floorMesh.position.z/parcelSize === coord2[1]
          ));
          const missingFloorCoords = requiredParcelCoords.filter(coord2 => !floorMeshes.some(floorMesh =>
            floorMesh.position.x/parcelSize === coord2[0] && floorMesh.position.z/parcelSize === coord2[1]
          ));
          const outrangedParcels = Array.from(landElement.childNodes)
            .filter(xrSite => { // non-pending parcels where every coord is at least 2 away
              return !xrSite.getAttribute('pending') && !_getParcelCoords(xrSite).some(coord2 => {
                localVector2D.fromArray(coord2);
                return requiredParcelCoords.some(coord3 => localVector2D2.fromArray(coord3).equals(localVector2D));
              });
            });
          const missingParcelCoords = requiredParcelCoords.filter(coord => !_getParcelXrSite(landElement, coord));
          const outrangedParcelCoords = outrangedParcels.map(xrSite => _getParcelCoords(xrSite));
          /* if (outrangedParcelCoords.some(coord2 => {
            localVector2D.fromArray(coord2);
            return missingParcelCoords.some(coord3 => {
              return localVector2D2.fromArray(coord3).equals(localVector2D);
            });
          })) {
            console.log(missingParcelCoords, outrangedParcelCoords);
            debugger;
          } */
          for (let i = 0; i < outrangedParcels.length; i++) {
            landElement.removeChild(outrangedParcels[i]);
          }
          const seenCoords = {};
          await Promise.all(missingParcelCoords.map(async coord => {
            const [x, z] = coord;
            const k = coord.join(':');
            const res = await fetch(`https://grid.exokit.org/parcels/${x}/${z}`);
            if (res.ok) {
              let parcel = await res.json();
              if (parcel) {
                let minX = Infinity;
                let minZ = Infinity;
                let maxX = -Infinity;
                let maxZ = -Infinity;
                for (let i = 0; i < parcel.coords.length; i++) {
                  const coord = parcel.coords[i];
                  const k = coord.join(':');
                  if (seenCoords[k]) { // already did this coord, so bail
                    return;
                  } else {
                    const [px, pz] = coord;
                    minX = Math.min(px, minX);
                    minZ = Math.min(pz, minZ);
                    maxX = Math.max(px, maxX);
                    maxZ = Math.max(pz, maxZ);
                  }
                }
                const extents = [[minX*parcelSize-parcelSize/2, minZ*parcelSize-parcelSize/2, (maxX+1)*parcelSize-parcelSize/2, (maxZ+1)*parcelSize-parcelSize/2]];
                let node = _htmlToDomNode(parcel.html);
                if (!(node && node.tagName === 'XR-SITE')) {
                  console.warn('failed to load non-site parcel:', parcel.html);
                  node = document.createElement('xr-site');
                }

                node.setAttribute('extents', THREE.Land.serializeExtents(extents));
                landElement.appendChild(node);

                for (let i = 0; i < parcel.coords.length; i++) {
                  const coord = parcel.coords[i];
                  const k = coord.join(':');
                  seenCoords[k] = true;
                }
              }
            } else {
              console.warn('failed to get parcels', res.status);
            }
          }));
          lastParcelKey = k;

          Array.from(document.querySelectorAll('xr-site')).some(xrSite => {
            if (xrSite.guardianMesh) {
              const color = _getSelectedColor(xrSite);
              xrSite.guardianMesh.material.uniforms.uColor.value.setHex(color);
              xrSite.guardianMesh.visible = color !== colors.normal;
            }
          });

          for (let i = 0; i < outrangedFloors.length; i++) {
            const floorMesh = outrangedFloors[i];
            container.remove(floorMesh);
            floorMeshes.splice(floorMeshes.indexOf(floorMesh), 1);
          }
          for (let i = 0; i < missingFloorCoords.length; i++) {
            const [x, z] = missingFloorCoords[i];
            const floorMesh = _makeFloorMesh(x, z);
            container.add(floorMesh);
            floorMeshes.push(floorMesh);
          }
          for (let i = 0; i < floorMeshes.length; i++) {
            floorMeshes[i].update();
          }
        }
      // }

      running = false;
    }
  }
  _updateGrid();
  const updateInterval = setInterval(_updateGrid, 500);

  return {
    disconnect() {
      /* const selectedElement = toolManager.getSelectedElement();
      if (selectedElement && selectedElement.tagName === 'XR-SITE') {
        toolManager.deselect();
      } */
      _resetCodeInput();

      clearInterval(updateInterval);
    },
  };
};

const _bindControls = type => {
  const _keydown = e => {
    switch (e.which) {
      case 65: {
        keys.left = true;
        break;
      }
      case 68: {
        keys.right = true;
        break;
      }
      case 87: {
        keys.up = true;
        break;
      }
      case 83: {
        keys.down = true;
        break;
      }
      case 90: {
        keys.z = true;
        break;
      }
      case 67: {
        keys.c = true;
        break;
      }
      case 32: {
        keys.space = true;
        break;
      }
      case 16: {
        keys.shift = true;
        break;
      }
    }
  };
  window.addEventListener('keydown', _keydown);
  const _keyup = e => {
    switch (e.which) {
      case 65: {
        keys.left = false;
        break;
      }
      case 68: {
        keys.right = false;
        break;
      }
      case 87: {
        keys.up = false;
        break;
      }
      case 83: {
        keys.down = false;
        break;
      }
      case 90: {
        keys.z = false;
        break;
      }
      case 67: {
        keys.c = false;
        break;
      }
      case 32: {
        keys.space = false;
        break;
      }
      case 16: {
        keys.shift = false;
        break;
      }
    }
  };
  window.addEventListener('keyup', _keyup);
  const _mousemove = e => {
    mouse.movementX += e.movementX;
    mouse.movementY += e.movementY;
  };
  window.addEventListener('mousemove', _mousemove);
  orbitControls.enabled = false;
  controlsBound = type;

  unbindControls = () => {
    window.addEventListener('keydown', _keydown);
    window.addEventListener('keyup', _keyup);
    window.removeEventListener('mousemove', _mousemove);
    orbitControls.target.copy(camera.position).add(new THREE.Vector3(0, 0, -3).applyQuaternion(camera.quaternion));
    orbitControls.enabled = true;
    controlsBound = null;
  };
};
const firstpersonButton = topDocument.getElementById('firstperson-button');
firstpersonButton.addEventListener('click', async () => {
  if (rig) {
    await renderer.domElement.requestPointerLock();
    _bindControls('firstperson');
  }
});
const thirdpersonButton = topDocument.getElementById('thirdperson-button');
thirdpersonButton.addEventListener('click', async () => {
  if (rig) {
    await renderer.domElement.requestPointerLock();
    _bindControls('thirdperson');
  }
});

gridMeshSwitchWrap.addEventListener('click', () => {
  gridMeshSwitchWrap.classList.toggle('on');

  const enabled = gridMeshSwitchWrap.classList.contains('on');
  for (let i = 0; i < floorMeshes.length; i++) {
    floorMeshes[i].visible = enabled;
  }
  if (enabled) {
    localStorage.removeItem('gridHelper');
  } else {
    localStorage.setItem('gridHelper', false);
  }
});

mirrorMeshSwitchWrap.addEventListener('click', () => {
  mirrorMeshSwitchWrap.classList.toggle('on');

  const enabled = mirrorMeshSwitchWrap.classList.contains('on');
  mirrorMesh.visible = enabled;
  if (enabled) {
    localStorage.setItem('mirrorMesh', true);
  } else {
    localStorage.removeItem('mirrorMesh');
  }
});

const nameTagsSwitchWrap = topDocument.getElementById('name-tags-switch-wrap');
const _setNameTagsVisibility = visible => {
  if (rig && rig.nametagMesh) {
    rig.nametagMesh.visible = visible;
  }
  for (let i = 0; i < peerConnections.length; i++) {
    const peerConnection = peerConnections[i];
    if (peerConnection.rig && peerConnection.rig.nametagMesh) {
      peerConnection.rig.nametagMesh.visible = visible;
    }
  }
};
if (localStorage.getItem('nameTags') !== 'false') {
  nameTagsSwitchWrap.classList.add('on');
}
nameTagsSwitchWrap.addEventListener('click', () => {
  nameTagsSwitchWrap.classList.toggle('on');

  const enabled = nameTagsSwitchWrap.classList.contains('on');
  _setNameTagsVisibility(enabled);
  if (enabled) {
    localStorage.removeItem('nameTags');
  } else {
    localStorage.setItem('nameTags', false);
  }
});

let session = null;
const enterXrButton = topDocument.getElementById('enter-xr-button');
const _setSession = async newSession => {
  session = newSession;

  const _end = () => {
    session.removeEventListener('end', _end);
    session = null;

    clearInterval(loadReferenceSpaceInterval);
  };
  session.addEventListener('end', _end);

  let referenceSpace;
  let referenceSpaceType = '';
  const _loadReferenceSpace = async () => {
    const lastReferenceSpaceType = referenceSpaceType;
    try {
      referenceSpace = await session.requestReferenceSpace('local-floor');
      referenceSpaceType = 'local-floor';
    } catch (err) {
      referenceSpace = await session.requestReferenceSpace('local');
      referenceSpaceType = 'local';
    }

    if (referenceSpaceType !== lastReferenceSpaceType) {
      console.log(`referenceSpace changed to ${referenceSpaceType}`);
    }
  };
  await _loadReferenceSpace();
  const loadReferenceSpaceInterval = setInterval(_loadReferenceSpace, 1000);

  await new Promise((accept, reject) => {
    renderer.vr.setSession(session);

    let interations = 0;
    const _raf = (timestamp, frame) => {
      const pose = frame.getViewerPose(referenceSpace);
      if (pose) {
        const viewport = session.renderState.baseLayer.getViewport(pose.views[0]);
        // const width = viewport.width;
        const height = viewport.height;
        const fullWidth = (() => {
          let result = 0;
          for (let i = 0; i < pose.views.length; i++) {
            result += session.renderState.baseLayer.getViewport(pose.views[i]).width;
          }
          return result;
        })();
        renderer.vr.enabled = true;
        renderer.setAnimationLoop(null);
        renderer.vr.setAnimationLoop(animate);
        renderer.vr.setSession(null);
        renderer.setSize(fullWidth, height);
        renderer.setPixelRatio(1);
        renderer.vr.setSession(session);

        if (typeof FakeXRDisplay !== 'undefined') {
          fakeXrDisplay = new FakeXRDisplay();
          camera.projectionMatrix.toArray(fakeXrDisplay.projectionMatrix);
        }

        accept();
      } else {
        interations++;
        if (iterations > 100) {
          console.warn('did not receive pose after many frames');
        }
        session.requestAnimationFrame(_raf);
      }
    };
    session.requestAnimationFrame(_raf);
  });
  console.log('loaded XR');
};
enterXrButton.addEventListener('click', async () => {
  if (!session) {
    const newSession = await navigator.xr.requestSession('immersive-vr', {
      requiredFeatures: ['local-floor'],
    });
    await _setSession(newSession);
  }

  possessRig = true;
  if (rig) {
    rig.decapitate();
  }
});

let microphoneMediaStream = null;
const enableMicButton = topDocument.getElementById('enable-mic-button');
const disableMicButton = topDocument.getElementById('disable-mic-button');
enableMicButton.addEventListener('click', async () => {
  try {
    microphoneMediaStream  = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    rig.setMicrophoneMediaStream(microphoneMediaStream);
    if (channelConnection) {
      channelConnection.setMicrophoneMediaStream(microphoneMediaStream);
    }

    disableMicButton.style.display = null;
    enableMicButton.style.display = 'none';
  } catch (err) {
    console.warn(err);
  }
});
disableMicButton.addEventListener('click', async () => {
  rig.setMicrophoneMediaStream(null);
  if (channelConnection) {
    channelConnection.setMicrophoneMediaStream(null);
  }
  microphoneMediaStream.getAudioTracks().forEach(track => {
    track.stop();
  });

  microphoneMediaStream = null;
  enableMicButton.style.display = null;
  disableMicButton.style.display = 'none';

  /* try {
    await navigator.permissions.revoke({
      name: 'microphone',
    });
  } catch(err) {
    console.warn(err);
  } */
});

const siteUrlsContent = topDocument.getElementById('site-urls-content');
const siteUrlsSearch = topDocument.getElementById('site-urls-search');
const addSiteButton = topDocument.getElementById('add-site-button');
const siteUrlsContentEnd = siteUrlsContent.querySelector('.end');
const avatarModelsSearch = topDocument.getElementById('avatar-models-search');
const avatarModelsContent = topDocument.getElementById('avatar-models-content');
const avatarModelsContentEnd = avatarModelsContent.querySelector('.end');
const prefabsContent = topDocument.getElementById('prefabs-content');
const prefabsSearch = topDocument.getElementById('prefabs-search');
const prefabsContentEnd = prefabsContent.querySelector('.end');
const _escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
Promise.resolve().then(() => {
  siteUrlsSearch.addEventListener('input', e => {
    const regex = new RegExp(_escapeRegExp(e.target.value), 'i');
    siteUrlSearchResults = siteUrls.filter(({label, url}) => regex.test(label) || regex.test(url));
    lastSiteUrl = 0;

    const aSites = Array.from(siteUrlsContent.querySelectorAll('.a-site'));
    for (let i = 0; i < aSites.length; i++) {
      siteUrlsContent.removeChild(aSites[i]);
    }

    _updateSiteUrls();
  });
  addSiteButton.addEventListener('click', e => {
    const src = siteUrlsSearch.value;
    if (src) {
      const dom = parseHtml(codeInput.value);
      const xrSite = landConnection ? _findNodeWithTagNameAttributes(dom, 'xr-site', [{name: 'edit', value: 'true'}]) : _findNodeWithTagName(dom, 'xr-site');
      if (xrSite) {
        const position = localVector.copy(camera.position)
          .divide(container.scale)
          .add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
        position.y = 0;
        xrSite.childNodes.push(parseHtml(`<xr-iframe src="${encodeURI(src)}" position="${position.toArray().join(' ')}"></xr-iframe>`).childNodes[0]);
        codeInput.value = serializeHtml(dom);
        codeInput.dispatchEvent(new CustomEvent('change'));

        siteUrlsSearch.value = '';
      } else {
        console.warn('no xr-site to add to');
      }
    }
  });

  let siteUrlSearchResults = siteUrls;
  let lastSiteUrl = 0;
  const _updateSiteUrls = () => {
    const numSiteUrls = Math.ceil(siteUrlsContent.getBoundingClientRect().height/80);
    for (let i = 0; i < numSiteUrls && lastSiteUrl < siteUrlSearchResults.length; i++) {
      const siteUrl = siteUrlSearchResults[lastSiteUrl++];
      const {label, url, icon} = siteUrl;
      const src = url;

      const aSite = document.createElement('nav');
      aSite.classList.add('a-site');
      aSite.setAttribute('draggable', 'true');
      aSite.setAttribute('src', encodeURI(src));
      aSite.innerHTML = `<div class=overlay>
        <div class=multibutton>
          <nav class="button first last add-button">Add</nav>
        </div>
      </div>
      <img src="${icon}" width=80 height=80>
      <div class=wrap>
        <div class=label>${label}</div>
        <div class=url>${encodeURI(url)}</div>
      </div>`;

      aSite.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text', JSON.stringify({
          type: 'site',
          src: url,
        }));
      });
      const addButton = aSite.querySelector('.add-button');
      addButton.addEventListener('click', () => {
        const dom = parseHtml(codeInput.value);
        const xrSite = landConnection ? _findNodeWithTagNameAttributes(dom, 'xr-site', [{name: 'edit', value: 'true'}]) : _findNodeWithTagName(dom, 'xr-site');
        if (xrSite) {
          const position = localVector.copy(camera.position)
            .divide(container.scale)
            .add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
          position.y = 0;
          xrSite.childNodes.push(parseHtml(`<xr-iframe src="${encodeURI(src)}" position="${position.toArray().join(' ')}"></xr-iframe>`).childNodes[0]);
          codeInput.value = serializeHtml(dom);
          codeInput.dispatchEvent(new CustomEvent('change'));
        } else {
          console.warn('no xr-site to add to');
        }
      });

      siteUrlsContent.insertBefore(aSite, siteUrlsContentEnd);
    }
  };
  new IntersectionObserver(entries => {
    let needsUpdate = false;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.isIntersecting) {
        console.log('got entry');
        needsUpdate = true;
        break;
      }
    }
    if (needsUpdate) {
      _updateSiteUrls();
    }
  }, {
    root: siteUrlsContent,
    // threshold: 0.001,
  }).observe(siteUrlsContentEnd);

  let avatarModelSearchResults = avatarModels;
  let lastAvatarModel = 0;
  avatarModelsSearch.addEventListener('input', e => {
    const regex = new RegExp(_escapeRegExp(e.target.value), 'i');
    avatarModelSearchResults = avatarModels.filter(({label, url}) => regex.test(label) || regex.test(url));
    lastAvatarModel = 0;

    const aAvatars = Array.from(avatarModelsContent.querySelectorAll('.a-avatar'));
    for (let i = 0; i < aAvatars.length; i++) {
      avatarModelsContent.removeChild(aAvatars[i]);
    }

    _updateAvatarModels();
  });
  const _updateAvatarModels = () => {
    const numAvatarModels = Math.ceil(avatarModelsContent.getBoundingClientRect().height/80);
    for (let i = 0; i < numAvatarModels && lastAvatarModel < avatarModelSearchResults.length; i++) {
      const avatarModel = avatarModelSearchResults[lastAvatarModel++];
      const {label, url, icon} = avatarModel;
      const src = `https://avatar-models.exokit.org/${url}`;

      const aAvatar = document.createElement('nav');
      aAvatar.classList.add('a-avatar');
      aAvatar.setAttribute('draggable', 'true');
      aAvatar.setAttribute('src', encodeURI(src));
      aAvatar.innerHTML = `<div class=overlay>
        <div class=multibutton>
          <nav class="button first add-button">Add</nav>
          <nav class="button last wear-button">Wear</nav>
        </div>
      </div>
      <img src="${icon}" width=80 height=80>
      <div class=wrap>
        <div class=label>${label}</div>
      </div>`;

      aAvatar.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text', JSON.stringify({
          type: 'avatar',
          src,
        }));
      });

      const addButton = aAvatar.querySelector('.add-button');
      addButton.addEventListener('click', () => {
        const dom = parseHtml(codeInput.value);
        const xrSite = landConnection ? _findNodeWithTagNameAttributes(dom, 'xr-site', [{name: 'edit', value: 'true'}]) : _findNodeWithTagName(dom, 'xr-site');
        if (xrSite) {
          const position = camera.position.clone()
            .divide(container.scale)
            .add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
          xrSite.childNodes.push(parseHtml(`<xr-model src="${encodeURI(src)}" position="${position.toArray().join(' ')}"></xr-model>`).childNodes[0]);
          codeInput.value = serializeHtml(dom);
          codeInput.dispatchEvent(new CustomEvent('change'));
        } else {
          console.warn('no xr-site to add to');
        }
      });

      const wearButton = aAvatar.querySelector('.wear-button');
      wearButton.addEventListener('click', async () => {
        console.log('wear avatar', src);

        const model = await _loadModelUrl(src);
        _setLocalModel(model);
        modelUrl = src;

        _sendAllPeerConnections(JSON.stringify({
          method: 'model',
          url: modelUrl,
        }));
      });

      avatarModelsContent.insertBefore(aAvatar, avatarModelsContentEnd);
    }
  };
  new IntersectionObserver(entries => {
    let needsUpdate = false;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.isIntersecting) {
        needsUpdate = true;
        break;
      }
    }
    if (needsUpdate) {
      _updateAvatarModels();
    }
  }, {
    root: avatarModelsContent,
    // threshold: 0.001,
  }).observe(avatarModelsContentEnd);

  let prefabSearchResults = itemModels;
  let lastPrefab = 0;
  prefabsSearch.addEventListener('input', e => {
    const regex = new RegExp(_escapeRegExp(e.target.value), 'i');
    prefabSearchResults = itemModels.filter(itemModel => regex.test(itemModel));
    lastPrefab = 0;

    const aPrefabs = Array.from(prefabsContent.querySelectorAll('.a-prefab'));
    for (let i = 0; i < aPrefabs.length; i++) {
      prefabsContent.removeChild(aPrefabs[i]);
    }

    _updatePrefabs();
  });
  const _updatePrefabs = () => {
    const numPrefabs = Math.ceil(prefabsContent.getBoundingClientRect().height/80);
    for (let i = 0; i < numPrefabs && lastPrefab < prefabSearchResults.length; i++) {
      const itemModel = prefabSearchResults[lastPrefab++];
      const src = itemModel.replace(/^([^\/]+?\/[^\/]+?)\.fbx$/, 'https://item-models.exokit.org/glb/$1.glb');

      const aPrefab = document.createElement('nav');
      aPrefab.classList.add('a-prefab');
      aPrefab.setAttribute('draggable', 'true');
      aPrefab.setAttribute('src', encodeURI(src));
      aPrefab.innerHTML = `<div class=overlay>
        <div class=multibutton>
          <nav class="button first last add-button">Add</nav>
        </div>
      </div>
      <img src="${encodeURI(src.replace(/\.glb$/, '.png'))}" width=80 height=80>
      <div class=wrap>
        <div class=label>${itemModel}</div>
      </div>`;

      aPrefab.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text', JSON.stringify({
          type: 'avatar',
          src,
        }));
      });
      const addButton = aPrefab.querySelector('.add-button');
      addButton.addEventListener('click', () => {
        const dom = parseHtml(codeInput.value);
        const xrSite = landConnection ? _findNodeWithTagNameAttributes(dom, 'xr-site', [{name: 'edit', value: 'true'}]) : _findNodeWithTagName(dom, 'xr-site');
        if (xrSite) {
          const position = localVector.copy(camera.position)
            .divide(container.scale)
            .add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
          position.y = 0;
          xrSite.childNodes.push(parseHtml(`<xr-model src="${encodeURI(src)}" position="${position.toArray().join(' ')}"></xr-model>`).childNodes[0]);
          codeInput.value = serializeHtml(dom);
          codeInput.dispatchEvent(new CustomEvent('change'));
        } else {
          console.warn('no xr-site to add to');
        }
      });

      prefabsContent.insertBefore(aPrefab, prefabsContentEnd);
    }
  };
  new IntersectionObserver(entries => {
    let needsUpdate = false;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.isIntersecting) {
        needsUpdate = true;
        break;
      }
    }
    if (needsUpdate) {
      _updatePrefabs();
    }
  }, {
    root: prefabsContent,
    // threshold: 0.001,
  }).observe(prefabsContentEnd);
});

const channelsContent = topDocument.getElementById('channels-content');
const _getChannels = () => Array.from(channelsContent.querySelectorAll('.a-channel')).map(aChannel => aChannel.getAttribute('name'));
const _updateChannelsContent = () => {
  Array.from(channelsContent.querySelectorAll('.a-channel')).forEach(aChannel => {
    const name = aChannel.getAttribute('name');
    aChannel.addEventListener('mousedown', () => {
      channelInput.value = name;
      channelInput.dispatchEvent(new CustomEvent('input'));
      channelInput.dispatchEvent(new CustomEvent('change'));
    });
  });
};
_updateChannelsContent();

const channelInput = topDocument.getElementById('channel-input');
channelInput.addEventListener('input', () => {
  const inputText = channelInput.value;
  if (inputText) {
    connectButton.removeAttribute('disabled');
  } else {
    connectButton.setAttribute('disabled', '');
  }
  connectButton.innerText = _getChannels().includes(inputText) ? 'Connect' : 'Create';
});
channelInput.addEventListener('focus', () => {
  channelsContent.style.display = null;
});
channelInput.addEventListener('blur', () => {
  channelsContent.style.display = 'none';
});

let channelConnection = null;
const peerConnections = [];
const _sendAllPeerConnections = s => {
  for (let i = 0; i < peerConnections.length; i++) {
    peerConnections[i].send(s);
  }
};
const connectButton = topDocument.getElementById('connect-button');
connectButton.addEventListener('click', () => {
  const channelName = channelInput.value;

  if (channelName) {
    console.log(`connecting to ${channelName}`);

    channelConnection = new XRChannelConnection(`wss://presence.exokit.org/?c=${encodeURIComponent(channelName)}`);
    channelConnection.channelName = channelName;
    channelConnection.addEventListener('open', () => {
      console.log('xr channel open');
    });
    channelConnection.addEventListener('close', () => {
      console.log('xr channel close');

      _resetCodeInput();

      connectButton.style.display = null;
      disconnectButton.style.display = 'none';
      channelInput.disabled = false;
    });
    channelConnection.addEventListener('error', err => {
      console.warn('xr channel error', err);
    });
    channelConnection.addEventListener('peerconnection', e => {
      const peerConnection = e.detail;

      peerConnection.username = 'Anonymous';
      peerConnection.rig = null;
      peerConnection.mediaStream = null;
      let updateInterval = 0;
      peerConnection.addEventListener('open', () => {
        console.log('add peer connection', peerConnection);

        peerConnections.push(peerConnection);

        if (loginToken) {
          _sendAllPeerConnections(JSON.stringify({
            method: 'username',
            name: loginToken.name,
          }));
        }
        peerConnection.send(JSON.stringify({
          method: 'model',
          url: modelUrl,
        }));

        updateInterval = setInterval(() => {
          if (rig) {
            const hmd = {
              position: localVector.copy(rig.inputs.hmd.position).divideScalar(heightFactor).toArray(),
              quaternion: rig.inputs.hmd.quaternion.toArray(),
              scaleFactor: rig.inputs.hmd.scaleFactor,
            };
            const gamepads = [
              {
                position: localVector.copy(rig.inputs.leftGamepad.position).divideScalar(heightFactor).toArray(),
                quaternion: rig.inputs.leftGamepad.quaternion.toArray(),
                pointer: rig.inputs.leftGamepad.pointer,
                grip: rig.inputs.leftGamepad.grip,
                visible: true,
              },
              {
                position: localVector.copy(rig.inputs.rightGamepad.position).divideScalar(heightFactor).toArray(),
                quaternion: rig.inputs.rightGamepad.quaternion.toArray(),
                pointer: rig.inputs.rightGamepad.pointer,
                grip: rig.inputs.rightGamepad.grip,
                visible: true,
              },
            ];
            peerConnection.update(hmd, gamepads);
          }
        }, peerPoseUpdateRate);
      }, {once: true});
      peerConnection.addEventListener('close', () => {
        console.log('remove peer connection', peerConnection);

        const index = peerConnections.indexOf(peerConnection);
        if (index !== -1) {
          peerConnections.splice(index, 1);
        }

        clearInterval(updateInterval);

        if (peerConnection.rig) {
          peerConnection.rig.destroy();
        }
      }, {once: true});
      peerConnection.addEventListener('pose', e => {
        const {rig} = peerConnection;
        if (rig) {
          const {detail: data} = e;
          const {hmd, gamepads} = data;

          rig.starts.hmd.position.copy(peerConnection.rig.inputs.hmd.position);
          rig.starts.hmd.rotation.copy(peerConnection.rig.inputs.hmd.quaternion);
          rig.starts.hmd.scaleFactor = peerConnection.rig.inputs.hmd.scaleFactor;
          rig.starts.gamepads[0].position.copy(peerConnection.rig.inputs.leftGamepad.position);
          rig.starts.gamepads[0].rotation.copy(peerConnection.rig.inputs.leftGamepad.quaternion);
          rig.starts.gamepads[0].pointer = peerConnection.rig.inputs.leftGamepad.pointer;
          rig.starts.gamepads[0].grip = peerConnection.rig.inputs.leftGamepad.grip;
          rig.starts.gamepads[1].position.copy(peerConnection.rig.inputs.rightGamepad.position);
          rig.starts.gamepads[1].rotation.copy(peerConnection.rig.inputs.rightGamepad.quaternion);
          rig.starts.gamepads[1].pointer = peerConnection.rig.inputs.rightGamepad.pointer;
          rig.starts.gamepads[1].grip = peerConnection.rig.inputs.rightGamepad.grip;

          rig.targets.hmd.position.fromArray(hmd.position);
          rig.targets.hmd.rotation.fromArray(hmd.quaternion);
          rig.targets.hmd.scaleFactor = hmd.scaleFactor;
          rig.targets.gamepads[0].position.fromArray(gamepads[0].position);
          rig.targets.gamepads[0].rotation.fromArray(gamepads[0].quaternion);
          rig.targets.gamepads[0].pointer = gamepads[0].pointer;
          rig.targets.gamepads[0].grip = gamepads[0].grip;
          rig.targets.gamepads[1].position.fromArray(gamepads[1].position);
          rig.targets.gamepads[1].rotation.fromArray(gamepads[1].quaternion);
          rig.targets.gamepads[1].pointer = gamepads[1].pointer;
          rig.targets.gamepads[1].grip = gamepads[1].grip;
          rig.targets.timestamp = Date.now();
        }
      });
      peerConnection.addEventListener('mediastream', e => {
        console.log('got media stream', e.detail, e.detail.getAudioTracks());
        peerConnection.mediaStream = e.detail;
        if (peerConnection.rig) {
          peerConnection.rig.setMicrophoneMediaStream(peerConnection.mediaStream, {
            muted: false,
          });
        }
      });
      peerConnection.addEventListener('message', async e => {
        console.log('got message', e);
        const data = JSON.parse(e.data);
        const {method} = data;
        if (method === 'username') {
          const {name} = data;
          peerConnection.username = name;

          if (peerConnection.rig && peerConnection.rig.nametagMesh) {
            peerConnection.rig.nametagMesh.setName(name);
          }
        } else if (method === 'model') {
          const {url} = data;
          console.log('got peer model', {url});

          if (peerConnection.rig) {
            container.remove(peerConnection.rig.model);
            peerConnection.rig.destroy();
          }

          const model = url ? await _loadModelUrl(url) : null;
          peerConnection.rig = _makeAvatar(model, {
            fingers: true,
            hair: true,
            visemes: true,
            microphoneMediaStream: peerConnection.mediaStream,
            muted: false,
            // debug: !model,
          }, peerConnection.username);

          peerConnection.rig.starts = {
            hmd: {
              position: peerConnection.rig.inputs.hmd.position.clone(),
              rotation: peerConnection.rig.inputs.hmd.quaternion.clone(),
              scaleFactor: peerConnection.rig.inputs.hmd.scaleFactor,
            },
            gamepads: [
              {
                position: peerConnection.rig.inputs.leftGamepad.position.clone(),
                rotation:  peerConnection.rig.inputs.leftGamepad.quaternion.clone(),
                pointer: peerConnection.rig.inputs.leftGamepad.pointer,
                grip: peerConnection.rig.inputs.leftGamepad.grip,
              },
              {
                position: peerConnection.rig.inputs.rightGamepad.position.clone(),
                rotation: peerConnection.rig.inputs.rightGamepad.quaternion.clone(),
                pointer: peerConnection.rig.inputs.rightGamepad.pointer,
                grip: peerConnection.rig.inputs.rightGamepad.grip,
              },
            ],
          };
          peerConnection.rig.targets = {
            hmd: {
              position: new THREE.Vector3(),
              rotation: new THREE.Quaternion(),
              scaleFactor: 1,
            },
            gamepads: [
              {
                position: new THREE.Vector3(),
                rotation: new THREE.Quaternion(),
                pointer: 0,
                grip: 0,
              },
              {
                position: new THREE.Vector3(),
                rotation: new THREE.Quaternion(),
                pointer: 0,
                grip: 0,
              },
            ],
            timestamp: Date.now(),
          };
          const heightFactor = _getHeightFactor(peerConnection.rig.height);
          peerConnection.rig.update = (_update => function update() {
            const now = Date.now();
            const {timestamp} = peerConnection.rig.targets;
            const lerpFactor = Math.min(Math.max((now - timestamp) / (peerPoseUpdateRate*2), 0), 1);

            peerConnection.rig.inputs.hmd.quaternion.copy(peerConnection.rig.starts.hmd.rotation).slerp(peerConnection.rig.targets.hmd.rotation, lerpFactor);
            peerConnection.rig.inputs.hmd.position.copy(peerConnection.rig.starts.hmd.position).lerp(
              localVector.copy(peerConnection.rig.targets.hmd.position).multiplyScalar(heightFactor),
              lerpFactor
            );
            peerConnection.rig.inputs.hmd.scaleFactor = peerConnection.rig.starts.hmd.scaleFactor * (1-lerpFactor) + peerConnection.rig.targets.hmd.scaleFactor * lerpFactor;

            peerConnection.rig.inputs.leftGamepad.position.copy(peerConnection.rig.starts.gamepads[0].position).lerp(
              localVector.copy(peerConnection.rig.targets.gamepads[0].position).multiplyScalar(heightFactor),
              lerpFactor
            );
            peerConnection.rig.inputs.leftGamepad.quaternion.copy(peerConnection.rig.starts.gamepads[0].rotation).slerp(peerConnection.rig.targets.gamepads[0].rotation, lerpFactor);
            peerConnection.rig.inputs.leftGamepad.pointer = peerConnection.rig.starts.gamepads[0].pointer * (1-lerpFactor) + peerConnection.rig.targets.gamepads[0].pointer * lerpFactor;
            peerConnection.rig.inputs.leftGamepad.grip = peerConnection.rig.starts.gamepads[0].grip * (1-lerpFactor) + peerConnection.rig.targets.gamepads[0].grip * lerpFactor;

            peerConnection.rig.inputs.rightGamepad.position.copy(peerConnection.rig.starts.gamepads[1].position).lerp(
              localVector.copy(peerConnection.rig.targets.gamepads[1].position).multiplyScalar(heightFactor),
              lerpFactor
            );
            peerConnection.rig.inputs.rightGamepad.quaternion.copy(peerConnection.rig.starts.gamepads[1].rotation).slerp(peerConnection.rig.targets.gamepads[1].rotation, lerpFactor);
            peerConnection.rig.inputs.rightGamepad.pointer = peerConnection.rig.starts.gamepads[1].pointer * (1-lerpFactor) + peerConnection.rig.targets.gamepads[1].pointer * lerpFactor;
            peerConnection.rig.inputs.rightGamepad.grip = peerConnection.rig.starts.gamepads[1].grip * (1-lerpFactor) + peerConnection.rig.targets.gamepads[1].grip * lerpFactor;

            _update.apply(this, arguments);
          })(peerConnection.rig.update);
        } else {
          console.warn('invalid method', {method});
        }
      });
    });
    channelConnection.addEventListener('message', e => {
      const data = JSON.parse(e.data);
      const {method} = data;
      switch (method) {
        case 'init':
        case 'ops': {
          htmlClient.write(data);
          break;
        }
        default: {
          console.warn(`ws got invalid method: ${method}`);
          break;
        }
      }
    });

    connectButton.style.display = 'none';
    disconnectButton.style.display = null;
    channelInput.disabled = true;

    const uploadFileLabel = topDocument.getElementById('upload-file-label');
    uploadFileLabel.style.display = null;

    if (!_getChannels().includes(channelName)) {
      channelsContent.innerHTML = `<div class=a-channel name="${encodeURIComponent(channelName)}">
        <i class="fas fa-user-headset"></i>
        <div class=label>${channelName}</div>
      </div>` + channelsContent.innerHTML;
      _updateChannelsContent();
    }
  }
});
const disconnectButton = topDocument.getElementById('disconnect-button');
disconnectButton.addEventListener('click', () => {
  channelConnection.disconnect();
  channelConnection = null;
});

const codeInput = topDocument.getElementById('code');
codeInput.addEventListener('change', () => {
  const newText = codeInput.value;
  const normalizedNewText = htmlClient.pushUpdate(newText);
  if (normalizedNewText !== newText) {
    codeInput.value = normalizedNewText;
  }
});
const htmlClient = new HTMLClient(codeInput.value);
htmlClient.addEventListener('localUpdate', e => {
  const newValue = e.detail;
  if (newValue !== codeInput.value) {
    codeInput.value = newValue;
    codeInput.dispatchEvent(new CustomEvent('input'));
  }
});
htmlClient.addEventListener('message', e => {
  if (channelConnection) {
    const {ops, baseIndex} = e.detail;
    channelConnection.send(JSON.stringify({
      method: 'ops',
      ops,
      baseIndex,
    }));
  }
});
const _resetCodeInput = () => {
  codeInput.value = `<xr-site>disconnected</xr-site>`;
  codeInput.dispatchEvent(new CustomEvent('change'));
};
_resetCodeInput();

const _findNodeWithTagName = (node, tagName) => {
  const _recurse = node => {
    if (node.tagName === tagName) {
      return node;
    } else {
      if (node.childNodes) {
        for (let i = 0; i < node.childNodes.length; i++) {
          const result = _recurse(node.childNodes[i]);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    }
  };
  return _recurse(node);
};
const _findNodeWithTagNameAttributes = (node, tagName, attributes) => {
  const _recurse = node => {
    if (node.tagName === tagName && attributes.every(({name, value}) => node.attrs[name] === value)) {
      return node;
    } else {
      if (node.childNodes) {
        for (let i = 0; i < node.childNodes.length; i++) {
          const result = _recurse(node.childNodes[i]);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    }
  };
  return _recurse(node);
};
const _uploadFile = file => {
  if (channelConnection) {
    fetch(`https://presence.exokit.org/channels/${channelConnection.channelName}/${file.name}`, {
      method: 'PUT',
      body: file,
    })
      .then(res => {
        if (res.ok) {
          return res.json();
        } else {
          console.warn(`invalid status code: ${res.status}`);
          return Promise.resolve([]);
        }
      })
      .then(j => {
        console.log('upload complete', j);
        const {url} = j;

        const dom = parseHtml(codeInput.value);
        const xrSite = _findNodeWithTagName(dom, 'xr-site');
        if (xrSite) {
          xrSite.childNodes.push(parseHtml(`<xr-model src="${encodeURI(url)}"></xr-model>`).childNodes[0]);
          codeInput.value = serializeHtml(dom);
          codeInput.dispatchEvent(new CustomEvent('change'));
        } else {
          console.warn('no xr-site to add to');
        }
      })
      .catch(err => {
        console.warn(err);
      });
  } else {
    console.warn('not uploading file while disconnected', file);
  }
};
const _bindUploadFileButton = (inputFileEl, handleUpload) => {
  inputFileEl.addEventListener('change', async e => {
    const {files} = e.target;
    if (files.length === 1) {
      const [file] = files;
      handleUpload(file);
    }

    const {parentNode} = inputFileEl;
    parentNode.removeChild(inputFileEl);
    const newInputFileEl = topDocument.createElement('input');
    newInputFileEl.type = 'file';
    // newInputFileEl.id = 'upload-file-button';
    newInputFileEl.style.display = 'none';
    parentNode.appendChild(newInputFileEl);
    _bindUploadFileButton(newInputFileEl);
  });
};
_bindUploadFileButton(topDocument.getElementById('upload-file-button'), _uploadFile);
_bindUploadFileButton(topDocument.getElementById('deploy-parcel-upload-file-button'), async file => {
  const xrSite = toolManager.getSelectedElement();
  const extents = THREE.Land.parseExtents(xrSite.getAttribute('extents'));
  const coords = [];
  for (let i = 0; i < extents.length; i++) {
    const [x1, y1, x2, y2] = extents[i];
    for (let y = y1; y < y2; y += parcelSize) {
      for (let x = x1; x < x2; x += parcelSize) {
        coords.push([
          (x + parcelSize/2)/parcelSize,
          (y + parcelSize/2)/parcelSize,
        ]);
      }
    }
  }
  const coord = coords[0];

  const html = await new Promise((accept, reject) => {
    const r = new FileReader();
    r.onload = e => {
      const html = e.target.result;
      console.log('deploy', html); // XXX
    };
    r.readAsText(file);
  });

  const res = await fetch(`https://grid.exokit.org/parcels/${coord[0]}/${coord[1]}`, {
    method: 'POST',
    body: JSON.stringify({
      coords,
      html,
    }),
  });
  const j = await res.json();

  let newXrSite = _htmlToDomNode(html);
  if (!newXrSite) {
    newXrSite = document.createElement('xr-site');
  }
  newXrSite.setAttribute('extents', xrSite.getAttribute('extents'));
  xrSite.replaceWith(newXrSite);

  console.log('deployed', j, JSON.stringify(html));
});
window.document.addEventListener('drop', async e => {
  e.preventDefault();

  for (var i = 0; i < e.dataTransfer.items.length; i++) {
    const item = e.dataTransfer.items[i];
    if (item.kind === 'file') {
      _uploadFile(item.getAsFile());
    } else if (item.kind === 'string') {
      const data = await new Promise((accept, reject) => {
        item.getAsString(accept);
      });
      const j = (() => {
        try {
          return JSON.parse(data);
        } catch(err) {
          return null;
        }
      })();
      if (j !== null) {
        const _loadElement = (tagName, src) => {
          const dom = parseHtml(codeInput.value);
          const xrSite = _findNodeWithTagName(dom, 'xr-site');
          if (xrSite && !landConnection) {
            const position = new THREE.Vector3();
            const rect = renderer.domElement.getBoundingClientRect();
            const xFactor = (e.clientX - rect.left) / rect.width;
            const yFactor = -(e.clientY - rect.top) / rect.height;
            if (xFactor >= 0 && xFactor <= 1 && -yFactor >= 0 && -yFactor <= 1) {
              const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
                camera.position.clone()
                  .add(new THREE.Vector3(0, 0, -3).applyQuaternion(camera.quaternion))
              );
              localRaycaster.setFromCamera(localVector2D.set(xFactor * 2 - 1, yFactor * 2 + 1), camera);
              const intersection = localRaycaster.ray.intersectPlane(plane, new THREE.Vector3());
              if (intersection) {
                intersection.divide(container.scale);
                position.copy(intersection);
              } else {
                position.copy(camera.position)
                  .divide(container.scale)
                  .add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
              }

              /* if (editedEl) {
                toolManager.clampPositionToElementExtent(position, editedEl);
              } */

              xrSite.childNodes.push(parseHtml(`<${tagName} src="${encodeURI(src)}" position="${position.toArray().join(' ')}"></${tagName}>`).childNodes[0]);
              codeInput.value = serializeHtml(dom);
              codeInput.dispatchEvent(new CustomEvent('change'));
            }
          } else {
            console.warn('no xr-site to add to');
          }
        };

        const {type, src} = j;
        if (type === 'site') {
          _loadElement('xr-iframe', src);
        } else if (type === 'avatar') {
          _loadElement('xr-model', src);
        }
      }
    }
  }
});

const inventoryContent = topDocument.getElementById('inventory-content');
const deployParcelScenes = topDocument.getElementById('deploy-parcel-scenes');
const deployParcelRooms = topDocument.getElementById('deploy-parcel-rooms');
const _loadInventory = async () => {
  const ress = await Promise.all([
    fetch(`https://upload.exokit.org/${loginToken.name}`),
    fetch(`https://presence.exokit.org/channels`),
  ])
  if (ress.every(res => res.ok)) {
    const [files, channels] = await Promise.all(ress.map(res => res.json()));
    inventoryContent.innerHTML = files.map(filename => {
      return `<nav class=a-file draggable=true src="${encodeURI(filename)}">
        <div class=overlay>
          <div class=multibutton>
            <nav class="button first last load-button">Load</nav>
          </div>
        </div>
        <i class="fas fa-file"></i>
        <div class=name>${escape(filename)}</name>
      </nav>`;
    }).join('\n');
    Array.from(inventoryContent.querySelectorAll('.a-file')).forEach(aFile => {
      const src = aFile.getAttribute('src');
      const loadButton = aFile.querySelector('.load-button');
      loadButton.addEventListener('click', async () => {
        const res = await fetch(`https://content.exokit.org/${src}`);
        const html = await res.text();
        codeInput.value = html;
        codeInput.dispatchEvent(new CustomEvent('change'));
      });
    });

    const _deployUrl = async u => {
      const xrSite = toolManager.getSelectedElement();
      const extents = THREE.Land.parseExtents(xrSite.getAttribute('extents'));
      const coords = [];
      for (let i = 0; i < extents.length; i++) {
        const [x1, y1, x2, y2] = extents[i];
        for (let y = y1; y < y2; y += parcelSize) {
          for (let x = x1; x < x2; x += parcelSize) {
            coords.push([
              (x + parcelSize/2)/parcelSize,
              (y + parcelSize/2)/parcelSize,
            ]);
          }
        }
      }
      const coord = coords[0];

      const res = await fetch(u);
      const html = await res.text();

      const res2 = await fetch(`https://grid.exokit.org/parcels/${coord[0]}/${coord[1]}`, {
        method: 'POST',
        body: JSON.stringify({
          coords,
          html,
        }),
      });
      const j = await res2.json();

      console.log('loading', html);
      let newXrSite = _htmlToDomNode(html);
      if (!newXrSite) {
        newXrSite = document.createElement('xr-site');
      }
      newXrSite.setAttribute('extents', xrSite.getAttribute('extents'));
      xrSite.replaceWith(newXrSite);

      console.log('deployed', j, JSON.stringify(html));
    };
    deployParcelScenes.innerHTML = files.map(filename => {
      return `<nav class=suboption src="${encodeURI(filename)}">${filename}</nav>`;
    }).join('\n');
    Array.from(deployParcelScenes.querySelectorAll('.suboption')).forEach(aSuboption => {
      const src = aSuboption.getAttribute('src');
      aSuboption.addEventListener('click', () => {
        _deployUrl(`https://content.exokit.org/${src}`);
      });
    });

    deployParcelRooms.innerHTML = channels.map(channelName => {
      return `<nav class=suboption src="${encodeURI(channelName)}">${channelName}</nav>`;
    }).join('\n');
    Array.from(deployParcelRooms.querySelectorAll('.suboption')).forEach(aSuboption => {
      const src = aSuboption.getAttribute('src');
      aSuboption.addEventListener('click', () => {
        _deployUrl(`https://presence.exokit.org/channels/${src}`);
      });
    });
  } else {
    throw new Error(`invalid status code: ${res.status}`);
  }
};

let loginToken = null;
const loginUrl = 'https://login.exokit.org/';
const _setLoginToken = newLoginToken => {
  loginToken = newLoginToken;

  const {name} = loginToken;
  if (rig && rig.nametagMesh) {
    rig.nametagMesh.setName(name);
  }
  _sendAllPeerConnections(JSON.stringify({
    method: 'username',
    name: loginToken.name,
  }));
};
async function doLogin(email, code) {
  const res = await fetch(`${loginUrl}?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`, {
    method: 'POST',
  });
  if (res.ok) {
    const newLoginToken = await res.json();

    await storage.set('loginToken', newLoginToken);

    _setLoginToken(newLoginToken);

    // loginNameStatic.innerText = loginToken.name;
    // loginEmailStatic.innerText = loginToken.email;

    topDocument.body.classList.add('logged-in');
    loginForm.classList.remove('phase-1');
    loginForm.classList.remove('phase-2');
    loginForm.classList.add('phase-3');

    await _loadInventory();

    return true;
  } else {
    return false;
  }
}
const storage = {
  async get(k) {
    const s = localStorage.getItem(k);
    if (typeof s === 'string') {
      return JSON.parse(s);
    } else {
      return undefined;
    }
  },
  async set(k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  },
  async remove(k) {
    localStorage.removeItem(k);
  },
};

const loginForm = topDocument.getElementById('login-form');
const loginEmail = topDocument.getElementById('login-email');
const loginNameStatic = topDocument.getElementById('login-name-static');
const loginEmailStatic = topDocument.getElementById('login-email-static');
const statusNotConnected = topDocument.getElementById('status-not-connected');
const statusConnected = topDocument.getElementById('status-connected');
const loginVerificationCode = topDocument.getElementById('login-verification-code');
const loginNotice = topDocument.getElementById('login-notice');
const loginError = topDocument.getElementById('login-error');
const logoutButton = topDocument.getElementById('logout-button');
loginForm.onsubmit = async e => {
  e.preventDefault();

  if (loginForm.classList.contains('phase-1') && loginEmail.value) {
    loginNotice.innerHTML = '';
    loginError.innerHTML = '';
    loginForm.classList.remove('phase-1');

    const res = await fetch(`${loginUrl}?email=${encodeURIComponent(loginEmail.value)}`, {
      method: 'POST',
    })
    if (res.ok) {
      loginNotice.innerText = `Code sent to ${loginEmail.value}!`;
      loginForm.classList.add('phase-2');

      return res.blob();
    } else if (res.status === 403) {
      loginError.innerText = `${loginEmail.value} is not in the beta yet :(`;

      loginForm.classList.add('phase-1');
    } else {
      throw new Error(`invalid status code: ${res.status}`);
    }
  } else if (loginForm.classList.contains('phase-2') && loginEmail.value && loginVerificationCode.value) {
    loginNotice.innerHTML = '';
    loginError.innerHTML = '';
    loginForm.classList.remove('phase-2');

    await doLogin(loginEmail.value, loginVerificationCode.value);
  } else if (loginForm.classList.contains('phase-3')) {
    await storage.remove('loginToken');

    window.top.location.reload();
  }
};
(async () => {
  const localLoginToken = await storage.get('loginToken');
  if (localLoginToken) {
    const res = await fetch(`${loginUrl}?email=${encodeURIComponent(localLoginToken.email)}&token=${encodeURIComponent(localLoginToken.token)}`, {
      method: 'POST',
    })
    if (res.ok) {
      const newLoginToken = await res.json();

      await storage.set('loginToken', newLoginToken);

      _setLoginToken(newLoginToken);

      // loginNameStatic.innerText = loginToken.name;
      // loginEmailStatic.innerText = loginToken.email;

      topDocument.body.classList.add('logged-in');
      loginForm.classList.remove('phase-1');
      loginForm.classList.remove('phase-2');
      loginForm.classList.add('phase-3');

      await _loadInventory();
    } else {
      await storage.remove('loginToken');

      console.warn(`invalid status code: ${res.status}`);
    }
  }
})();

(async () => {
  const {url} = avatarModels[0];
  const src = `https://avatar-models.exokit.org/${url}`;
  const model = await _loadModelUrl(src);
  _setLocalModel(model);
  modelUrl = src;
})();

window.addEventListener('resize', e => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (fakeXrDisplay) {
    camera.projectionMatrix.toArray(fakeXrDisplay.projectionMatrix);
  }
});

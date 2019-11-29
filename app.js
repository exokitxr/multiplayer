import './three.js';
import './BufferGeometryUtils.js';
import './OrbitControls.js';
import './TransformControls.js';
import './Reflector.js';
import './land.js';
import './bmfont.js';

import {XRChannelConnection} from 'https://multiplayer.exokit.org/multiplayer.js';
import {HTMLServer} from 'https://sync.exokit.org/sync-server.js';
import HTMLClient from 'https://sync.exokit.org/sync-client.js';
import {parseHtml, serializeHtml} from 'https://sync.exokit.org/html-utils.js';
import Avatar from 'https://avatars.exokit.org/avatars.js';
import MicrophoneWorker from 'https://avatars.exokit.org/microphone-worker.js';
import ModelLoader from 'https://model-loader.exokit.org/model-loader.js';
import {parcelSize, colors} from './constants.js';
import {ToolManager} from './tools.js';
import itemModels from 'https://item-models.exokit.org/item-models.js';
import screenshot from 'https://screenshots.exokit.org/screenshot.js';

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
const localQuaternion = new THREE.Quaternion();
const localQuaternion2 = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localEuler = new THREE.Euler();
const localRay = new THREE.Ray();
const localRaycaster = new THREE.Raycaster();
const localColor = new THREE.Color();

const z180Quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

const scene = new THREE.Scene();

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

const gridHelper = new THREE.GridHelper(10, 10);
container.add(gridHelper);

/* const _makeTextMesh = (s = '', color = 0x000000, size = 1) => {
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

  const scaleFactor = 0.002 * size;

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(0, -geometry.layout.lineHeight * 0.001, 0);
  mesh.scale.set(scaleFactor, -scaleFactor, -scaleFactor);
  mesh.getText = () => s;
  mesh.setText = newS => {
    if (newS !== s) {
      s = newS;
      geometry.update(s);
    }
  };
  return mesh;
}; */

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
  };
  mesh.onAfterRender2 = () => {
    if (rig && possessRig) {
      rig.decapitate();
    }
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

const renderer = new THREE.WebGLRenderer({
  // alpha: true,
  antialias: true,
});
// console.log('set size', window.innerWidth, window.innerHeight);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.sortObjects = false;
renderer.context.canvas.addEventListener('webglcontextlost', e => {
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

(async () => {
  // return;

  const itemModelsHash = '5909a65454c065fcba320fd6cd6c21c904989b7a';

  const screenshotImage = document.createElement('img');
  screenshotImage.style.position = 'absolute';
  screenshotImage.style.bottom = '0px';
  screenshotImage.style.right = '0px';
  topDocument.body.appendChild(screenshotImage);

  // const cameraPosition = new THREE.Vector3(0, 1, 0);

  const ambientLight = new THREE.AmbientLight(0x808080);
  const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 3);
  directionalLight.position.set(0.5, 1, 0.5);
  // const directionalLight2 = new THREE.DirectionalLight(0xFFFFFF, 4);
  // directionalLight2.position.set(-0.5, 1, -0.5);
  const lights = [
    ambientLight,
    directionalLight,
  ];

  const alphaMap = await new Promise((accept, reject) => {
    const img = new Image();
    img.onload = () => {
      const t = new THREE.Texture(
        img// ,
        // THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter, THREE.UnsignedByteType, THREE.UnsignedByteType
      );
      t.needsUpdate = true;
      accept(t);
    };
    img.onerror = reject;
    img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  });

  const manager = new THREE.LoadingManager();
  manager.setURLModifier(u => {
    console.log('resource', u);
    let match;
    if (match = u.match(/^(.+?)\/([^\/]+?\.png)$/)) {
      if (match[2] === 'PolygonApocalypse_Texture_01.png') {
        match[2] = 'PolygonApocalypse_Texture_01_A.png';
      } else if (match[2] === 'Billboard.png') {
        match[2] = 'Misc/Billboard.png';
      } else if (match[2] === 'PolygonApocalypse_Vehicle_Texture_01.png') {
        match[2] = 'Veh/PolygonApocalypse_Vehicle_Texture_01.png';
      } else if (match[2] === 'Overgrowth.png') {
        match[2] = 'Misc/Overgrowth.png';
      } else if (match[2] === 'PolygonApocalyse_Road_01.png') {
        match[2] = 'Misc/PolygonApocalyse_Road_01.png';
      } else if (match[2] === 'PolygonMilitary_Texture_01_A.png') {
        if (/battleroyale/i.test(manager.itemModel)) {
          match[2] = 'PolygonBattleRoyale_Texture_01_A.png';
        }
      } else if (match[2] === 'PolygonMilitary_Texture_01_B.png') {
        if (/battleroyale/i.test(manager.itemModel)) {
          match[2] = 'PolygonBattleRoyale_Texture_01_A.png';
        }
      } else if (match[2] === 'PolygonMilitary_Texture_01_C.png') {
        if (/battleroyale/i.test(manager.itemModel)) {
          match[2] = 'PolygonBattleRoyale_Texture_01_A.png';
        }
      } else if (match[2] === 'PolygonMilitary_Texture_01_D.png') {
        if (/battleroyale/i.test(manager.itemModel)) {
          match[2] = 'PolygonBattleRoyale_Texture_01_A.png';
        }
      } else if (match[2] === 'Fence_Alpha.png') {
        match[2] = 'PolygonBattleRoyale_Fence_Alpha.png';
      } else if (match[2] === 'Land_Vehicle_Master_Destroyed_01.png' || match[2] === 'Air_Vehicle_Damaged_01.png') {
        match[2] = 'PolygonBattleRoyale_Vehicles_01_Damaged.png';
      } else if (match[2] === 'Weapon_Skin_01.png') {
        match[2] = 'Weapons/Wep_Skin_01.png';
      } else if (match[2] === 'Dungeons_Texture_01.png') {
        if (/battleroyale/i.test(manager.itemModel)) {
          match[2] = 'PolygonBattleRoyale_Texture_01_A.png';
        }
      } else if (match[2] === 'PolygonNature.png') {
        if (/bush/i.test(manager.itemModel)) {
          match[2] = 'Leaves/FlowerBush_Texture.png';
        } else if (/fern/i.test(manager.itemModel)) {
          match[2] = 'Leaves/Fern_Texture.png';
        } else {
          match[2] = 'PolygonNature_01.png';
        }
      } else if (match[2] === 'FlowerPatch_02.png') {
        match[2] = 'Misc/FlowerPatch_02.png';
      } else if (match[2] === 'FernLeaf.png') {
        match[2] = 'Leaves/Fern_Texture.png';
      } else if (match[2] === 'PolygonSciFiCity_Texture_01_A.png') {
        match[2] = 'PolygonScifi_01_A.png';
      } else if (match[2] === 'PolygonTown_Texture_01_A_House.png') {
        match[2] = 'PolygonTown_Texture_01_A.png';
      } else if (match[2] === 'InteriorWallBake_baseTexBaked.png') {
        match[2] = 'PolygonTown_Texture_01_A.png';
      } else if (match[2] === 'PolygonTown_Road_01.png') {
        if (/battleroyale/i.test(match[1])) {
          match[2] = 'PolygonBattleRoyale_Road_01.png';
        } else {
          match[2] = 'PolygonTown_Road_01.png';
        }
      } else if (match[2] === 'PolygonCity_Road_01.png') {
        if (/town/i.test(match[1])) {
          match[2] = 'PolygonTown_Road_01.png';
        } else {
          match[2] = 'PolygonSciFi_Road_01.png';
        }
      } else if (match[2] === 'PolygonCity_Texture_01_A.png') {
        match[2] = 'PolygonScifi_01_A.png';
      } else if (match[2] === 'churchbase3.png') {
        match[2] = 'PolygonTown_Texture_01_A.png';
      } else if (match[2] === 'PolygonTown_Texture_03_A_House.png') {
        match[2] = 'PolygonTown_Texture_01_A.png';
      }
      // console.log('new u', `${match[1]}/Textures/${match[2]}`);
      return `${match[1]}/Textures/${match[2]}`;
    } else if (match = u.match(/^(.+?)\/([^\/]+?\.tga)$/)) {
      if (match[2] === 'Wire_Alpha.tga') {
        match[2] = 'Misc/Wire_Alpha.png';
      }
      return `${match[1]}/Textures/${match[2]}`;
    } else if (match = u.match(/^(.+?)\/([^\/]+?\.tif)$/)) {
      if (match[2] === 'Weapon_Skins_Master_07.tif') {
        match[2] = 'Weapons/Wep_Skin_07.png';
      }
      return `${match[1]}/Textures/${match[2]}`;
    } else if (match = u.match(/^(.+?)\/([^\/]+?\.psd)$/)) {
      if (match[2] === 'PolygonApocalypse_Texture_01_Cleaned.psd' || match[2] === 'PolygonApocalypse_Texture_01_Cleaned_jason.psd') {
        match[2] = 'PolygonApocalypse_Texture_01_A.png';
      } else if (match[2] === 'PolygonFarm_Texture_01_A_2k.psd') {
        match[2] = 'PolygonApocalypse_Texture_01_A.png';
      } else if (match[2] === 'Andrew_Rubble_01.psd') {
        match[2] = 'Misc/PolygonApocalypse_Rubble_01.png';
      } else if (match[2] === 'PolygonCity_Texture.psd') {
        match[2] = 'PolygonBattleRoyale_Road_01.png';
      } else if (match[2] === 'PolygonMilitary_Texture_01_A.psd') {
        if (/apocalypse/i.test(manager.itemModel)) {
          match[2] = 'PolygonApocalypse_Texture_01_A.png';
        } else if (/battleroyale/i.test(manager.itemModel) && /road/i.test(manager.itemModel)) {
          match[2] = 'PolygonBattleRoyale_Road_01.png';
        } else {
          match[2] = 'PolygonBattleRoyale_Texture_01_A.png';
        }
      } else if (match[2] === 'PolygonWar_Texture_GoodVersion.psd') {
        match[2] = 'PolygonBattleRoyale_Texture_01_A.png';
      } else if (match[2] === 'Land_Vehicle_Master_01.psd' || match[2] === 'Air_Vehicle_Master_01.psd') {
        match[2] = 'PolygonBattleRoyale_Vehicles_01.png';
      } else if (match[2] === 'Land_Vehicle_Master_Destroyed_01.psd') {
        match[2] = 'PolygonBattleRoyale_Vehicles_01_Damaged.png';
      } else if (match[2] === 'track2.psd') {
        match[2] = 'PolygonBattleRoyale_Tank_Tracks.png';
      } else if (match[2] === 'Weapon_Skins_Master_01.psd') {
        match[2] = 'Weapons/Wep_Skin_01.png';
      } else if (match[2] === 'PolygonScifi_Texture.psd' || match[2] === 'PolygonScifi_.psd') {
        if (/icon/i.test(manager.itemModel) || /neon/i.test(manager.itemModel)) {
          match[2] = 'NeonSigns.png';
        /* } else if (/book/i.test(manager.itemModel)) {
          match[2] = 'Gradient.png'; */
        } else {
          match[2] = 'PolygonScifi_04_A.png';
        }
      } else if (match[2] === 'Sky.psd') {
        match[2] = 'SimpleSky.png';
      } else if (match[2] === 'Building_Window_Emissive.psd') {
        match[2] = 'PolygonScifi_Background_Building_Emissive.png';
      } else if (match[2] === 'BillboardsGraffiti_01.psd') {
        match[2] = 'Billboards.png';
      } else if (match[2] === 'Signs_Emission.psd') {
        match[2] = 'Signs.png';
      } else if (match[2] === 'Neon_Animation.psd') {
        match[2] = 'NeonSigns.png';
      } else if (match[2] === 'PolygonScifi_Texture_Mike.psd') {
        match[2] = 'PolygonScifi_01_A.png';
      } else if (match[2] === 'Dungeons_Texture.psd') {
        if (/scifi/i.test(match[1])) {
          match[2] = 'PolygonScifi_01_A.png';
        } else if (/wall/i.test(manager.itemModel)) {
          match[2] = 'Dungeons_Texture_WallTiles_01.png';
        } else {
          match[2] = 'Dungeons_Texture_01_B.png';
        }
      } else if (match[2] === 'PolygonTown_Texture_01_Mike.psd') {
        match[2] = 'PolygonTown_Texture_01_A.png';
      } else if (match[2] === 'PolygonWestern_Texture.psd') {
        match[2] = 'PolygonTown_Texture_01_A.png';
      } else if (match[2] === 'PolygonTown_Texture_01_A.psd') {
        if (/battleroyale/i.test(match[1])) {
          match[2] = 'PolygonBattleRoyale_Texture_01_A.png';
        } else if (/road/i.test(manager.itemModel)) {
          match[2] = 'PolygonTown_Road_01.png';
        } else {
          match[2] = 'PolygonTown_Texture_01_A.png';
        }
      } else if (match[2] === 'Windows.psd') {
        match[2] = 'PolygonTown_Texture_01_A.png';
      } else if (match[2] === 'PolygonTown_Texture_01_Andrew.psd') {
        if (/road/i.test(manager.itemModel)) {
          match[2] = 'PolygonTown_Road_01.png';
        } else {
          match[2] = 'PolygonTown_Texture_01_A.png';
        }
      } else if (match[2] === 'PolygonWar_Texture.psd') {
        match[2] = 'PolygonTown_Texture_01_A.png';
      } else if (match[2] === 'noraml.psd') {
        if (/road/i.test(manager.itemModel)) {
          match[2] = 'PolygonTown_Road_Normal.png';
        } else {
          match[2] = 'PolygonTown_Texture_Normal_A.png';
        }
      }
      console.log('new u', `${match[1]}/Textures/${match[2]}`);
      return `${match[1]}/Textures/${match[2]}`;
    } else {
      return u;
    }
  });
  manager.itemModel = '';
  let objects = [];

  const startI = 0;
  const numI = 20;
  for (let i = 0; (startI + i) < itemModels.length && i < numI; i++) {
    const itemModel = itemModels[startI + i];
    console.log('load', startI + i);
    const loader = new THREE.FBXLoader(manager);
    const object = await new Promise((accept, reject) => {
      manager.itemModel = itemModel;
      const managerLoadPromise = new Promise((accept, reject) => {
        manager.onLoad = accept;
        manager.onError = err => {
          debugger;
          reject(err);
        };
      });
      loader.load(`https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/${itemModel}`, object => {
        managerLoadPromise.then(() => {
          accept(object);
        });
      }, progress => {}, reject);
    });
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    if (/apocalypse/.test(itemModel)) {
      object.position.set(0, 0/*-boundingBox.min.y*0.01*/, 0);
    } else if (/battleroyale/.test(itemModel)) {
      object.position.set(0, 0/*-boundingBox.min.y*0.01*/, 0);
    } else if (/dungeon/.test(itemModel)) {
      object.position.set(-center.x, 0, -center.z);
    } else if (/nature/.test(itemModel)) {
      object.position.set(-center.x*0.01, 0, -center.z*0.01);
    } else if (/samurai/.test(itemModel)) {
      object.position.set(-center.x, 0, -center.z);
    } else if (/scifi/.test(itemModel)) {
      object.position.set(-center.x*0.01, 0, -center.z*0.01);
    } else if (/town/.test(itemModel)) {
      object.position.set(-center.x*0.01, 0, -center.z*0.01);
    }
    object.quaternion.set(0, 0, 0, 1);
    object.scale.set(1, 1, 1);

    object.boundingBoxMesh = new THREE.Object3D();
    object.boundingBoxMesh.position.copy(center);
    object.boundingBoxMesh.scale.copy(size);

    // const parentObject = new THREE.Object3D();
    // parentObject.add(object);

    console.log('got o', object);

    const promises = [];
    object.traverse(o => {
      if (o.isMesh) {
        let materials = Array.isArray(o.material) ? o.material : [o.material];
        materials = materials.map(m => {
          console.log('check material', m.name, !!m.map);
          m = new THREE.MeshStandardMaterial({
            name: m.name,
            map: m.map,
            color: m.color,
            vertexColors: m.vertexColors,
            roughness: 1,
            metalness: 0,
          });
          if (!m.map) {
            console.log('missing material texture', itemModel, o, m);
            if (/apocalypse/i.test(itemModel)) {
              if (m.name === 'lambert3' || m.name === 'pasted__lambert3' || m.name === 'lambert122') {
                // promises.push((async () => {
                  console.log('elide bld');
                  /* const img = new Image();
                  img.crossOrigin = true;               
                  img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/apocalypse/Textures/Misc/Overgrowth.png`;
                  await new Promise((accept, reject) => {
                    img.onload = accept;
                    img.onerror = reject;
                  });
                  m.map = new THREE.Texture(img);
                  m.map.needsUpdate = true;
                  // m.vertexColors = 0; */
                  // m.transparent = true;
                  m.color.set(0, 0, 0);
                  // m.opacity = 0;
                  m.map = alphaMap;
                  m.transparent = true;
                  // m.alphaMap = alphaMap;
                // })());
              } else if (/veh/i.test(o.name) && /glass/i.test(o.name)) {
                // promises.push((async () => {
                  console.log('elide vehicle glass');
                  /* const img = new Image();
                  img.crossOrigin = true;               
                  img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/apocalypse/Textures/Veh/PolygonApocalypse_Vehicle_Texture_01.png`;
                  await new Promise((accept, reject) => {
                    img.onload = accept;
                    img.onerror = reject;
                  });
                  m.map = new THREE.Texture(img);
                  m.map.needsUpdate = true; */
                  // m.map = null;
                  m.color.set(0, 0, 0);
                  // m.vertexColors = 0;
                  // m.transparent = true;
                  // m.alphaTest = 0.5;
                  // m.transparent = true;
                  // m.opacity = 0;
                  m.map = alphaMap;
                  m.transparent = true;
                  // m.alphaMap = alphaMap;
                // })());
              } else {
                promises.push((async () => {
                  console.log('loading apocalypse...');
                  const img = new Image();
                  img.crossOrigin = true;               
                  img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/apocalypse/Textures/PolygonApocalypse_Texture_01_A.png`;
                  await new Promise((accept, reject) => {
                    img.onload = accept;
                    img.onerror = reject;
                  });
                  m.map = new THREE.Texture(img);
                  m.map.needsUpdate = true;
                  // m.color.setHSL(m.color.r,m.color.g,m.color.b);
                  // m.vertexColors = 0;
                })());
              }
            } else if (/battleroyale/i.test(itemModel)) {
              promises.push((async () => {
                console.log('loading battleroyale...');
                const img = new Image();
                img.crossOrigin = true;
                img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/battleroyale/Textures/PolygonBattleRoyale_Texture_01_A.png`;
                await new Promise((accept, reject) => {
                  img.onload = accept;
                  img.onerror = reject;
                });
                m.map = new THREE.Texture(img);
                m.map.needsUpdate = true;
                // m.color.setHSL(m.color.r,m.color.g,m.color.b);
                // m.vertexColors = 0;
              })());
            } else if (/nature/i.test(m.name)) {
              promises.push((async () => {
                console.log('loading nature...');
                const img = new Image();
                img.crossOrigin = true;
                img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/nature/Textures/PolygonNature_01.png`;
                await new Promise((accept, reject) => {
                  img.onload = accept;
                  img.onerror = reject;
                });
                m.map = new THREE.Texture(img);
                m.map.needsUpdate = true;
                // m.color.setHSL(m.color.r,m.color.g,m.color.b);
                // m.vertexColors = 0;
              })());
            } else if (/sphere/i.test(itemModel)) {
              promises.push((async () => {
                console.log('loading sphere...');
                const img = new Image();
                img.crossOrigin = true;
                img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/scifi/Textures/Signs.png`;
                await new Promise((accept, reject) => {
                  img.onload = accept;
                  img.onerror = reject;
                });
                m.map = new THREE.Texture(img);
                m.map.needsUpdate = true;
                // m.color.setHSL(m.color.r,m.color.g,m.color.b);
                // m.vertexColors = 0;
              })());
            } else if (/scifi/i.test(itemModel)) {
              promises.push((async () => {
                console.log('loading scifi...');
                const img = new Image();
                img.crossOrigin = true;
                img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/scifi/Textures/PolygonScifi_04_A.png`;
                await new Promise((accept, reject) => {
                  img.onload = accept;
                  img.onerror = reject;
                });
                m.map = new THREE.Texture(img);
                m.map.needsUpdate = true;
                // m.color.setHSL(m.color.r,m.color.g,m.color.b);
                // m.vertexColors = 0;
              })());
            } else if (/glass/i.test(m.name)) {
              promises.push((async () => {
                console.log('loading glass...');
                const img = new Image();
                img.crossOrigin = true;
                img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/town/Textures/PolygonTown_Window_01.png`;
                await new Promise((accept, reject) => {
                  img.onload = accept;
                  img.onerror = reject;
                });
                m.map = new THREE.Texture(img);
                m.map.needsUpdate = true;
                // m.color.setHSL(m.color.r,m.color.g,m.color.b);
                // m.vertexColors = 0;
              })());
            } else if (/road/i.test(itemModel)) {
              promises.push((async () => {
                console.log('loading road...');
                const img = new Image();
                img.crossOrigin = true;
                img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/town/Textures/PolygonTown_Road_01.png`;
                await new Promise((accept, reject) => {
                  img.onload = accept;
                  img.onerror = reject;
                });
                m.map = new THREE.Texture(img);
                m.map.needsUpdate = true;
                // m.color.setHSL(m.color.r,m.color.g,m.color.b);
                // m.vertexColors = 0;
              })());
            } else if (/town/i.test(itemModel)) {
              promises.push((async () => {
                console.log('loading town...');
                const img = new Image();
                img.crossOrigin = true;
                img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/town/Textures/PolygonTown_Texture_01_A.png`;
                await new Promise((accept, reject) => {
                  img.onload = accept;
                  img.onerror = reject;
                });
                m.map = new THREE.Texture(img);
                m.map.needsUpdate = true;
                // m.color.setHSL(m.color.r,m.color.g,m.color.b);
                // m.vertexColors = 0;
              })());
            }
            /* if (/trunk/i.test(m.name)) {
              promises.push((async () => {
                console.log('loading nature...');
                const img = new Image();
                img.crossOrigin = true;
                img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/nature/Textures/Leaves/Birch_Trunk_Texture.png`;
                await new Promise((accept, reject) => {
                  img.onload = accept;
                  img.onerror = reject;
                });
                o.material.map = new THREE.Texture(img);
                o.material.map.needsUpdate = true;
                // m.color.setHSL(m.color.r,m.color.g,m.color.b);
                // m.vertexColors = 0;
              })());
            } else if (/lea[fv]/i.test(m.name)) {
              promises.push((async () => {
                console.log('loading nature...');
                const img = new Image();
                img.crossOrigin = true;
                img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/nature/Textures/Leaves/Leaves_Pine_Texture.png`;
                await new Promise((accept, reject) => {
                  img.onload = accept;
                  img.onerror = reject;
                });
                o.material.map = new THREE.Texture(img);
                o.material.map.needsUpdate = true;
                // m.color.setHSL(m.color.r,m.color.g,m.color.b);
                // m.color = new THREE.Color(0, 0, 0);
                // m.vertexColors = 0;
              })());
            } */
          } else {
            if (/apocalypse/i.test(itemModel) && /motorway/i.test(itemModel)) {
              // m.map = null;
              promises.push((async () => {
                console.log('loading town...');
                const img = new Image();
                img.crossOrigin = true;
                img.src = `https://rawcdn.githack.com/exokitxr/item-models/${itemModelsHash}/apocalypse/Textures/Misc/PolygonApocalyse_Road_01.png`;
                await new Promise((accept, reject) => {
                  img.onload = accept;
                  img.onerror = reject;
                });
                m.map = new THREE.Texture(img);
                m.map.needsUpdate = true;
                // m.color.setHSL(m.color.r,m.color.g,m.color.b);
                // m.vertexColors = 0;
              })());
            } else {
              m.vertexColors = 0;
            }
          }
          // console.log('got material', o.material);
          // o.material.transparent = true;
          // o.material.alphaTest = 0.5;
          // o.material.color = new THREE.Color(0, 0, 0);
          /* o.material = new THREE.MeshStandardMaterial({
            map: o.material.map,
          }); */

          return m;
        });
        o.material = materials.length > 1 ? materials : materials[0];
      }
    });
    await Promise.all(promises);

    if (/apocalypse/.test(itemModel)) {
      object.scale.multiplyScalar(0.01);
    } else if (/battleroyale/.test(itemModel)) {
      object.scale.multiplyScalar(0.01);
    } else if (/dungeon/.test(itemModel)) {
      // nothing
    } else if (/nature/.test(itemModel)) {
      object.scale.multiplyScalar(0.01);
    } else if (/samurai/.test(itemModel)) {
      // object.scale.multiplyScalar(0.01);
    } else if (/scifi/.test(itemModel)) {
      object.scale.multiplyScalar(0.01);
    } else if (/town/.test(itemModel)) {
      object.scale.multiplyScalar(0.01);
    }

    {
      const ab = await new Promise((accept, reject) => {
        new THREE.GLTFExporter().parse(object, ab => {
          accept(ab);
        }, {
          binary: true,
        });
      });
      const u = `https://lol.exokit.org/${itemModel.replace(/\.fbx$/, '.glb')}`;
      // console.log('uploading', u, ab);
      await fetch(u, {
        method: 'PUT',
        body: ab,
      })
        .then(res => res.json());
    }
    {
      const blob = await screenshot(object, {
        width: 192,
        height: 192,
        // cameraPosition,
        lights,
      });

      const url = URL.createObjectURL(blob);
      if (screenshotImage.src) {
        URL.revokeObjectURL(screenshotImage.src);
      }
      screenshotImage.src = url;

      const u = `https://lol.exokit.org/${itemModel.replace(/\.fbx$/, '.png')}`;
      await fetch(u, {
        method: 'PUT',
        body: blob,
      })
        .then(res => res.json());
    }

    object.position.x += (i%10)*2;
    scene.add(object);
    objects.push(object);

    while (objects.length > 10) {
      const object = objects.shift();
      scene.remove(object);
    }
  }
})();

const toolManager = new ToolManager({
  domElement: renderer.domElement,
  camera,
  container,
});
toolManager.addEventListener('toolchange', e => {
  const toolName = e.data;
  const cameraSelected = toolName === 'camera';
  const selectSelected = toolName === 'select';
  const moveSelected = toolName === 'move';

  orbitControls.enabled = cameraSelected;

  Array.from(document.querySelectorAll('xr-iframe')).concat(Array.from(document.querySelectorAll('xr-model'))).forEach(xrNode => {
    const {bindState: {model: {boundingBoxMesh}, control}} = xrNode;
    boundingBoxMesh.visible = selectSelected;
    control.visible = moveSelected;
    control.enabled = moveSelected;
  });
  /* Array.from(document.querySelectorAll('xr-site')).forEach(xrSite => {
    const toolName = toolManager.getSelectedToolName();
    xrSite.baseMesh.visible = ['select', 'trace'].includes(toolName);
    xrSite.guardianMesh.visible = toolName === 'select';
  }); */
});
toolManager.addEventListener('editchange', e => {
  lastParcelKey = '';
});

const _bindXrIframe = xrIframe => {
  const model = new THREE.Object3D();
  container.add(model);

  const boundingBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));
  const boundingBoxMesh = _makeBoundingBoxMesh(model, boundingBox);
  boundingBoxMesh.visible = toolManager.getSelectedToolName() === 'select';
  model.boundingBoxMesh = boundingBoxMesh;
  model.add(model.boundingBoxMesh);
  model.element = xrIframe;

  const control = new THREE.TransformControls(camera, renderer.domElement);
  control.setMode(transformMode);
  control.size = 3;
  control.visible = toolManager.getSelectedToolName() === 'move';
  control.enabled = control.visible;
  control.addEventListener('dragging-changed', e => {
    orbitControls.enabled = !e.value && toolManager.getSelectedToolName() === 'camera';
  });
  control.addEventListener('mouseEnter', () => {
    control.draggable = true;
  });
  control.addEventListener('mouseLeave', () => {
    control.draggable = false;
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
    const editedEl = toolManager.getEditedElement();
    if (editedEl) {
      toolManager.clampPositionToElementExtent(control.object.position, editedEl);
    }

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
const _bindXrSite = xrSite => {
  const _update = () => {
    if (xrSite.guardianMesh) {
      container.remove(xrSite.guardianMesh);
      xrSite.guardianMesh = null;
    }
    if (xrSite.baseMesh) {
      container.remove(xrSite.baseMesh);
      xrSite.baseMesh = null;
    }

    const extents = THREE.Land.parseExtents(xrSite.getAttribute('extents'));
    if (extents.length > 0) {
      let color;
      if (toolManager.getDirtyElement() === xrSite) {
        color = colors.select4;
      } else if (toolManager.getSelectedElement() === xrSite) {
        color = colors.select3;
      } else {
        color = colors.select;
      }

      // const toolName = toolManager.getSelectedToolName();
      xrSite.baseMesh = new THREE.Land(extents, color);
      // xrSite.baseMesh.visible = ['select', 'trace'].includes(toolName);
      container.add(xrSite.baseMesh);
      xrSite.guardianMesh = new THREE.Guardian(extents, 10, color);
      // xrSite.guardianMesh.visible = toolName === 'select';
      container.add(xrSite.guardianMesh);
    }
  };
  _update();
  const observer = new MutationObserver(_update);
  observer.observe(xrSite, {
    attributes: true,
    attributeFilter: [
      'extents',
    ],
  });
  xrSite.bindState = {
    observer,
  };
};
const _unbindXrSite = xrSite => {
  container.remove(xrSite.guardianMesh);
  xrSite.guardianMesh = null;
  container.remove(xrSite.baseMesh);
  xrSite.baseMesh = null;

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
const _makeBoundingBoxMesh = (target, boundingBox = new THREE.Box3().setFromObject(target)) => {
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
        const boundingBoxMesh = _makeBoundingBoxMesh(model);
        boundingBoxMesh.visible = toolManager.getSelectedToolName() === 'select';
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
    control.visible = toolManager.getSelectedToolName() === 'move';
    control.enabled = control.visible;
    control.addEventListener('dragging-changed', e => {
      orbitControls.enabled = !e.value && toolManager.getSelectedToolName() === 'camera';
    });
    control.addEventListener('mouseEnter', () => {
      control.draggable = true;
    });
    control.addEventListener('mouseLeave', () => {
      control.draggable = false;
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
      const editedEl = toolManager.getEditedElement();
      if (editedEl) {
        toolManager.clampPositionToElementExtent(control.object.position, editedEl);
      }

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
const _setLocalModel = newModel => {
  if (rig) {
    container.remove(rig.model);
    rig.destroy();
    rig = null;
  }

  rig = new Avatar(newModel, {
    fingers: true,
    hair: true,
    visemes: true,
    decapitate: possessRig,
    microphoneMediaStream,
    debug: !newModel,
  });
  container.add(rig.model);
  window.model = newModel;

  heightFactor = _getHeightFactor(rig.height);

  container.scale.set(1, 1, 1).divideScalar(heightFactor);
  _updateXrIframeMatrices();
};

const lastPresseds = [false, false];
const lastBs = [false, false];
const lastPads = [false, false];
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

  const editedEl = toolManager.getEditedElement();
  if (editedEl && editedEl.tagName === 'XR-SITE') {
    const {baseMesh, guardianMesh} = editedEl;
    const f = 1 + Math.pow(1 - (now % 1000) / 1000, 2);
    const c = localColor.setHex(colors.select3).multiplyScalar(f);
    baseMesh.material.uniforms.uColor.value.copy(c);
    guardianMesh.material.uniforms.uColor.value.copy(c);
  }

  if (rig) {
    if (possessRig) {
      const vrCameras = renderer.vr.getCamera(camera).cameras;
      const vrCamera = vrCameras[0];
      const vrCamera2 = vrCameras[1];
      vrCamera.matrixWorld.decompose(vrCamera.position, vrCamera.quaternion, vrCamera.scale);
      vrCamera2.matrixWorld.decompose(vrCamera2.position, vrCamera2.quaternion, vrCamera2.scale);
      vrCamera.position.add(vrCamera2.position).divideScalar(2);
      const {inputSources} = session;
      const gamepads = navigator.getGamepads();

      rig.inputs.hmd.position.copy(vrCamera.position).sub(container.position).multiplyScalar(heightFactor);
      rig.inputs.hmd.quaternion.copy(vrCamera.quaternion);

      const _getGamepad = i => {
        const handedness = i === 0 ? 'left' : 'right';
        const inputSource = inputSources.find(inputSource => inputSource.handedness === handedness);
        let pose, gamepad;
        if (inputSource && (pose = frame.getPose(inputSource.gripSpace, referenceSpace)) && (gamepad = inputSource.gamepad || gamepads[i])) {
          const {transform} = pose;
          const {position, orientation, matrix} = transform;
          if (position) {
            const rawP = localVector.copy(position);
            const p = localVector2.copy(rawP).sub(container.position).multiplyScalar(heightFactor);
            const q = localQuaternion.copy(orientation);
            const pressed = gamepad.buttons[0].pressed;
            const lastPressed = lastPresseds[i];
            const pointer = gamepad.buttons[0].value;
            const grip = gamepad.buttons[1].value;
            const pad = gamepad.axes[1] <= -0.5 || gamepad.axes[3] <= -0.5;
            const padX = gamepad.axes[0] !== 0 ? gamepad.axes[0] : gamepad.axes[2];
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
              padX,
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
      const _updateTeleportMesh = (i, pad, lastPad, position, quaternion, padX, padY, stick) => {
        const teleportMesh = teleportMeshes[i];
        teleportMesh.visible = false;

        if (pad) {
          localVector.copy(vrCamera.position).applyMatrix4(localMatrix.getInverse(container.matrix));
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

        if (padX !== 0 || padY !== 0) {
          localVector.set(padX, 0, padY);
          const moveLength = localVector.length();
          if (moveLength > 1) {
            localVector.divideScalar(moveLength);
          }
          const hmdEuler = localEuler.setFromQuaternion(rig.inputs.hmd.quaternion, 'YXZ');
          localEuler.x = 0;
          localEuler.z = 0;
          container.position.sub(localVector.multiplyScalar(walkSpeed * timeDiff * (stick ? 3 : 1) * rig.height).applyEuler(hmdEuler));

          _updateXrIframeMatrices();
        }
      };

      const wasLastBd = lastBs[0] && lastBs[1];

      const lg = _getGamepad(1);
      if (lg) {
        const {rawPosition, position, quaternion, pressed, lastPressed, pointer, grip, pad, b} = lg;
        rig.inputs.leftGamepad.quaternion.copy(quaternion);
        rig.inputs.leftGamepad.position.copy(position);
        rig.inputs.leftGamepad.pointer = pointer;
        rig.inputs.leftGamepad.grip = grip;

        _updateTeleportMesh(0, pad, lastPads[0], position, quaternion, 0, 0, false);

        lastPresseds[0] = pressed;
        lastPads[0] = pad;
        lastBs[0] = b;
        lastPositions[0].copy(rawPosition);
      }
      const rg = _getGamepad(0);
      if (rg) {
        const {rawPosition, position, quaternion, pressed, lastPressed, pointer, grip, pad, padX, padY, stick, b} = rg;
        rig.inputs.rightGamepad.quaternion.copy(quaternion);
        rig.inputs.rightGamepad.position.copy(position);
        rig.inputs.rightGamepad.pointer = pointer;
        rig.inputs.rightGamepad.grip = grip;

        _updateTeleportMesh(1, false, false, position, quaternion, padX, padY, stick);

        lastPresseds[1] = pressed;
        lastPads[1] = pad;
        lastBs[1] = b;
        lastPositions[1].copy(rawPosition);
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

const chatMessages = topDocument.getElementById('chat-messages');
const chatInput = topDocument.getElementById('chat-input');
let transformMode = 'translate';
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
        if (toolManager.getSelectedToolName() === 'move' && !chatInput.classList.contains('open')) {
          _setMode('translate');
        }
        break;
      }
      case 69: { // E
        if (toolManager.getSelectedToolName() === 'move' && !chatInput.classList.contains('open')) {
          _setMode('rotate');
        }
        break;
      }
      case 82: { // R
        if (toolManager.getSelectedToolName() === 'move' && !chatInput.classList.contains('open')) {
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
      case 49: // 1
      case 50: // 2
      case 51: // 3
      case 52: // 4
      {
        toolManager.selectTool(e.which - 49);
        break;
      }
      case 27: { // esc
        if (!chatInput.classList.contains('open')) {
          saveDialog.classList.remove('open');
          toolManager.escape();
        } else {
          chatInput.classList.remove('open');
          chatInput.value = '';
        }
        break;
      }
      case 46: { // del
        if (!chatInput.classList.contains('open')) {
          toolManager.delete();
        }
        break;
      }
      case 13: { // enter
        chatInput.classList.toggle('open');
        if (chatInput.classList.contains('open')) {
          chatInput.focus();
        } else {
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
        }
        break;
      }
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
      }

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
  return [Math.floor(x/parcelSize), Math.floor(z/parcelSize)];
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
const _getAllParcelXrSites = dom => {
  const result = [];
  const _recurse = node => {
    if (node.tagName === 'xr-site') {
      result.push(node);
    }
    if (node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        _recurse(node.childNodes[i]);
      }
    }
  };
  _recurse(dom);
  return result;
};
const _getParcelCoords = xrSite => {
  const extentsValue = xrSite.attrs.extents ? xrSite.attrs.extents.value : '';
  const extents = THREE.Land.parseExtents(extentsValue);
  return extents.flatMap(extent => {
    const [x1, y1, x2, y2] = extent;
    const result = [];
    for (let x = x1; x < x2; x += parcelSize) {
      for (let y = y1; y < y2; y += parcelSize) {
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
const _getParcelXrSite = (dom, coord) => {
  const xrSites = _getAllParcelXrSites(dom);
  const ax = coord[0]*parcelSize;
  const ay = coord[1]*parcelSize;
  for (let i = 0; i < xrSites.length; i++) {
    const xrSite = xrSites[i];
    const extentsValue = xrSite.attrs.extents ? xrSite.attrs.extents.value : '';
    const extents = THREE.Land.parseExtents(extentsValue);
    for (let j = 0; j < extents.length; j++) {
      const [x1, y1, x2, y2] = extents[j];
      for (let x = x1; x < x2; x += parcelSize) {
        for (let y = y1; y < y2; y += parcelSize) {
          if (ax === x && ay === y) {
            return xrSite;
          }
        }
      }
    }
  }
  return null;
};
const _connectLand = () => {
  let running = false;
  const _updateGrid = async () => {
    if (!running) {
      running = true;

      if (!toolManager.getEditedElement()) {
        const coord = _getCurrentParcelCoords();
        const k = coord.join(':');
        if (k !== lastParcelKey) {
          const [x, z] = coord;
          const dom = parseHtml(codeInput.value);
          const requiredParcelCoords = _getRequiredParcelCoords(x, z);
          const outrangedParcels = _getAllParcelXrSites(dom)
            .filter(xrSite => // parcels where every coord is not required
              _getParcelCoords(xrSite).every(coord => !requiredParcelCoords.some(coord2 => coord2[0] === coord[0] && coord2[1] === coord[1]))
            );
          if (outrangedParcels.length > 0) {
            for (let i = 0; i < outrangedParcels.length; i++) {
              _removeParcelDomNode(dom, outrangedParcels[i]);
            }
            codeInput.value = serializeHtml(dom);
            codeInput.dispatchEvent(new CustomEvent('change'));
          }
          const missingParcelCoords = requiredParcelCoords.filter(coord => !_getParcelXrSite(dom, coord));
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
                const extents = [[minX*parcelSize, minZ*parcelSize, (maxX+1)*parcelSize, (maxZ+1)*parcelSize]];
                dom.childNodes.push(parseHtml(`<xr-site name="${encodeURIComponent(parcel.name)}" extents="${THREE.Land.serializeExtents(extents)}">${parcel.html}</xr-site>`).childNodes[0]);
                codeInput.value = serializeHtml(dom);
                codeInput.dispatchEvent(new CustomEvent('change'));

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
        }
      }

      running = false;
    }
  }
  _updateGrid();
  const updateInterval = setInterval(_updateGrid, 500);

  return {
    disconnect() {
      const selectedElement = toolManager.getSelectedElement();
      if (selectedElement && selectedElement.tagName === 'XR-SITE') {
        toolManager.deselect();
      }

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
    orbitControls.enabled = toolManager.getSelectedToolName() === 'camera';
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

mirrorMeshSwitchWrap.addEventListener('click', async () => {
  mirrorMeshSwitchWrap.classList.toggle('on');

  const enabled = mirrorMeshSwitchWrap.classList.contains('on');
  mirrorMesh.visible = enabled;
  if (enabled) {
    localStorage.setItem('mirrorMesh', true);
  } else {
    localStorage.removeItem('mirrorMesh');
  }
});

let session = null;
const enterXrButton = topDocument.getElementById('enter-xr-button');
const _setSession = async newSession => {
  session = newSession;

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

    session.requestAnimationFrame((timestamp, frame) => {
      renderer.vr.enabled = true;
      renderer.setAnimationLoop(null);
      renderer.vr.setAnimationLoop(animate);

      const pose = frame.getViewerPose(referenceSpace);
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
      renderer.vr.setSession(null);
      renderer.setSize(fullWidth, height);
      renderer.setPixelRatio(1);
      renderer.vr.setSession(session);

      if (typeof FakeXRDisplay !== 'undefined') {
        fakeXrDisplay = new FakeXRDisplay();
        camera.projectionMatrix.toArray(fakeXrDisplay.projectionMatrix);
      }

      accept();
    });
  });
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
const avatarModelsContent = topDocument.getElementById('avatar-models-content');
const prefabsContent = topDocument.getElementById('prefabs-content');
Promise.resolve().then(() => {
  Array.from(siteUrlsContent.querySelectorAll('.a-site')).forEach(aSite => {
    const src = aSite.getAttribute('src');
    aSite.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text', JSON.stringify({
        type: 'site',
        src,
      }));
    });

    const addButton = aSite.querySelector('.add-button');
    addButton.addEventListener('click', () => {
      const dom = parseHtml(codeInput.value);
      const xrSite = _findNodeWithTagName(dom, 'xr-site');
      const editedEl = toolManager.getEditedElement();
      if (xrSite && (!landConnection || editedEl)) {
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
  });

  Array.from(avatarModelsContent.querySelectorAll('.a-avatar')).forEach(aAvatar => {
    const src = aAvatar.getAttribute('src');
    aAvatar.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text', JSON.stringify({
        type: 'avatar',
        src,
      }));
    });

    const addButton = aAvatar.querySelector('.add-button');
    addButton.addEventListener('click', () => {
      const dom = parseHtml(codeInput.value);
      const xrSite = _findNodeWithTagName(dom, 'xr-model');
      const editedEl = toolManager.getEditedElement();
      if (xrSite && (!landConnection || editedEl)) {
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
  });

  const prefabIntersectionObserver = new IntersectionObserver(entries => {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.isIntersecting) {
        const aPrefab = entry.target;
        const img = aPrefab.querySelector('img');
        if (!img.src) {
          const src = aPrefab.getAttribute('src');
          img.src = src.replace(/\.glb$/, '.png');
        }
      }
    }
  }, {
    root: prefabsContent,
    // threshold: 0.001,
  });
  const aPrefabs = Array.from(prefabsContent.querySelectorAll('.a-prefab'));
  aPrefabs.forEach(aPrefab => {
    const src = aPrefab.getAttribute('src');
    aPrefab.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text', JSON.stringify({
        type: 'avatar',
        src,
      }));
    });
    const addButton = aPrefab.querySelector('.add-button');
    addButton.addEventListener('click', () => {
      const dom = parseHtml(codeInput.value);
      const xrSite = _findNodeWithTagName(dom, 'xr-site');
      const editedEl = toolManager.getEditedElement();
      if (xrSite && (!landConnection || editedEl)) {
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
    prefabIntersectionObserver.observe(aPrefab);
  });
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

      peerConnection.model = null;
      peerConnection.rig = null;
      peerConnection.mediaStream = null;
      let updateInterval = 0;
      peerConnection.addEventListener('open', () => {
        console.log('add peer connection', peerConnection);

        peerConnections.push(peerConnection);

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
      });
      peerConnection.addEventListener('close', () => {
        console.log('remove peer connection', peerConnection);

        const index = peerConnections.indexOf(peerConnection);
        if (index !== -1) {
          peerConnections.splice(index, 1);
        }

        clearInterval(updateInterval);

        if (peerConnection.rig) {
          container.remove(peerConnection.rig.model);
          peerConnection.rig.destroy();
        }
      });
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
        if (method === 'model') {
          const {url} = data;
          console.log('got peer model', {url});

          if (peerConnection.rig) {
            container.remove(peerConnection.rig.model);
            peerConnection.rig.destroy();
          }

          const model = url ? await _loadModelUrl(url) : null;
          peerConnection.rig = new Avatar(model, {
            fingers: true,
            hair: true,
            visemes: true,
            microphoneMediaStream: peerConnection.mediaStream,
            muted: false,
            debug: !model,
          });
          container.add(peerConnection.rig.model);

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

const _findNodeWithTagName = (node, tagName) => {
  const _recurse = node => {
    if (node.tagName === 'xr-site') {
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
const _bindUploadFileButton = inputFileEl => {
  inputFileEl.addEventListener('change', async e => {
    const {files} = e.target;
    if (files.length === 1) {
      const [file] = files;
      _uploadFile(file);
    }

    const {parentNode} = inputFileEl;
    parentNode.removeChild(inputFileEl);
    const newInputFileEl = topDocument.createElement('input');
    newInputFileEl.type = 'file';
    newInputFileEl.id = 'upload-file-button';
    newInputFileEl.style.display = 'none';
    parentNode.appendChild(newInputFileEl);
    _bindUploadFileButton(newInputFileEl);
  });
};
_bindUploadFileButton(topDocument.getElementById('upload-file-button'));
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
          const editedEl = toolManager.getEditedElement();
          if (xrSite && (!landConnection || editedEl)) {
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

              if (editedEl) {
                toolManager.clampPositionToElementExtent(position, editedEl);
              }

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
const _loadInventory = async () => {
  const res = await fetch(`https://upload.exokit.org/${loginToken.name}`);
  if (res.ok) {
    const files = await res.json();
    inventoryContent.innerHTML = files.map(filename => {
      return `<nav class=a-file draggable=true src="${encodeURI(filename)}">
        <div class=overlay>
          <div class=multibutton>
            <nav class="button first last add-button">Add</nav>
          </div>
        </div>
        <i class="fas fa-file"></i>
        <div class=name>${escape(filename)}</name>
      </nav>`;
    }).join('\n');
  } else {
    throw new Error(`invalid status code: ${res.status}`);
  }
};

let loginToken = null;
const loginUrl = 'https://login.exokit.org/';
async function doLogin(email, code) {
  const res = await fetch(`${loginUrl}?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`, {
    method: 'POST',
  });
  if (res.ok) {
    const newLoginToken = await res.json();

    await storage.set('loginToken', newLoginToken);

    loginToken = newLoginToken;

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

// const loginButton = topDocument.getElementById('login-button');
// const loginButton2 = topDocument.getElementById('login-button-2');
// const loginPopdown = topDocument.getElementById('login-popdown');
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

    window.location.reload();

    /* loginToken = null;
    xrEngine.postMessage({
      method: 'login',
      loginToken,
    });

    loginNotice.innerHTML = '';
    loginError.innerHTML = '';
    topDocument.body.classList.remove('logged-in');
    loginForm.classList.remove('phase-3');
    loginForm.classList.add('phase-1'); */
  }
};

(async () => {
  const localLoginToken = await storage.get('loginToken');
  if (localLoginToken) {
    const res = await fetch(`${loginUrl}?email=${encodeURIComponent(localLoginToken.email)}&token=${encodeURIComponent(localLoginToken.token)}`, {
      method: 'POST',
    })
    if (res.ok) {
      loginToken = await res.json();

      await storage.set('loginToken', loginToken);

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
  const aAvatars = Array.from(topDocument.querySelectorAll('.a-avatar'));
  const aAvatar = aAvatars[0];
  const src = aAvatar.getAttribute('src');
  const model = await _loadModelUrl(src);
  _setLocalModel(model);
  modelUrl = src;
})();

/* window.addEventListener('message', async e => {
  const {method} = e.data;
  switch (method) {
    default: {
      console.warn(`unknown window method: ${method}`);
      break;
    }
  }
}); */

window.addEventListener('resize', e => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (fakeXrDisplay) {
    camera.projectionMatrix.toArray(fakeXrDisplay.projectionMatrix);
  }
});

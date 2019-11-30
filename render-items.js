import screenshot from 'https://screenshots.exokit.org/screenshot.js';
import itemModels from 'https://item-models.exokit.org/item-models.js';

const {document: topDocument} = window.top;

const renderItems = async scene => {
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
    img.crossOrigin = 'Anonymous';
    img.src = 'https://item-models.exokit.org/misc/Textures/transparent.png';
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
        if (/apocalypse/i.test(manager.itemModel) && /veh/i.test(manager.itemModel)) {
          match[2] = 'Veh/PolygonApocalypse_Vehicle_Texture_01.png';
        } else {
          match[2] = 'PolygonApocalypse_Texture_01_A.png';
        }
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

  const _flipImage = (() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    return async image => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.clearRect(0, 0, image.naturalWidth, image.naturalHeight);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(0, image.naturalHeight);
      ctx.scale(1, -1);
      ctx.drawImage(image, 0, 0);
      const b = await new Promise((accept, reject) => {
        canvas.toBlob(accept, 'image/png');
      });
      return b;
    };
  })();

  const startI = 0;
  const numI = 4;
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
                  m.map.flipY = false;
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
                  m.map.flipY = false;
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
              // promises.push((async () => {
                  console.log('elide glass');
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
                  m.map.flipY = false;
                  m.transparent = true;
                  // m.alphaMap = alphaMap;
                // })());
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
    promises.length = 0;

    object.traverse(o => {
      if (o.isMesh) {
        let materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach(m => {
          if (m.map) {
            const imageDst = 'https://raw.exokit.org/' + m.map.image.src.replace(/^.*\/([^\/]+?\/)(Textures)(\/.*?)$/, '$1TexturesY$3');
            // console.log('got image dst', m.map.image.src, imageDst);
            const imageSrc = m.map.image.src.replace(/^.*\/([^\/]+?\/)(Textures)(\/.*?)$/, 'https://item-models.exokit.org/glb/$1TexturesY$3');
            // console.log('got image src', m.map.image.src, imageSrc);

            promises.push((async () => {
              if (m.map.flipY) {
                if (!m.map.image.oldSrc) {
                  const b = await _flipImage(m.map.image);
                  await fetch(imageDst, {
                    method: 'PUT',
                    body: b,
                  })
                    .then(res => res.json());

                  if (!m.map.image.oldSrc) {
                    /* await new Promise((accept, reject) => {
                      m.map.image.onload = accept;
                      m.map.image.onerror = err => {
                        accept();
                      }; */
                      m.map.image.oldSrc = m.map.image.src;
                      // m.map.image.src = imageSrc;
                      Object.defineProperty(m.map.image, 'src', {
                        get() {
                          return imageSrc;
                        },
                      });
                      m.map.image.needsUpdate = true;
                    // });
                  }
                }
                m.map.flipY = false;
              } else {
                if (!m.map.image.oldSrc) {
                  // console.log('no flip!', m.map.image.src, imageDst);

                  m.map.image.oldSrc = m.map.image.src;

                  const res = await fetch(m.map.image.src);
                  const b = await res.blob();

                  await fetch(imageDst, {
                    method: 'PUT',
                    body: b,
                  })
                    .then(res => res.json());

                  /* await new Promise((accept, reject) => {
                    m.map.image.onload = accept;
                    m.map.image.onerror = err => {
                      accept();
                    }; */
                    m.map.image.oldSrc = m.map.image.src;
                    // m.map.image.src = imageSrc;
                    Object.defineProperty(m.map.image, 'src', {
                      get() {
                        return imageSrc;
                      },
                    });
                    m.map.image.needsUpdate = true;
                  // });
                }
              }
            })());
          }
        });
      }
    });
    await Promise.all(promises);
    promises.length = 0;

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
          embedImages: false,
        });
      });
      const u = `https://raw.exokit.org/${itemModel.replace(/\.fbx$/, '.glb')}`;
      // console.log('uploading', u, ab);
      await fetch(u, {
        method: 'PUT',
        body: ab,
      })
        .then(res => res.json());
    }

    object.traverse(o => {
      if (o.isMesh) {
        let materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach(m => {
          if (m.map && m.map.image.oldSrc) {
            // console.log('back to old', m.map.image.oldSrc);
            promises.push((async () => {
              // console.log('trigger 1');
              await new Promise((accept, reject) => {
                // console.log('trigger 2');
                const image = new Image();
                image.onload = accept;
                image.onerror = reject;
                image.crossOrigin = 'Anonymous';
                image.src = m.map.image.oldSrc;
                m.map.image = image;
              });
              m.map.image.needsUpdate = true;
              m.map.flipY = true;
              // console.log('trigger 3');
            })());
          }
        });
      }
    });
    await Promise.all(promises);
    promises.length = 0;

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

      const u = `https://raw.exokit.org/${itemModel.replace(/\.fbx$/, '.png')}`;
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
};
export default renderItems;
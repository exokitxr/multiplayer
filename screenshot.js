const screenshot = async model => {
  const scene = new THREE.Scene();

  const ambientLight = new THREE.AmbientLight(0x808080);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1);
  directionalLight.position.set(0.5, 1, 0.5);
  scene.add(directionalLight);

  /* const gridHelper = new THREE.GridHelper(10, 10);
  scene.add(gridHelper); */

  const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000);
  const dist = 10;
  camera.position.copy(model.boundingBoxMesh.position).add(new THREE.Vector3(0, 0, dist));
  //camera.lookAt(model.boundingBoxMesh.getWorldPosition(new THREE.Vector3()));
  // const localAabb = model.boundingBoxMesh.scale.clone().applyQuaternion(model.quaternion);
  const height = Math.max(model.boundingBoxMesh.scale.x, model.boundingBoxMesh.scale.y, model.boundingBoxMesh.scale.z);
  camera.fov = 2 * Math.atan( height / ( 2 * dist ) ) * ( 180 / Math.PI );
  camera.updateProjectionMatrix();

  // camera.lookAt(model.boundingBoxMesh.getWorldPosition(new THREE.Vector3()));

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(1024, 1024);

  const oldParent = model.parent;
  const oldPosition = model.position.clone();
  const oldQuaternion = model.quaternion.clone();
  const oldScale = model.scale.clone();
  model.position.set(0, 0, 0);
  model.quaternion.set(0, 0, 0, 1);
  model.scale.set(1, 1, 1);
  model.boundingBoxMesh.visible = false;
  scene.add(model);
  renderer.render(scene, camera);
  oldParent.add(model);
  model.position.copy(oldPosition);
  model.quaternion.copy(oldQuaternion);
  model.scale.copy(oldScale);
  model.boundingBoxMesh.visible = true;

  const blob = await new Promise((accept, reject) => {
    renderer.domElement.toBlob(accept, 'image/png');
  });
  return blob;
};
export default screenshot;
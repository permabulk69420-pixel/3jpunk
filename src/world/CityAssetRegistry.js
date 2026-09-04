import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class CityAssetRegistry {
  constructor(slotGroups) {
    this.slotGroups = slotGroups;
    this.loader = new GLTFLoader();
    this.loaded = new Map();
  }

  listSlots() {
    return [...this.slotGroups.keys()];
  }

  async replaceBuilding(slotId, url, { keepProcedural = false, scale = 1 } = {}) {
    const slot = this.slotGroups.get(slotId);
    if (!slot) throw new Error(`Unknown building slot: ${slotId}`);
    const anchor = slot.getObjectByName(`GLB_ANCHOR__${slotId}`);
    if (!anchor) throw new Error(`Missing GLB anchor for slot: ${slotId}`);
    const gltf = await this.loader.loadAsync(url);
    const model = gltf.scene;
    model.name = `GLB_BUILDING__${slotId}`;
    model.scale.setScalar(scale);
    model.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = false;
        object.receiveShadow = true;
        if (object.material?.map) object.material.map.colorSpace = THREE.SRGBColorSpace;
      }
    });
    const previous = this.loaded.get(slotId);
    if (previous) anchor.remove(previous);
    if (!keepProcedural) {
      slot.children.forEach((child) => {
        if (child !== anchor) child.visible = false;
      });
    }
    anchor.add(model);
    this.loaded.set(slotId, model);
    return gltf;
  }

  restoreProcedural(slotId) {
    const slot = this.slotGroups.get(slotId);
    if (!slot) return;
    const loaded = this.loaded.get(slotId);
    const anchor = slot.getObjectByName(`GLB_ANCHOR__${slotId}`);
    if (loaded && anchor) anchor.remove(loaded);
    this.loaded.delete(slotId);
    slot.children.forEach((child) => { child.visible = true; });
  }
}

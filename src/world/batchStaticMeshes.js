import * as THREE from 'three';

const _instanceMatrix = new THREE.Matrix4();
const _combinedMatrix = new THREE.Matrix4();

function canBatch(object, geometryIds) {
  return object.isMesh
    && geometryIds.has(object.geometry?.uuid)
    && object.material
    && !Array.isArray(object.material)
    && !object.material.transparent
    && !object.userData?.noBatch;
}

function batchGroup(group, geometryIds, prefix) {
  const buckets = new Map();

  [...group.children].forEach((object) => {
    if (!canBatch(object, geometryIds)) return;
    object.updateMatrix();
    const key = [
      object.geometry.uuid,
      object.material.uuid,
      Number(object.castShadow),
      Number(object.receiveShadow),
      object.renderOrder,
    ].join(':');
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        geometry: object.geometry,
        material: object.material,
        castShadow: object.castShadow,
        receiveShadow: object.receiveShadow,
        renderOrder: object.renderOrder,
        matrices: [],
        sources: [],
      };
      buckets.set(key, bucket);
    }
    bucket.sources.push(object);

    if (object.isInstancedMesh) {
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, _instanceMatrix);
        bucket.matrices.push(_combinedMatrix.multiplyMatrices(object.matrix, _instanceMatrix).clone());
      }
    } else {
      bucket.matrices.push(object.matrix.clone());
    }
  });

  buckets.forEach((bucket, key) => {
    if (bucket.sources.length === 1 && bucket.sources[0].isInstancedMesh) return;
    if (bucket.matrices.length < 2) return;

    const batch = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.matrices.length);
    batch.name = `${prefix}__${key.slice(0, 8)}__${bucket.matrices.length}`;
    batch.castShadow = bucket.castShadow;
    batch.receiveShadow = bucket.receiveShadow;
    batch.renderOrder = bucket.renderOrder;
    bucket.matrices.forEach((matrix, index) => batch.setMatrixAt(index, matrix));
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    batch.instanceMatrix.needsUpdate = true;

    bucket.sources.forEach((source) => group.remove(source));
    group.add(batch);
  });
}

export function batchStaticMeshes(root, geometries, { prefix = 'STATIC_BATCH', recursive = true } = {}) {
  const geometryIds = new Set(geometries.map((geometry) => geometry.uuid));

  if (recursive) {
    [...root.children].forEach((child) => {
      if (child.isGroup) batchStaticMeshes(child, geometries, { prefix, recursive: true });
    });
  }
  batchGroup(root, geometryIds, prefix);
}

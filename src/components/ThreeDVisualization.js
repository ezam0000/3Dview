import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const ThreeDVisualization = () => {
  const ref = useRef();
  const [scene, setScene] = useState(null);
  const [camera, setCamera] = useState(null);
  const [renderer, setRenderer] = useState(null);
  const [controls, setControls] = useState(null);

  useEffect(() => {
    const currentRef = ref.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x808080); // Set a gray background color
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000); // Adjust far clipping plane
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    currentRef.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.5; // Adjust zoom speed for better control

    // Add ambient light and directional light
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5).normalize();
    scene.add(directionalLight);

    // Add a more complex default geometry for testing
    const geometry = new THREE.TorusKnotGeometry(1, 0.4, 100, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const knot = new THREE.Mesh(geometry, material);
    scene.add(knot);

    camera.position.set(0, 1, 5);
    controls.update();

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    setScene(scene);
    setCamera(camera);
    setRenderer(renderer);
    setControls(controls);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (currentRef) {
        currentRef.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log('File selected:', file.name);
      const extension = file.name.split('.').pop().toLowerCase();
      const reader = new FileReader();

      reader.onload = (e) => {
        const contents = e.target.result;
        console.log('File loaded:', contents);

        let loader;
        let loadedObject;

        switch (extension) {
          case 'gltf':
          case 'glb':
            loader = new GLTFLoader();
            loader.parse(contents, '', (gltf) => {
              console.log('GLTF parsed:', gltf);
              loadedObject = gltf.scene;
              ensureMaterialAndGeometry(loadedObject);
              addObjectToScene(loadedObject, scene, camera, controls);
            });
            break;
          case 'obj':
            loader = new OBJLoader();
            loadedObject = loader.parse(contents);
            console.log('OBJ parsed:', loadedObject);
            ensureMaterialAndGeometry(loadedObject);
            addObjectToScene(loadedObject, scene, camera, controls);
            break;
          case 'fbx':
            loader = new FBXLoader();
            loadedObject = loader.parse(contents);
            console.log('FBX parsed:', loadedObject);
            ensureMaterialAndGeometry(loadedObject);
            addObjectToScene(loadedObject, scene, camera, controls);
            break;
          case 'stl':
            loader = new STLLoader();
            const geometry = loader.parse(contents);
            const material = new THREE.MeshStandardMaterial({ color: 0x0055ff });
            loadedObject = new THREE.Mesh(geometry, material);
            console.log('STL parsed:', loadedObject);
            addObjectToScene(loadedObject, scene, camera, controls);
            break;
          default:
            alert('Unsupported file format');
            break;
        }
      };

      if (extension === 'obj') {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    }
  };

  const ensureMaterialAndGeometry = (object) => {
    object.traverse((child) => {
      if (child.isMesh) {
        if (!child.material) {
          child.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
        }
        if (!child.geometry) {
          console.error('Child mesh does not have geometry:', child);
        }
      }
    });
  };

  const addObjectToScene = (object, scene, camera, controls) => {
    if (!scene) {
      console.error('Scene is not defined');
      return;
    }
    console.log('Adding object to scene:', object);

    // Clear previous objects and add new object
    while (scene.children.length > 0) { 
      scene.remove(scene.children[0]); 
    }
    scene.add(object);

    // Center and fit object within camera view
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    console.log('Bounding box:', box);
    console.log('Center:', center);
    console.log('Size:', size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));

    cameraZ *= 1.2; // Zoom out a little so that objects fit comfortably inside the view

    camera.position.set(center.x, center.y, cameraZ);

    const minZ = box.min.z;
    const cameraToFarEdge = (minZ < 0) ? -minZ + cameraZ : cameraZ - minZ;

    camera.far = cameraToFarEdge * 3;
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    controls.target = center;
    controls.update();
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <input type="file" accept=".gltf,.glb,.obj,.fbx,.stl" onChange={handleFileUpload} style={{ position: 'absolute', zIndex: 10 }} />
      <div ref={ref} style={{ height: '100%', width: '100%' }}></div>
    </div>
  );
};

export default ThreeDVisualization;
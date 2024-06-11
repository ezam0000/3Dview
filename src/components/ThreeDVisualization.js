import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  const [ambientLight, setAmbientLight] = useState(null);
  const [directionalLight, setDirectionalLight] = useState(null);
  const [materialColor, setMaterialColor] = useState(0x0055ff);
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState(0x2c2c2c);
  const [model, setModel] = useState(null);

  useEffect(() => {
    const currentRef = ref.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    currentRef.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.5;

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    setAmbientLight(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 10, 7.5).normalize();
    scene.add(directionalLight);
    setDirectionalLight(directionalLight);

    if (showGrid) {
      const gridHelper = new THREE.GridHelper(10, 10);
      scene.add(gridHelper);
    }

    const geometry = new THREE.TorusKnotGeometry(1, 0.4, 100, 16);
    const material = new THREE.MeshStandardMaterial({ color: materialColor, roughness: 0.5, metalness: 0.5, wireframe });
    const knot = new THREE.Mesh(geometry, material);
    scene.add(knot);
    setModel(knot);

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
  }, [backgroundColor, showGrid]);

  const applyMaterial = useCallback((object) => {
    const material = new THREE.MeshStandardMaterial({ color: materialColor, roughness: 0.5, metalness: 0.5, wireframe });
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = material;
        child.material.needsUpdate = true;
      }
    });
  }, [materialColor, wireframe]);

  useEffect(() => {
    if (model) {
      applyMaterial(model);
    }
  }, [materialColor, wireframe, model, applyMaterial]);

  useEffect(() => {
    if (scene) {
      scene.background = new THREE.Color(backgroundColor);
    }
  }, [backgroundColor, scene]);

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

        switch (extension) {
          case 'gltf':
          case 'glb':
            loader = new GLTFLoader();
            loader.parse(contents, '', (gltf) => {
              console.log('GLTF parsed:', gltf);
              applyMaterial(gltf.scene);
              addObjectToScene(gltf.scene);
            });
            break;
          case 'obj':
            loader = new OBJLoader();
            const obj = loader.parse(contents);
            console.log('OBJ parsed:', obj);
            applyMaterial(obj);
            addObjectToScene(obj);
            break;
          case 'fbx':
            loader = new FBXLoader();
            const fbx = loader.parse(contents);
            console.log('FBX parsed:', fbx);
            applyMaterial(fbx);
            addObjectToScene(fbx);
            break;
          case 'stl':
            loader = new STLLoader();
            const geometry = loader.parse(contents);
            const material = new THREE.MeshStandardMaterial({ color: materialColor, wireframe });
            const mesh = new THREE.Mesh(geometry, material);
            console.log('STL parsed:', mesh);
            addObjectToScene(mesh);
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

  const addObjectToScene = (object) => {
    if (!scene) {
      console.error('Scene is not defined');
      return;
    }
    console.log('Adding object to scene:', object);

    scene.children.forEach((child) => {
      if (child.type !== 'AmbientLight' && child.type !== 'DirectionalLight' && child.type !== 'GridHelper') {
        scene.remove(child);
      }
    });
    scene.add(object);

    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    console.log('Bounding box:', box);
    console.log('Center:', center);
    console.log('Size:', size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));

    cameraZ *= 1.2;

    camera.position.set(center.x, center.y, cameraZ);

    const minZ = box.min.z;
    const cameraToFarEdge = (minZ < 0) ? -minZ + cameraZ : cameraZ - minZ;

    camera.far = cameraToFarEdge * 3;
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    controls.target = center;
    controls.update();
    setModel(object);
  };

  const toggleWireframe = () => {
    setWireframe(!wireframe);
  };

  const toggleGridHelper = () => {
    setShowGrid(!showGrid);
  };

  const resetCamera = () => {
    if (camera && controls) {
      camera.position.set(0, 1, 5);
      camera.lookAt(new THREE.Vector3(0, 0, 0));
      controls.update();
    }
  };

  const scaleModel = (event) => {
    if (model) {
      const scale = parseFloat(event.target.value);
      model.scale.set(scale, scale, scale);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <input type="file" accept=".gltf,.glb,.obj,.fbx,.stl" onChange={handleFileUpload} style={{ position: 'absolute', zIndex: 10 }} />
      <div ref={ref} style={{ height: '100%', width: '100%' }}></div>
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: 'white', padding: '10px', borderRadius: '8px' }}>
        <div>
          <label>Ambient Light Intensity:</label>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={ambientLight ? ambientLight.intensity : 2}
            onChange={(e) => {
              if (ambientLight) {
                ambientLight.intensity = parseFloat(e.target.value);
                setAmbientLight(ambientLight);
              }
            }}
          />
        </div>
        <div>
          <label>Directional Light Intensity:</label>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={directionalLight ? directionalLight.intensity : 2}
            onChange={(e) => {
              if (directionalLight) {
                directionalLight.intensity = parseFloat(e.target.value);
                setDirectionalLight(directionalLight);
              }
            }}
          />
        </div>
        <div>
          <label>Material Color:</label>
          <input
            type="color"
            value={`#${materialColor.toString(16).padStart(6, '0')}`}
            onChange={(e) => setMaterialColor(parseInt(e.target.value.replace('#', ''), 16))}
          />
        </div>
        <div>
          <label>Wireframe:</label>
          <input type="checkbox" checked={wireframe} onChange={toggleWireframe} />
        </div>
        <div>
          <label>Show Grid:</label>
          <input type="checkbox" checked={showGrid} onChange={toggleGridHelper} />
        </div>
        <div>
          <label>Background Color:</label>
          <input
            type="color"
            value={`#${backgroundColor.toString(16).padStart(6, '0')}`}
            onChange={(e) => setBackgroundColor(parseInt(e.target.value.replace('#', ''), 16))}
          />
        </div>
        <div>
          <label>Model Scale:</label>
          <input type="range" min="0.1" max="10" step="0.1" defaultValue="1" onChange={scaleModel} />
        </div>
        <button onClick={resetCamera}>Reset Camera</button>
      </div>
    </div>
  );
};

export default ThreeDVisualization;

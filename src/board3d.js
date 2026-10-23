import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { themes } from './themes.js';

const point = (square) => new THREE.Vector3(square.charCodeAt(0) - 100.5, .3, 4.5 - Number(square[1]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Board3D {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.active = true;
    this.animations = [];
    this.pieces = new Map();
    this.tiles = [];
    this.markers = new THREE.Group();
    this.labels = new THREE.Group();
    this.theme = themes.atelier;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, .1, 150);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute('aria-label', '3D chessboard. Select a piece, then a destination. Use the Classic view for keyboard play.');
    this.renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); callbacks.onFailure(); });
    container.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = .12;
    this.controls.maxPolarAngle = 1.15;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 39;
    this.controls.rotateSpeed = .55;
    this.controls.zoomSpeed = .6;
    this.scene.add(new THREE.HemisphereLight('#fff6df', '#5b6257', 2.2));
    this.sun = new THREE.DirectionalLight('#fff2d6', 3.2);
    this.sun.position.set(-5, 12, 7);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 35 });
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.normalBias = .035;
    this.sun.shadow.bias = -.00025;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun);
    const rim = new THREE.DirectionalLight('#d9e4f4', 2.2);
    rim.position.set(5, 5, -8);
    this.scene.add(rim);
    this.scene.add(this.markers, this.labels);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.materials = {
      w: new THREE.MeshStandardMaterial({ color: this.theme.ivory, roughness: .3, metalness: .07 }),
      b: new THREE.MeshStandardMaterial({ color: this.theme.ebony, roughness: .29, metalness: .13 }),
      gold: new THREE.MeshStandardMaterial({ color: this.theme.accent, roughness: .34, metalness: .65 }),
      light: new THREE.MeshStandardMaterial({ color: this.theme.light, roughness: .78 }),
      dark: new THREE.MeshStandardMaterial({ color: this.theme.dark, roughness: .72 }),
      frame: new THREE.MeshStandardMaterial({ color: this.theme.frame, roughness: .48, metalness: .04 }),
      ground: new THREE.MeshStandardMaterial({ color: this.theme.ground, roughness: 1 }),
    };
    this.addTextures();
    this.createTable();
    this.setTheme('atelier');
    this.createLabels();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.orient(false);
    this.bindInput();
    this.tick = this.tick.bind(this);
    this.frame = requestAnimationFrame(this.tick);
  }
  mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  addTextures() {
    let seed=27;
    const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#dfd9ca';ctx.fillRect(0,0,512,512);
    for(let i=0;i<2300;i++){
      const y=random()*512;ctx.strokeStyle=`rgba(45,30,12,${random()*.12})`;ctx.lineWidth=.3+random()*.7;
      ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(150,y+random()*8-4,350,y+random()*7-3,512,y);ctx.stroke();
    }
    const wood=new THREE.CanvasTexture(canvas);wood.colorSpace=THREE.SRGBColorSpace;wood.anisotropy=4;
    this.materials.frame.map=wood;this.materials.frame.bumpMap=wood;this.materials.frame.bumpScale=.025;
    const stone=document.createElement('canvas');stone.width=256;stone.height=256;
    const sc=stone.getContext('2d'),pixels=sc.createImageData(256,256);
    for(let i=0;i<pixels.data.length;i+=4){const v=235+Math.floor(random()*20);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;}
    sc.putImageData(pixels,0,0);
    const texture=new THREE.CanvasTexture(stone);texture.colorSpace=THREE.SRGBColorSpace;
    for(const key of ['light','dark']){this.materials[key].map=texture;this.materials[key].bumpMap=texture;this.materials[key].bumpScale=.012;}
  }
  createTable() {
    const { frame, gold, ground } = this.materials;
    this.mesh(new THREE.BoxGeometry(9.08, .32, 9.08), frame, this.scene, 0, -.02);
    this.mesh(new THREE.BoxGeometry(8.94, .025, 8.94), gold, this.scene, 0, .15);
    this.mesh(new THREE.BoxGeometry(8.88, .09, 8.88), frame, this.scene, 0, .2);
    this.mesh(new THREE.BoxGeometry(8.16, .025, 8.16), gold, this.scene, 0, .255);
    const tileGeometry = new THREE.BoxGeometry(.998, .055, .998);
    for (let rank = 1; rank <= 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = `${String.fromCharCode(97 + file)}${rank}`;
        const pos = point(square);
        const tile = this.mesh(tileGeometry, (file + rank) % 2 === 0 ? this.materials.light : this.materials.dark, this.scene, pos.x, .273, pos.z);
        tile.userData.square = square;
        this.tiles.push(tile);
      }
    }
    const floor = this.mesh(new THREE.PlaneGeometry(250, 250), ground, this.scene, 0, -.32);
    floor.rotation.x = -Math.PI / 2;
    floor.castShadow = false;
    // Small inset feet give the table a tangible, floating edge.
    for (const x of [-3.8, 3.8]) for (const z of [-3.8, 3.8]) this.mesh(new THREE.CylinderGeometry(.23, .2, .16, 24), frame, this.scene, x, -.23, z);
  }
  lathe(profile, material, group) {
    return this.mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 48), material, group);
  }
  makePiece(type, color) {
    const group = new THREE.Group();
    const material = this.materials[color];
    const gold = this.materials.gold;
    const sphere = (r, x, y, z, mat = material) => this.mesh(new THREE.SphereGeometry(r, 24, 16), mat, group, x, y, z);
    const ring = (r, tube, y) => { const m = this.mesh(new THREE.TorusGeometry(r, tube, 10, 48), gold, group, 0, y); m.rotation.x = Math.PI / 2; };
    this.lathe([[0,0],[.27,0],[.31,.035],[.325,.08],[.32,.13],[.29,.17],[.25,.19],[.24,.23],[.26,.26],[.24,.3],[0,.3]], material, group);
    ring(.302,.013,.15);
    const heights = { p:.66, r:.85, n:.58, b:.97, q:1.04, k:1.08 };
    const h = heights[type];
    this.lathe([[0,.27],[.235,.27],[.21,.32],[.17,.4],[.13,h-.13],[.16,h-.04],[.22,h],[.23,h+.04],[.19,h+.08],[0,h+.08]], material, group);
    if (type === 'p') sphere(.195,0,.89,0);
    if (type === 'r') {
      this.lathe([[0,.87],[.24,.87],[.27,.93],[.27,1.1],[.18,1.1],[.18,.98],[0,.98]], material, group);
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const tooth = this.mesh(new THREE.BoxGeometry(.14,.17,.13), material, group, Math.sin(angle)*.215,1.14,Math.cos(angle)*.215);
        tooth.rotation.y = angle;
      }
    }
    if (type === 'b') {
      this.lathe([[0,1.02],[.12,1.04],[.2,1.13],[.17,1.27],[.1,1.39],[0,1.47]],material,group);
      sphere(.052,0,1.48,0,gold);
      // The inset mitre slash, visible from either side.
      const slashMat = color === 'w' ? this.materials.frame : gold;
      for (const side of [-1,1]) { const slit = this.mesh(new THREE.BoxGeometry(.027,.2,.008),slashMat,group,0,1.25,side*.151); slit.rotation.z=-.43; }
    }
    if (type === 'q') {
      this.lathe([[0,1.08],[.14,1.08],[.19,1.2],[.27,1.36],[.26,1.41],[.16,1.36],[.1,1.24],[0,1.24]],material,group);
      for (let i=0;i<8;i++) { const a=i*Math.PI/4; sphere(.042,Math.sin(a)*.242,1.42,Math.cos(a)*.242,gold); }
      sphere(.07,0,1.4,0);
    }
    if (type === 'k') {
      this.lathe([[0,1.12],[.18,1.12],[.24,1.2],[.22,1.29],[.1,1.36],[0,1.36]],material,group);
      this.mesh(new THREE.BoxGeometry(.095,.37,.095),material,group,0,1.5);
      this.mesh(new THREE.BoxGeometry(.31,.09,.095),material,group,0,1.55);
      ring(.2,.016,1.2);
    }
    if (type === 'n') {
      const shape = new THREE.Shape();
      shape.moveTo(-.22,.62); shape.bezierCurveTo(-.28,.9,-.19,1.25,.02,1.34);
      shape.lineTo(.08,1.49);shape.lineTo(.16,1.35);shape.lineTo(.29,1.27);shape.lineTo(.38,1.04);
      shape.quadraticCurveTo(.29,.96,.18,1.02);shape.lineTo(.06,1.12);shape.quadraticCurveTo(.12,.85,.23,.66);shape.closePath();
      const head = this.mesh(new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:true,bevelThickness:.045,bevelSize:.035,bevelSegments:3,steps:1,curveSegments:16}),material,group,0,0,-.09);
      head.castShadow = true;
      for (const side of [-1,1]) sphere(.025,.15,1.25,side*.142,gold);
      group.rotation.y = color === 'w' ? Math.PI/2 : -Math.PI/2;
    }
    group.userData = { type, color };
    return group;
  }
  createLabels() {
    this.labels.clear();
    for (let i = 0; i < 8; i++) {
      this.label(String.fromCharCode(65+i), i-3.5,4.27,0);
      this.label(String.fromCharCode(65+i), i-3.5,-4.27,Math.PI);
      this.label(String(i+1),-4.27,3.5-i,0);
      this.label(String(i+1),4.27,3.5-i,Math.PI);
    }
  }
  label(text, x, z, angle) {
    const canvas = document.createElement('canvas');canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle=this.theme.accent;ctx.font='500 54px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,64,66);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.19,.19),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
    mesh.rotation.set(-Math.PI/2,0,angle);mesh.position.set(x,.251,z);this.labels.add(mesh);
  }
  setTheme(name) {
    this.theme=themes[name];
    for (const [name,material] of Object.entries(this.materials)) material.color.set(this.theme[{w:'ivory',b:'ebony',gold:'accent'}[name]||name]);
    this.scene.fog=new THREE.Fog(this.theme.fog,32,75);
    this.renderer.setClearColor(this.theme.fog,0);
    if (this.labels.children.length) {
      this.labels.children.forEach(m=>{m.geometry.dispose();m.material.map.dispose();m.material.dispose();});
      this.createLabels();
    }
  }
  resize() {
    const {width,height}=this.container.getBoundingClientRect();
    if(!width||!height)return;
    this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);
    if(!this.lastAspect || Math.abs(this.lastAspect-this.camera.aspect)>.15) this.orient(this.flipped);
    this.lastAspect=this.camera.aspect;
  }
  orient(flipped) {
    this.flipped=flipped;
    const narrow=this.camera.aspect<.8;
    const factor=Math.max(1,(narrow?1:1.12)/this.camera.aspect);
    this.camera.position.set((flipped?-1:1)*(narrow?2.2:7.3)*factor,(narrow?16.8:12.8)*factor,(flipped?-1:1)*(narrow?11:15)*factor);
    this.controls.maxDistance=40*factor;
    this.controls.target.set(0,.1,0);
    this.controls.update();
    this.updateFog();
  }
  updateFog() {if(this.scene.fog){const distance=this.camera.position.length();this.scene.fog.near=distance+12;this.scene.fog.far=distance+65;}}
  setActive(active) { this.active=active; if(active)this.resize(); }
  update({chess, selected, legal, lastMove, hints, coordinates}, move) {
    this.finishAnimations();
    this.labels.visible=coordinates;
    if(move) {
      const from=this.pieces.get(move.from);
      if(from && from.userData.type===chess.get(move.to)?.type) {
        const captureSquare=move.flags.includes('e')?`${move.to[0]}${move.from[1]}`:move.to;
        this.removePiece(captureSquare);
        this.pieces.delete(move.from);this.pieces.set(move.to,from);from.userData.square=move.to;
        this.animate(from,point(move.to));
        if(move.flags.includes('k')||move.flags.includes('q')) {
          const rank=move.from[1],rookFrom=`${move.flags.includes('k')?'h':'a'}${rank}`,rookTo=`${move.flags.includes('k')?'f':'d'}${rank}`;
          const rook=this.pieces.get(rookFrom);
          if(rook){this.pieces.delete(rookFrom);this.pieces.set(rookTo,rook);rook.userData.square=rookTo;this.animate(rook,point(rookTo));}
        }
      }
    }
    const occupied=new Set();
    for(const row of chess.board()) for(const piece of row) if(piece) {
      occupied.add(piece.square);
      let mesh=this.pieces.get(piece.square);
      if(mesh&&(mesh.userData.type!==piece.type||mesh.userData.color!==piece.color)){this.removePiece(piece.square);mesh=null;}
      if(!mesh){mesh=this.makePiece(piece.type,piece.color);mesh.position.copy(point(piece.square));mesh.userData.square=piece.square;this.pieces.set(piece.square,mesh);this.scene.add(mesh);}
      if(!this.animations.some(a=>a.object===mesh))mesh.position.y=.3+(selected===piece.square ? .065 : 0);
    }
    for(const square of this.pieces.keys())if(!occupied.has(square))this.removePiece(square);
    this.markers.children.forEach(mesh=>{mesh.geometry.dispose();mesh.material.dispose();});this.markers.clear();
    if(lastMove)for(const square of [lastMove.from,lastMove.to])this.marker(square,'tile',this.theme.accent,.24);
    if(selected)this.marker(selected,'tile',this.theme.accent,.54);
    if(hints)for(const move of legal)this.marker(move.to,chess.get(move.to)?'ring':'dot',this.theme.accent,.85);
    if(chess.isCheck()){
      const king=chess.board().flat().find(p=>p?.type==='k'&&p.color===chess.turn());
      if(king)this.marker(king.square,'tile','#c74e49',.5);
    }
  }
  marker(square,kind,color,opacity) {
    const geo=kind==='tile'?new THREE.PlaneGeometry(.97,.97):kind==='dot'?new THREE.CircleGeometry(.105,32):new THREE.RingGeometry(.37,.43,48);
    const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
    mesh.rotation.x=-Math.PI/2;mesh.position.copy(point(square));mesh.position.y=.306+(kind==='tile'?0:.003);this.markers.add(mesh);
  }
  removePiece(square) {
    const mesh=this.pieces.get(square);if(!mesh)return;
    this.scene.remove(mesh);mesh.traverse(child=>child.geometry?.dispose());this.pieces.delete(square);
  }
  animate(object,to) { if(reducedMotion){object.position.copy(to);return;}this.animations.push({object,from:object.position.clone(),to,start:performance.now()}); }
  finishAnimations() {this.animations.forEach(a=>a.object.position.copy(a.to));this.animations=[];}
  pick(event) {
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const hits=this.raycaster.intersectObjects([...this.pieces.values(),...this.tiles],true);
    for(const hit of hits){let obj=hit.object;while(obj){if(obj.userData.square)return obj.userData.square;obj=obj.parent;}}
    return null;
  }
  groundPoint(event) {
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.65),new THREE.Vector3());
  }
  bindInput() {
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      const square=this.pick(event);
      this.down={x:event.clientX,y:event.clientY,square};
      if(square&&this.callbacks.canDrag(square)){
        this.controls.enabled=false;
        this.drag={square,mesh:this.pieces.get(square),origin:this.pieces.get(square).position.clone(),moved:false};
        canvas.setPointerCapture(event.pointerId);
      }
    },{capture:true});
    canvas.addEventListener('pointermove',event=>{
      if(this.drag&&this.down){
        if(Math.hypot(event.clientX-this.down.x,event.clientY-this.down.y)>6)this.drag.moved=true;
        if(this.drag.moved){const p=this.groundPoint(event);if(p){this.drag.mesh.position.copy(p);this.drag.mesh.position.y=.65;}}
      } else canvas.style.cursor=this.pick(event)?'pointer':'grab';
    });
    canvas.addEventListener('pointerup',event=>{
      if(event.button!==0)return;
      const down=this.down;this.down=null;
      if(this.drag){
        const drag=this.drag;this.drag=null;
        drag.mesh.position.copy(drag.origin);
        // Pick the destination after restoring the lifted mesh, so it cannot intercept the ray.
        const to=this.pick(event);this.controls.enabled=true;
        if(drag.moved){if(to)this.callbacks.onDrop(drag.square,to);}else this.callbacks.onSquare(drag.square);
      }else if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<7){const square=this.pick(event);if(square)this.callbacks.onSquare(square);}
    });
    canvas.addEventListener('pointercancel',()=>{if(this.drag)this.drag.mesh.position.copy(this.drag.origin);this.drag=null;this.down=null;this.controls.enabled=true;});
  }
  tick(time) {
    this.frame=requestAnimationFrame(this.tick);
    if(!this.active||document.hidden)return;
    this.controls.update();
    this.updateFog();
    this.animations=this.animations.filter(a=>{const t=Math.min(1,(time-a.start)/300),e=1-(1-t)**3;a.object.position.lerpVectors(a.from,a.to,e);a.object.position.y+=Math.sin(Math.PI*t)*.3;return t<1;});
    this.renderer.render(this.scene,this.camera);
  }
}

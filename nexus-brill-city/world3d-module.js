import * as THREE from './vendor/three.module.js';
const host=document.querySelector('.opening');
if(host && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
try{
const mobile=innerWidth<720;
const renderer=new THREE.WebGLRenderer({antialias:!mobile,alpha:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.2:1.6));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.25;
renderer.domElement.className='world3d';
renderer.domElement.setAttribute('aria-hidden','true');
host.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#101722');scene.fog=new THREE.FogExp2('#17212b',.017);
const camera=new THREE.PerspectiveCamera(54,1,.1,300);
camera.position.set(13,9,35);camera.lookAt(0,7,-16);
scene.add(new THREE.HemisphereLight(0x9baed4,0x20151c,2.15));
const moon=new THREE.DirectionalLight(0xb4c4ff,2.3);moon.position.set(-22,55,-45);scene.add(moon);
const orange=new THREE.PointLight(0xff9c55,85,90,2);orange.position.set(0,11,-12);scene.add(orange);
const mat=(color,roughness=1,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const asphalt=mat('#181b22'),sidewalk=mat('#414047'),towerMats=['#252d37','#30323a','#37333b','#2c303a','#3b3941'].map(c=>mat(c,.9));
const glass=new THREE.MeshStandardMaterial({color:'#52647b',metalness:.45,roughness:.22,emissive:'#17232d',emissiveIntensity:.35});
const gold=new THREE.MeshBasicMaterial({color:0xffc17b}),red=new THREE.MeshBasicMaterial({color:0xe94c43}),white=new THREE.MeshBasicMaterial({color:0xe8e2cb});
function box(w,h,depth,m,x,y,z){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,depth),m);mesh.position.set(x,y,z);scene.add(mesh);return mesh}
box(170,.2,260,asphalt,0,-.1,-45);
for(let x of [-11.8,11.8])box(5,.23,260,sidewalk,x,.04,-45);
let seed=9234;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
const windows=new THREE.InstancedMesh(new THREE.PlaneGeometry(.44,.65),new THREE.MeshBasicMaterial({color:0xffc993,side:THREE.DoubleSide,transparent:true,opacity:.68}),mobile?1100:2700);let n=0;const dummy=new THREE.Object3D();
for(let row=0;row<14;row++){const z=20-row*11.3;for(const side of [-1,1]){for(let lane=0;lane<2;lane++){const w=4.4+rnd()*3.8,dep=5+rnd()*5.5,h=9+rnd()*39+row*.45,x=side*(15.7+lane*8.6+rnd()*2);const m=box(w,h,dep,towerMats[Math.floor(rnd()*towerMats.length)],x,h/2,z);
if(row<10){for(let floor=1;floor<Math.floor(h/2.6);floor++){for(let col=0;col<Math.floor(w/1.2);col++){if(rnd()>.45||n>=windows.count)continue;dummy.position.set(x-w/2+.8+col*1.2,floor*2.6,z+dep/2+.012);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();windows.setMatrixAt(n++,dummy.matrix)}}}
if(rnd()>.55)box(w*.8,.22,dep*.8,glass,x,h+.12,z);
}}}
windows.count=n;windows.instanceMatrix.needsUpdate=true;scene.add(windows);
for(let z=-140;z<50;z+=11){box(.14,.03,4.4,white,0,.03,z);for(const side of [-1,1]){const x=side*9.6;box(.18,6,.18,mat('#72716d'),x,3,z);box(2.2,.12,.3,mat('#8b8a82'),x-side*1.1,6,z);const lamp=new THREE.PointLight(0xffad65,12,13,2);lamp.position.set(x-side*2,5.9,z);scene.add(lamp);const bulb=new THREE.Mesh(new THREE.SphereGeometry(.18,6,5),gold);bulb.position.copy(lamp.position);scene.add(bulb)}}
function car(color,x,z,speed){const group=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(2.15,.65,4.5),mat(color,.4,.4));body.position.y=.85;group.add(body);const roof=new THREE.Mesh(new THREE.BoxGeometry(1.75,.6,2.2),glass);roof.position.set(0,1.4,-.25);group.add(roof);for(const xx of [-1,1])for(const zz of [-1.45,1.45]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,.26,12),mat('#111115'));wheel.rotation.z=Math.PI/2;wheel.position.set(xx*1.05,.44,zz);group.add(wheel)}for(const xx of [-.72,.72]){const tail=new THREE.Mesh(new THREE.BoxGeometry(.45,.17,.06),red);tail.position.set(xx,.95,2.29);group.add(tail)}group.position.set(x,0,z);scene.add(group);return {group,speed,start:z}}
const cars=[car('#292c33',-3.1,-16,.016),car('#751d26',3.3,-40,.021),car('#c2c0b6',-3.1,-76,.019),car('#292b30',3.3,-115,.015)];
const skyline=new THREE.Mesh(new THREE.SphereGeometry(5,24,16),new THREE.MeshBasicMaterial({color:0xffc18a}));skyline.position.set(-36,49,-165);scene.add(skyline);
let mx=0,my=0,last=0,visible=true;const pointer=e=>{mx=(e.clientX/innerWidth-.5);my=(e.clientY/innerHeight-.5)};window.addEventListener('pointermove',pointer,{passive:true});
function resize(){const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.fov=r.width<720?69:54;camera.updateProjectionMatrix()}resize();window.addEventListener('resize',resize,{passive:true});
const clock=new THREE.Clock();
function frame(t){if(!visible)return;const delta=Math.min(clock.getDelta(),.05);const drift=t*.00013;camera.position.x=13+Math.sin(drift)*1.25+mx*1.4;camera.position.y=9+Math.sin(drift*.7)*.35-my*.5;camera.lookAt(-.5,6,-18);for(const c of cars){c.group.position.z+=delta*c.speed*55;if(c.group.position.z>43)c.group.position.z=-145}renderer.render(scene,camera);requestAnimationFrame(frame)}
const io=new IntersectionObserver(entries=>{const show=entries[0].isIntersecting&&!document.hidden;if(show&&!visible){visible=true;clock.getDelta();requestAnimationFrame(frame)}else if(!show)visible=false},{threshold:.01});io.observe(host);document.addEventListener('visibilitychange',()=>{if(document.hidden)visible=false;else if(host.getBoundingClientRect().bottom>0){visible=true;clock.getDelta();requestAnimationFrame(frame)}});
requestAnimationFrame(frame);
}catch(err){console.warn('3D fallback enabled',err);host.classList.add('world3d-fallback')}
}
#!/usr/bin/env python3
"""VOXI UI Sketch Gallery — serves rendered previews of all .voxi files."""

import http.server
import json
import os
import webbrowser
from pathlib import Path

PROJECTS_DIR = Path.home() / ".voxi-studio" / "projects"
PORT = 8080


def scan_projects():
    """Scan projects dir and return list of {project, variation, code}."""
    sketches = []
    if not PROJECTS_DIR.is_dir():
        return sketches

    for proj_dir in sorted(PROJECTS_DIR.iterdir()):
        if not proj_dir.is_dir():
            continue

        project_name = proj_dir.name
        description = ""
        meta_path = proj_dir / "meta.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text())
                description = meta.get("description", "")
            except (json.JSONDecodeError, OSError):
                pass

        for voxi_file in sorted(proj_dir.glob("*.voxi")):
            try:
                code = voxi_file.read_text()
            except OSError:
                continue
            sketches.append({
                "project": project_name,
                "variation": voxi_file.stem,
                "description": description,
                "code": code,
            })

    return sketches


def build_html(sketches):
    """Build the full HTML page with embedded renderer and sketch data."""
    sketches_json = json.dumps(sketches)
    return HTML_TEMPLATE.replace("__SKETCHES_JSON__", sketches_json)


HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VOXI Gallery</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:#0f1117;color:#e0e0e8;min-height:100vh;padding:24px}
.header{text-align:center;margin-bottom:32px}
.header h1{font-size:28px;font-weight:700;margin-bottom:6px}
.header h1 .accent{color:#6c8cff}
.header .count{font-size:14px;color:#8888a0}
.section-title{font-size:18px;font-weight:600;color:#6c8cff;margin:28px 0 14px;padding-bottom:8px;border-bottom:1px solid #2d3244}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:20px;margin-bottom:20px}
.card{background:#1a1d27;border:1px solid #2d3244;border-radius:10px;overflow:hidden;cursor:pointer;transition:border-color .2s,transform .15s}
.card:hover{border-color:#6c8cff;transform:translateY(-2px)}
.card-title{padding:10px 14px;font-size:13px;font-weight:600;color:#ccc;background:#232733;border-bottom:1px solid #2d3244}
.card-title .var-name{color:#6c8cff;margin-left:6px;font-weight:400}
.card-canvas-wrap{display:flex;align-items:center;justify-content:center;padding:12px;background:#13151f;min-height:200px}
.card-canvas-wrap canvas{display:block;max-width:100%;border-radius:4px}
.modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:1000;align-items:center;justify-content:center;padding:20px}
.modal-overlay.active{display:flex}
.modal-content{position:relative;max-width:95vw;max-height:95vh;overflow:auto}
.modal-content canvas{display:block}
.modal-close{position:fixed;top:16px;right:24px;font-size:28px;color:#fff;cursor:pointer;z-index:1001;background:#1a1d27;border:1px solid #2d3244;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center}
.modal-close:hover{border-color:#6c8cff}
</style>
</head>
<body>

<div class="header">
  <h1>VOXI <span class="accent">Gallery</span></h1>
  <div class="count" id="count"></div>
</div>
<div id="gallery"></div>

<div class="modal-overlay" id="modal">
  <div class="modal-close" id="modal-close">&times;</div>
  <div class="modal-content" id="modal-content"></div>
</div>

<script>
// ── VOXI 3D Engine ─────────────────────────────────────────────────
const VOXI_COLORS=[0x111111,0xe53935,0x43a047,0x1e88e5,0x00bcd4,0xab47bc,0xfdd835,0xff9800,0xeeeeee,0x9e9e9e,0x8d6e4a,0xff9eb5,0x2e7d32,0xd4b896,0x8b1a1a,0x1a3a6b];
const VOXI_CKEYS='0123456789abcdef';

function parseVoxi(code){
  let W=32,H=32,D=32;const vm=new Map();
  const set=(x,y,z,c)=>{const ix=Math.round(x),iy=Math.round(y),iz=Math.round(z);if(ix>=0&&ix<W&&iy>=0&&iy<H&&iz>=0&&iz<D)vm.set(`${ix},${iy},${iz}`,Math.min(Math.max(c||9,0),15));};
  const addBox=(px,py,pz,w,h,d,c)=>{for(let x=px;x<px+w;x++)for(let y=py;y<py+h;y++)for(let z=pz;z<pz+d;z++)set(x,y,z,c);};
  const addSphere=(cx,cy,cz,r,c)=>{const r2=r*r;for(let x=cx-r;x<=cx+r;x++)for(let y=cy-r;y<=cy+r;y++)for(let z=cz-r;z<=cz+r;z++)if((x-cx)**2+(y-cy)**2+(z-cz)**2<=r2)set(x,y,z,c);};
  const addCyl=(cx,cy,cz,r,h,c)=>{const r2=r*r;for(let x=cx-r;x<=cx+r;x++)for(let z=cz-r;z<=cz+r;z++)if((x-cx)**2+(z-cz)**2<=r2)for(let y=cy;y<cy+h;y++)set(x,y,z,c);};
  const addCone=(cx,cy,cz,r,h,c)=>{for(let y=0;y<h;y++){const rr=r*(1-y/h),rr2=rr*rr;for(let x=cx-r;x<=cx+r;x++)for(let z=cz-r;z<=cz+r;z++)if((x-cx)**2+(z-cz)**2<=rr2)set(cx+(x-cx),cy+y,cz+(z-cz),c);}};
  const addEllipsoid=(cx,cy,cz,rx,ry,rz,c)=>{for(let x=cx-rx;x<=cx+rx;x++)for(let y=cy-ry;y<=cy+ry;y++)for(let z=cz-rz;z<=cz+rz;z++)if(((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2<=1)set(x,y,z,c);};
  const addDome=(px,py,pz,w,h,d,c)=>{const rx=w/2,ry=h,rz=d/2,cx2=px+rx,cz2=pz+rz;for(let x=px;x<px+w;x++)for(let y=py;y<py+h;y++)for(let z=pz;z<pz+d;z++)if(((x-cx2+.5)/rx)**2+((y-py)/ry)**2+((z-cz2+.5)/rz)**2<=1)set(x,y,z,c);};
  const groups={};let currentGroup=null,currentGroupName=null,scale=1;
  function sc(cmd,n){if(scale===1)return n;const s=[...n];switch(cmd){case'B':case'D':s[0]=Math.round(s[0]*scale);s[1]=Math.round(s[1]*scale);s[2]=Math.round(s[2]*scale);s[3]=Math.max(1,Math.round(s[3]*scale));s[4]=Math.max(1,Math.round(s[4]*scale));s[5]=Math.max(1,Math.round(s[5]*scale));break;case'S':s[0]=Math.round(s[0]*scale);s[1]=Math.round(s[1]*scale);s[2]=Math.round(s[2]*scale);s[3]=Math.max(1,Math.round(s[3]*scale));break;case'C':case'K':s[0]=Math.round(s[0]*scale);s[1]=Math.round(s[1]*scale);s[2]=Math.round(s[2]*scale);s[3]=Math.max(1,Math.round(s[3]*scale));s[4]=Math.max(1,Math.round(s[4]*scale));break;case'P':s[0]=Math.round(s[0]*scale);s[1]=Math.round(s[1]*scale);s[2]=Math.round(s[2]*scale);break;case'E':s[0]=Math.round(s[0]*scale);s[1]=Math.round(s[1]*scale);s[2]=Math.round(s[2]*scale);s[3]=Math.max(1,Math.round(s[3]*scale));s[4]=Math.max(1,Math.round(s[4]*scale));s[5]=Math.max(1,Math.round(s[5]*scale));break;}return s;}
  function execCmd(cmd,n){const sn=sc(cmd,n);switch(cmd){case'B':addBox(sn[0],sn[1],sn[2],sn[3],sn[4],sn[5],sn[6]);break;case'S':addSphere(sn[0],sn[1],sn[2],sn[3],sn[4]);break;case'C':addCyl(sn[0],sn[1],sn[2],sn[3],sn[4],sn[5]);break;case'K':addCone(sn[0],sn[1],sn[2],sn[3],sn[4],sn[5]);break;case'P':set(sn[0],sn[1],sn[2],sn[3]);break;case'E':addEllipsoid(sn[0],sn[1],sn[2],sn[3],sn[4],sn[5],sn[6]);break;case'D':addDome(sn[0],sn[1],sn[2],sn[3],sn[4],sn[5],sn[6]);break;default:return false;}return true;}
  function placeGroup(name,ox,oy,oz){const g=groups[name];if(!g)return;const sox=Math.round(ox*scale),soy=Math.round(oy*scale),soz=Math.round(oz*scale);for(const entry of g){const sn=sc(entry.cmd,entry.args);sn[0]+=sox;sn[1]+=soy;sn[2]+=soz;execCmd(entry.cmd,sn);}}
  const allLines=code.split('\n');
  for(let i=0;i<allLines.length;i++){const line=allLines[i].trim();if(!line||line.startsWith('--')||line.startsWith('//'))continue;const p=line.split(/\s+/);const cmd=p[0].toUpperCase();
    if(cmd==='G'){currentGroupName=p[1]||`g${i}`;currentGroup=[];continue;}
    if(cmd==='/G'){if(currentGroup&&currentGroupName)groups[currentGroupName]=currentGroup;currentGroup=null;currentGroupName=null;continue;}
    if(cmd==='@'){placeGroup(p[1],Number(p[2])||0,Number(p[3])||0,Number(p[4])||0);continue;}
    if(cmd==='V'){W=Number(p[1])||32;H=Number(p[2])||32;D=Number(p[3])||32;continue;}
    if(cmd==='R'){scale=Number(p[1])||1;continue;}
    const parseArg=(s,isColor)=>{if(isColor&&/^[a-f]$/i.test(s))return VOXI_CKEYS.indexOf(s.toLowerCase());return Number(s);};
    const rawArgs=p.slice(1);const n=rawArgs.map((s,idx)=>parseArg(s,idx===rawArgs.length-1));
    execCmd(cmd,n);if(currentGroup)currentGroup.push({cmd,args:n});}
  return{W,H,D,vm};
}

function renderVoxiRotated(voxiCode,outW,outH,yaw,pitch){
  const{W,H,D,vm}=parseVoxi(voxiCode);if(vm.size===0)return null;
  const yr=yaw*Math.PI/180,pr=pitch*Math.PI/180;
  const cosY=Math.cos(yr),sinY=Math.sin(yr),cosP=Math.cos(pr),sinP=Math.sin(pr);
  const cx=W/2,cy=H/2,cz=D/2;
  function rotate(x,y,z){let dx=x-cx,dy=y-cy,dz=z-cz;const rx=dx*cosY+dz*sinY;const rz=-dx*sinY+dz*cosY;dx=rx;dz=rz;const ry=dy*cosP-dz*sinP;const rz2=dy*sinP+dz*cosP;return[dx,ry,rz2];}
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const corner of[[0,0,0],[W,0,0],[0,H,0],[0,0,D],[W,H,0],[W,0,D],[0,H,D],[W,H,D]]){const[rx,ry,rz]=rotate(corner[0],corner[1],corner[2]);minX=Math.min(minX,rx);maxX=Math.max(maxX,rx);minY=Math.min(minY,ry);maxY=Math.max(maxY,ry);minZ=Math.min(minZ,rz);maxZ=Math.max(maxZ,rz);}
  const sceneW=maxX-minX||1,sceneH=maxY-minY||1;const scaleF=Math.min(outW/sceneW,outH/sceneH)*0.92;
  const zbuf=new Float32Array(outW*outH).fill(Infinity);const colorBuf=new Int8Array(outW*outH).fill(-1);const depthBuf=new Float32Array(outW*outH).fill(0);
  for(const[k,c]of vm){const[vx,vy,vz]=k.split(',').map(Number);const[rx,ry,rz]=rotate(vx+0.5,vy+0.5,vz+0.5);
    const sx=Math.round((rx-minX)*scaleF+(outW-sceneW*scaleF)/2);const sy=Math.round((maxY-ry)*scaleF+(outH-sceneH*scaleF)/2);
    const voxSize=Math.max(1,Math.round(scaleF));
    for(let dy=0;dy<voxSize;dy++)for(let dx=0;dx<voxSize;dx++){const px=sx+dx,py=sy+dy;if(px<0||px>=outW||py<0||py>=outH)continue;const idx=py*outW+px;if(rz<zbuf[idx]){zbuf[idx]=rz;colorBuf[idx]=c;depthBuf[idx]=(rz-minZ)/(maxZ-minZ||1);}}}
  return{colorBuf,depthBuf,width:outW,height:outH,voxelCount:vm.size};
}

// ── UI Parser ──────────────────────────────────────────────────────
function parseUI(code){
  let canvasW=1440,canvasH=900,canvasBg='#1a1a1a';const elements=[];
  const lines=code.split('\n');
  for(let i=0;i<lines.length;i++){const raw=lines[i];const trimmed=raw.trim();
    if(!trimmed||trimmed.startsWith('--')||trimmed.startsWith('//'))continue;
    const tokens=[];let j=0;
    while(j<trimmed.length){if(trimmed[j]===' '||trimmed[j]==='\t'){j++;continue;}
      if(trimmed[j]==='"'){const end=trimmed.indexOf('"',j+1);if(end===-1){tokens.push(trimmed.slice(j+1));j=trimmed.length;}else{tokens.push(trimmed.slice(j+1,end));j=end+1;}}
      else{const end=trimmed.indexOf(' ',j);if(end===-1){tokens.push(trimmed.slice(j));j=trimmed.length;}else{tokens.push(trimmed.slice(j,end));j=end+1;}}}
    const cmd=tokens[0].toUpperCase();
    if(cmd==='CANVAS'||cmd==='C'){canvasW=Number(tokens[1])||1440;canvasH=Number(tokens[2])||900;canvasBg=tokens[3]||'#1a1a1a';continue;}
    if(cmd==='RECT'||cmd==='R'){elements.push({type:'rect',line:i,x:Number(tokens[1])||0,y:Number(tokens[2])||0,w:Number(tokens[3])||100,h:Number(tokens[4])||50,z:Number(tokens[5])||0,color:tokens[6]||'#888',radius:Number(tokens[7])||0});}
    else if(cmd==='TEXT'||cmd==='T'){elements.push({type:'text',line:i,x:Number(tokens[1])||0,y:Number(tokens[2])||0,content:tokens[3]||'',size:Number(tokens[4])||16,z:Number(tokens[5])||0,color:tokens[6]||'#fff',weight:(tokens[7]||'normal').toLowerCase()});}
    else if(cmd==='IMG'||cmd==='I'){elements.push({type:'img',line:i,x:Number(tokens[1])||0,y:Number(tokens[2])||0,w:Number(tokens[3])||200,h:Number(tokens[4])||150,z:Number(tokens[5])||0,label:tokens[6]||'image'});}
    else if(cmd==='LINE'||cmd==='L'){elements.push({type:'line',line:i,x1:Number(tokens[1])||0,y1:Number(tokens[2])||0,x2:Number(tokens[3])||100,y2:Number(tokens[4])||0,z:Number(tokens[5])||0,color:tokens[6]||'#fff',width:Number(tokens[7])||1});}
    else if(cmd==='ELLIPSE'||cmd==='E'){elements.push({type:'ellipse',line:i,cx:Number(tokens[1])||0,cy:Number(tokens[2])||0,rx:Number(tokens[3])||50,ry:Number(tokens[4])||50,z:Number(tokens[5])||0,color:tokens[6]||'#888'});}
    else if(cmd==='VOXI'){const vx=Number(tokens[1])||0,vy=Number(tokens[2])||0,vw=Number(tokens[3])||200,vh=Number(tokens[4])||200,vz=Number(tokens[5])||0,vyaw=Number(tokens[6])||35,vpitch=Number(tokens[7])||25;
      const voxiLines=[];const startLine=i;i++;while(i<lines.length){const vl=lines[i].trim();if(vl.toUpperCase()==='/VOXI')break;voxiLines.push(lines[i]);i++;}
      elements.push({type:'voxi',line:startLine,x:vx,y:vy,w:vw,h:vh,z:vz,yaw:vyaw,pitch:vpitch,voxiCode:voxiLines.join('\n'),_cachedRender:null});}}
  elements.sort((a,b)=>a.z-b.z);
  return{canvasW,canvasH,canvasBg,elements};
}

// ── Renderer ───────────────────────────────────────────────────────
function drawElement(ctx,el,mode,maxZ){
  const z01=maxZ<=0?0:el.z/maxZ;
  function getColor(){if(mode==='depth'){const v=Math.round(40+215*z01);return`rgb(${v},${v},${v})`;}if(mode==='shaded'){const shade=0.3+0.7*z01;return shadeColor(el.color||'#888',shade);}return el.color||'#888';}
  ctx.save();
  switch(el.type){
    case'rect':{const c=getColor();ctx.fillStyle=c;if(el.radius>0){roundRect(ctx,el.x,el.y,el.w,el.h,el.radius);ctx.fill();}else{ctx.fillRect(el.x,el.y,el.w,el.h);}break;}
    case'text':{const c=mode==='depth'?getColor():el.color||'#fff';const weight=el.weight==='bold'?'bold ':'';ctx.font=`${weight}${el.size}px -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif`;ctx.fillStyle=c;ctx.textBaseline='top';ctx.fillText(el.content,el.x,el.y);break;}
    case'img':{const c=mode==='depth'?getColor():'#2a2a2a';ctx.fillStyle=c;ctx.fillRect(el.x,el.y,el.w,el.h);ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;ctx.strokeRect(el.x,el.y,el.w,el.h);ctx.beginPath();ctx.moveTo(el.x,el.y);ctx.lineTo(el.x+el.w,el.y+el.h);ctx.moveTo(el.x+el.w,el.y);ctx.lineTo(el.x,el.y+el.h);ctx.stroke();ctx.font='12px -apple-system,sans-serif';ctx.fillStyle='rgba(255,255,255,0.4)';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(el.label||'image',el.x+el.w/2,el.y+el.h/2);ctx.textAlign='start';break;}
    case'line':{const c=mode==='depth'?getColor():el.color;ctx.strokeStyle=c;ctx.lineWidth=el.width||1;ctx.beginPath();ctx.moveTo(el.x1,el.y1);ctx.lineTo(el.x2,el.y2);ctx.stroke();break;}
    case'ellipse':{const c=getColor();ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(el.cx,el.cy,el.rx,el.ry,0,0,Math.PI*2);ctx.fill();break;}
    case'voxi':{if(!el._cachedRender){el._cachedRender=renderVoxiRotated(el.voxiCode,el.w,el.h,el.yaw,el.pitch);}
      const vr=el._cachedRender;if(!vr)break;
      const imgData=ctx.createImageData(vr.width,vr.height);const d=imgData.data;
      for(let pi=0;pi<vr.width*vr.height;pi++){const ci=vr.colorBuf[pi];if(ci<0)continue;const hex=VOXI_COLORS[ci];const r=(hex>>16)&0xff,g=(hex>>8)&0xff,b=hex&0xff;const idx=pi*4;d[idx]=r;d[idx+1]=g;d[idx+2]=b;d[idx+3]=255;}
      const offCanvas=document.createElement('canvas');offCanvas.width=vr.width;offCanvas.height=vr.height;offCanvas.getContext('2d').putImageData(imgData,0,0);ctx.drawImage(offCanvas,el.x,el.y);break;}}
  ctx.restore();
}

function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

function shadeColor(hex,factor){let r,g,b;if(hex.startsWith('#')){const h=hex.slice(1);if(h.length===3){r=parseInt(h[0]+h[0],16);g=parseInt(h[1]+h[1],16);b=parseInt(h[2]+h[2],16);}else{r=parseInt(h.slice(0,2),16);g=parseInt(h.slice(2,4),16);b=parseInt(h.slice(4,6),16);}}else{r=g=b=128;}r=Math.round(r*factor);g=Math.round(g*factor);b=Math.round(b*factor);return`rgb(${r},${g},${b})`;}

// ── Gallery Logic ──────────────────────────────────────────────────
const SKETCHES = __SKETCHES_JSON__;

function renderSketch(canvas, code) {
  const {canvasW, canvasH, canvasBg, elements} = parseUI(code);
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = canvasBg;
  ctx.fillRect(0, 0, canvasW, canvasH);
  const maxZ = elements.reduce((m, e) => Math.max(m, e.z), 0);
  for (const el of elements) drawElement(ctx, el, 'flat', maxZ);
}

function buildGallery() {
  document.getElementById('count').textContent = SKETCHES.length + ' sketches';
  const gallery = document.getElementById('gallery');
  const byProject = {};
  for (const s of SKETCHES) {
    if (!byProject[s.project]) byProject[s.project] = [];
    byProject[s.project].push(s);
  }

  for (const [project, items] of Object.entries(byProject)) {
    const section = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = project;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'grid';

    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'card';

      const cardTitle = document.createElement('div');
      cardTitle.className = 'card-title';
      cardTitle.innerHTML = project + '<span class="var-name">' + item.variation + '</span>';

      const wrap = document.createElement('div');
      wrap.className = 'card-canvas-wrap';
      const canvas = document.createElement('canvas');
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      wrap.appendChild(canvas);

      card.appendChild(cardTitle);
      card.appendChild(wrap);
      grid.appendChild(card);

      // Render after append
      setTimeout(() => renderSketch(canvas, item.code), 0);

      // Click to expand
      card.addEventListener('click', () => {
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content');
        content.innerHTML = '';
        const fullCanvas = document.createElement('canvas');
        renderSketch(fullCanvas, item.code);
        fullCanvas.style.maxWidth = '95vw';
        fullCanvas.style.maxHeight = '90vh';
        fullCanvas.style.objectFit = 'contain';
        content.appendChild(fullCanvas);
        modal.classList.add('active');
      });
    }

    section.appendChild(grid);
    gallery.appendChild(section);
  }
}

// Modal close
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal').classList.remove('active');
});
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('modal').classList.remove('active');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('modal').classList.remove('active');
});

buildGallery();
</script>
</body>
</html>"""


class GalleryHandler(http.server.BaseHTTPRequestHandler):
    """Simple HTTP handler that serves the gallery page."""

    html_content = ""

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(self.html_content.encode("utf-8"))

    def log_message(self, format, *args):
        pass  # Suppress request logs


def main():
    sketches = scan_projects()
    if not sketches:
        print(f"No .voxi files found in {PROJECTS_DIR}")
        return

    print(f"Found {len(sketches)} sketches in {PROJECTS_DIR}")

    html = build_html(sketches)
    GalleryHandler.html_content = html

    server = http.server.HTTPServer(("", PORT), GalleryHandler)
    url = f"http://localhost:{PORT}"
    print(f"Gallery running at {url}")
    webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()


if __name__ == "__main__":
    main()

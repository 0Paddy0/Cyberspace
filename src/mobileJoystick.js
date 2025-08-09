export function createJoystick(rootEl = document.body) {
  const base = document.createElement('div');
  const knob = document.createElement('div');

  Object.assign(base.style, {
    position:'fixed', left:'20px',
    bottom:'calc(20px + env(safe-area-inset-bottom))',
    width:'120px', height:'120px',
    borderRadius:'60px',
    background:'rgba(255,255,255,0.08)',
    backdropFilter:'blur(2px)',
    zIndex:20, touchAction:'none', userSelect:'none'
  });
  Object.assign(knob.style, {
    position:'absolute', left:'50%', top:'50%',
    width:'56px', height:'56px',
    marginLeft:'-28px', marginTop:'-28px',
    borderRadius:'28px',
    background:'rgba(255,255,255,0.25)',
    boxShadow:'0 0 8px rgba(0,0,0,0.35)'
  });
  base.appendChild(knob);
  rootEl.appendChild(base);

  const radius = 50;
  let active = false;
  let center = {x:0,y:0};
  let value  = {x:0,y:0};

  const clamp = (v,m)=>Math.max(-m, Math.min(m, v));
  const setKnob = (dx,dy)=>{ knob.style.transform = `translate(${dx}px, ${dy}px)`; };

  function getPoint(e){
    if (e.touches && e.touches[0]) return e.touches[0];
    return e;
  }

  function start(e){
    active = true;
    const r = base.getBoundingClientRect();
    center = { x: r.left + r.width/2, y: r.top + r.height/2 };
    move(e);
  }

  function move(e){
    if(!active) return;
    const p = getPoint(e);
    const dx = clamp(p.clientX - center.x, radius);
    const dy = clamp(p.clientY - center.y, radius);
    setKnob(dx, dy);
    value = { x: +(dx / radius).toFixed(3), y: +(-dy / radius).toFixed(3) };
    if (e.cancelable) e.preventDefault();
  }

  function end(){
    active = false;
    value = {x:0,y:0};
    setKnob(0,0);
  }

  base.addEventListener('pointerdown', start, { passive:false });
  window.addEventListener('pointermove', move, { passive:false });
  window.addEventListener('pointerup', end, { passive:true });
  window.addEventListener('pointercancel', end, { passive:true });

  // Touch-Fallback (ältere iOS-Versionen)
  base.addEventListener('touchstart', start, { passive:false });
  window.addEventListener('touchmove',   move, { passive:false });
  window.addEventListener('touchend',    end,  { passive:true });
  window.addEventListener('touchcancel', end,  { passive:true });

  return {
    /** Gibt Vektor {x,y} in [-1..1] zurück. y>0 = nach oben/vorwärts */
    get(){ return value; },
    /** Optional: Position/Farbe anpassen */
    setStyle(s){ Object.assign(base.style, s.base||{}); Object.assign(knob.style, s.knob||{}); },
    /** Entfernen */
    destroy(){ base.remove(); window.removeEventListener('pointermove', move); }
  };
}

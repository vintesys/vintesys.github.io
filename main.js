// ======= ELEMENTOS =======
let workspace;
let outputEl, stageEl, ametechEl, speechEl, ametechTransformEl;
let ametechFacing = 'direita';

// Estado visual (na camada ametechTransform)
let _rotDeg = 0;
let _scale = 1;
let _visible = true;

// Fila para executar movimentos em sequência (sem interromper o anterior)
let _queue = Promise.resolve();

function logLine(line){
  const cur = outputEl.textContent || '';
  outputEl.textContent = (cur && !cur.endsWith('\n') ? cur+'\n' : cur) + line;
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function enqueue(fn){
  _queue = _queue.then(fn).catch(e => logLine('Erro interno: ' + (e?.message || String(e))));
  return _queue;
}

// ======= CENÁRIO =======
function setScene(key){
  stageEl.classList.remove('scene-base','scene-sala','scene-cidade');
  stageEl.classList.add('scene-' + (['base','sala','cidade'].includes(key)?key:'base'));
}

function applyTransform(){
  if (!ametechTransformEl) return;
  if (!_visible) {
    ametechTransformEl.style.display = 'none';
    return;
  }
  ametechTransformEl.style.display = '';
  ametechTransformEl.style.transform = `rotate(${_rotDeg}deg) scale(${_scale})`;
}

function resetStage(){
  _queue = Promise.resolve();
  outputEl.textContent = '// Cenário resetado. Pronto para uma nova missão.';
  setScene('base');

  // posição inicial
  ametechEl.style.left = '12%';
  ametechEl.style.bottom = '18%';
  ametechFacing = 'direita';

  // sprite para de andar
  const sprite = document.getElementById('ametechSprite');
  sprite.classList.remove('walking','dir-left','dir-right','jumping');

  // reset visual (giro/escala/visibilidade)
  _rotDeg = 0;
  _scale = 1;
  _visible = true;
  applyTransform();

  // remove classe do pulo no wrapper
  ametechEl.classList.remove('jumping');

  speechEl.textContent = '';
  speechEl.classList.add('empty');
}

// ======= FALA =======
function ametechSay(text){
  speechEl.textContent = String(text ?? '');
  speechEl.classList.toggle('empty', !speechEl.textContent.trim());
  logLine('Ametech: ' + speechEl.textContent);
}
function ametechClearSpeech(){
  speechEl.textContent = '';
  speechEl.classList.add('empty');
  logLine('Balão de fala apagado.');
}

// ======= CAMINHADA (direção + frames) =======
function setFacing(dir){
  if (dir !== 'esquerda' && dir !== 'direita') return;
  ametechFacing = dir;
}

function setWalking(active){
  const sprite = document.getElementById('ametechSprite');
  if (!sprite) return;

  if (active){
    sprite.classList.add('walking');
    sprite.classList.remove('dir-left','dir-right');
    sprite.classList.add(ametechFacing === 'esquerda' ? 'dir-left' : 'dir-right');
  } else {
    sprite.classList.remove('walking','dir-left','dir-right');
  }
}

// ======= MOVIMENTO =======
// mapeia (x,y) 0..100 para % do palco
function toLeftPercent(x){ return 5 + Math.max(0,Math.min(100,Number(x)||0))*0.7; }
function toBottomPercent(y){ return 8 + Math.max(0,Math.min(100,Number(y)||0))*0.6; }

function getPos(){
  const left = parseFloat(ametechEl.style.left || '12') || 12;
  const bottom = parseFloat(ametechEl.style.bottom || '18') || 18;
  return { left, bottom };
}

// Move contínuo (para x/y)
function ametechMoveTo(x, y){
  return enqueue(async () => {
    const targetLeft = toLeftPercent(x);
    const targetBottom = toBottomPercent(y);

    const { left: curLeft, bottom: curBottom } = getPos();

    const dx = targetLeft - curLeft;
    if (Math.abs(dx) > 0.2) setFacing(dx < 0 ? 'esquerda' : 'direita');

    const dist = Math.sqrt(dx*dx + Math.pow(targetBottom-curBottom,2));
    const duration = Math.max(280, Math.min(1200, dist * 14));

    ametechEl.style.transition = `left ${duration}ms linear, bottom ${duration}ms linear`;
    setWalking(true);

    ametechEl.style.left = targetLeft + '%';
    ametechEl.style.bottom = targetBottom + '%';

    await sleep(duration);
    setWalking(false);

    logLine(`Ametech se moveu para (x:${x}, y:${y}).`);
  });
}

// Passos discretos (efeito real de passo, não slide)
function ametechStep(direction, steps){
  return enqueue(async () => {
    const n = Math.max(0, Math.floor(Number(steps)||0));
    if (n === 0){
      logLine(`Ametech deu 0 passos para ${direction}.`);
      return;
    }

    // Ajuste fino do "feeling"
    const stepSize = 0.75;   // % por passo
    const stepMs = 170;      // ms por passo

    let { left, bottom } = getPos();

    if (direction === 'direita' || direction === 'esquerda') setFacing(direction);

    ametechEl.style.transition = `left ${stepMs}ms linear, bottom ${stepMs}ms linear`;
    setWalking(true);

    for (let i=0;i<n;i++){
      if (direction === 'direita') left += stepSize;
      if (direction === 'esquerda') left -= stepSize;
      if (direction === 'cima') bottom += stepSize;
      if (direction === 'baixo') bottom -= stepSize;

      left = Math.max(0, Math.min(90, left));
      bottom = Math.max(0, Math.min(80, bottom));

      ametechEl.style.left = left + '%';
      ametechEl.style.bottom = bottom + '%';

      // eslint-disable-next-line no-await-in-loop
      await sleep(stepMs);
    }

    setWalking(false);
    logLine(`Ametech deu ${n} passos para ${direction}.`);
  });
}

function ametechCenter(){ return ametechMoveTo(40,25); }
function ametechSetBackground(tipo){ setScene(tipo); logLine('Cenário alterado para: ' + tipo + '.'); }

// ======= PULO (PADRÃO FIXO) =======
const JUMP_MS = 520;
const JUMP_HEIGHT = 28;

function setJumping(active) {
  const wrapper = document.getElementById('ametechWrapper');
  const sprite = document.getElementById('ametechSprite');
  if (!wrapper || !sprite) return;

  if (active) {
    setWalking(false);

    wrapper.style.setProperty('--jump-ms', `${JUMP_MS}ms`);
    wrapper.style.setProperty('--jump-height', `${JUMP_HEIGHT}%`);

    wrapper.classList.add('jumping');
    sprite.classList.add('jumping');
  } else {
    wrapper.classList.remove('jumping');
    sprite.classList.remove('jumping');
  }
}

function ametechJump() {
  return enqueue(async () => {
    setJumping(true);
    await sleep(JUMP_MS);
    setJumping(false);
    logLine('Ametech pulou.');
  });
}

// ======= APARÊNCIA (NOVO) =======
function ametechFaceRight(){
  setFacing('direita');
  logLine('Ametech virou para a direita.');
}
function ametechFaceLeft(){
  setFacing('esquerda');
  logLine('Ametech virou para a esquerda.');
}

function ametechFaceFromRotation(){
  // Baseado no giro: 0=dir, 90=baixo, 180=esq, 270=cima
  const q = rotationToQuadrant(_rotDeg);
  if (q === 'left') setFacing('esquerda');
  if (q === 'right') setFacing('direita');
  // up/down: mantém a última face, para não “quebrar” sprite.
  logLine('Face ajustada a partir do giro.');
}

function ametechSetSize(sizeKey){
  const key = String(sizeKey || 'normal');
  if (key === 'pequeno') _scale = 0.85;
  else if (key === 'grande') _scale = 1.15;
  else _scale = 1;
  applyTransform();
  logLine('Tamanho do Ametech: ' + key + '.');
}
function ametechShow(){
  _visible = true;
  applyTransform();
  logLine('Ametech apareceu.');
}
function ametechHide(){
  _visible = false;
  applyTransform();
  logLine('Ametech ficou escondido.');
}

// ======= GIRO (NOVO) =======
function normDeg(d){
  let x = Number(d) || 0;
  x = ((x % 360) + 360) % 360;
  return x;
}
function ametechSetRotation(deg){
  _rotDeg = normDeg(deg);
  applyTransform();
  logLine('Ametech girou para ' + _rotDeg + '°.');
}
function ametechRotateBy(delta){
  _rotDeg = normDeg(_rotDeg + (Number(delta) || 0));
  applyTransform();
  logLine('Ametech girou. Agora está em ' + _rotDeg + '°.');
}
function ametechResetRotation(){
  _rotDeg = 0;
  applyTransform();
  logLine('Giro resetado (0°).');
}
function ametechTurnRandom(){
  const choices = [0, 90, 180, 270];
  const deg = choices[Math.floor(Math.random() * choices.length)];
  ametechSetRotation(deg);
  logLine('Ametech girou aleatoriamente.');
}

function rotationToQuadrant(deg){
  const d = normDeg(deg);
  // Aproxima para o mais próximo de 0/90/180/270
  const snaps = [0, 90, 180, 270];
  let best = 0, bestDist = 9999;
  for (const s of snaps){
    const dist = Math.min(Math.abs(d - s), 360 - Math.abs(d - s));
    if (dist < bestDist){ bestDist = dist; best = s; }
  }
  if (best === 0) return 'right';
  if (best === 90) return 'down';
  if (best === 180) return 'left';
  return 'up';
}

// ======= MOVIMENTO ORIENTADO AO GIRO (NOVO, SEM QUEBRAR O ATUAL) =======
function ametechMoveForward(steps){
  // Interpretação segura: 0=dir, 90=baixo, 180=esq, 270=cima
  const q = rotationToQuadrant(_rotDeg);
  if (q === 'right') return ametechStep('direita', steps);
  if (q === 'left') return ametechStep('esquerda', steps);
  if (q === 'up') return ametechStep('cima', steps);
  return ametechStep('baixo', steps);
}
function ametechMoveBackward(steps){
  const q = rotationToQuadrant(_rotDeg);
  if (q === 'right') return ametechStep('esquerda', steps);
  if (q === 'left') return ametechStep('direita', steps);
  if (q === 'up') return ametechStep('baixo', steps);
  return ametechStep('cima', steps);
}
function ametechRandomWalk(steps){
  return enqueue(async () => {
    const n = Math.max(0, Math.floor(Number(steps)||0));
    const dirs = ['direita','esquerda','cima','baixo'];
    for (let i=0;i<n;i++){
      const d = dirs[Math.floor(Math.random()*dirs.length)];
      // eslint-disable-next-line no-await-in-loop
      await ametechStep(d, 1);
    }
    logLine('Caminhada aleatória concluída.');
  });
}
function ametechBounceOnce(){
  // “Bate na borda e volta 3 passos” (didático e seguro)
  return enqueue(async () => {
    if (ametechIsEdge()){
      logLine('Bateu na borda! Voltando...');
      // volta na direção oposta ao lado mais próximo (heurística simples)
      const { left, bottom } = getPos();
      if (left <= 2) await ametechStep('direita', 3);
      else if (left >= 88) await ametechStep('esquerda', 3);
      else if (bottom <= 2) await ametechStep('cima', 3);
      else await ametechStep('baixo', 3);
    } else {
      logLine('Ametech não está na borda agora.');
    }
  });
}

// ======= SENSORES / CONDIÇÕES (NOVO) =======
function ametechGetX(){ return getPos().left; }
function ametechGetY(){ return getPos().bottom; }
function ametechGetRotation(){ return _rotDeg; }
function ametechIsVisible(){ return !!_visible; }

function ametechIsCenter(){
  // Centro “didático”: próximo do alvo do ametechCenter()
  const centerLeft = toLeftPercent(40);
  const centerBottom = toBottomPercent(25);
  const { left, bottom } = getPos();
  return Math.abs(left - centerLeft) <= 1.6 && Math.abs(bottom - centerBottom) <= 1.6;
}
function ametechIsEdge(){
  const { left, bottom } = getPos();
  return (left <= 1.0 || left >= 89.0 || bottom <= 1.0 || bottom >= 79.0);
}

// “Esperar até …” com timeout para não travar
async function waitUntil(predicateFn, label, timeoutMs = 6000){
  const tickMs = 80;
  const start = Date.now();
  while (Date.now() - start < timeoutMs){
    if (predicateFn()) return true;
    // eslint-disable-next-line no-await-in-loop
    await sleep(tickMs);
  }
  logLine(`(Aviso) Tempo esgotado esperando: ${label}.`);
  return false;
}

function ametechWaitUntilCenter(){
  return enqueue(async () => {
    logLine('Aguardando Ametech chegar no centro...');
    await waitUntil(ametechIsCenter, 'chegar no centro');
    logLine('Pronto (centro).');
  });
}

function ametechWaitUntilEdge(){
  return enqueue(async () => {
    logLine('Aguardando Ametech chegar na borda...');
    await waitUntil(ametechIsEdge, 'chegar na borda');
    logLine('Pronto (borda).');
  });
}

// Laços “didáticos” prontos com limite (evita travamentos)
function ametechRepeatUntilEdge(maxSteps){
  return enqueue(async () => {
    const max = Math.max(1, Math.floor(Number(maxSteps)||20));
    logLine(`Repetindo até borda (máx ${max} passos)...`);
    for (let i=0;i<max;i++){
      if (ametechIsEdge()) { logLine('Chegou na borda!'); return; }
      // eslint-disable-next-line no-await-in-loop
      await ametechMoveForward(1);
    }
    logLine('(Aviso) Não chegou na borda dentro do limite.');
  });
}

function ametechRepeatUntilCenter(maxSteps){
  return enqueue(async () => {
    const max = Math.max(1, Math.floor(Number(maxSteps)||20));
    logLine(`Repetindo até centro (máx ${max} passos)...`);
    for (let i=0;i<max;i++){
      if (ametechIsCenter()) { logLine('Chegou no centro!'); return; }
      // eslint-disable-next-line no-await-in-loop
      await ametechMoveForward(1);
    }
    logLine('(Aviso) Não chegou no centro dentro do limite.');
  });
}

// ======= TEMPO (NOVO) =======
function ametechWaitMs(ms){
  return enqueue(async () => {
    const t = Math.max(0, Math.floor(Number(ms)||0));
    await sleep(t);
    logLine(`Ametech esperou ${t} ms.`);
  });
}
function ametechWaitSeconds(sec){
  return enqueue(async () => {
    const s = Math.max(0, Number(sec)||0);
    const t = Math.floor(s * 1000);
    await sleep(t);
    logLine(`Ametech esperou ${s} s.`);
  });
}

// ======= SOM (NOVO) =======
let _audioCtx = null;
function getAudioCtx(){
  if (_audioCtx) return _audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  _audioCtx = new AC();
  return _audioCtx;
}

function ametechBeep(freq, ms){
  return enqueue(async () => {
    const ctx = getAudioCtx();
    if (!ctx){
      logLine('(Aviso) Áudio não suportado neste navegador.');
      return;
    }
    try { await ctx.resume(); } catch {}

    const f = Math.max(80, Math.min(2000, Number(freq)||880));
    const t = Math.max(40, Math.min(1200, Math.floor(Number(ms)||120)));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.value = 0.06;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    await sleep(t);
    osc.stop();

    logLine(`Som: bip (${f}Hz, ${t}ms).`);
  });
}

function ametechSuccessSound(){
  return enqueue(async () => {
    await ametechBeep(880, 90);
    await ametechBeep(1320, 110);
    logLine('Som de sucesso!');
  });
}

// ======= MISSÃO (NOVO) =======
function ametechMissionStart(){
  logLine('=== MISSÃO INICIADA ===');
}
function ametechMissionSuccess(){
  enqueue(async () => {
    logLine('=== MISSÃO CONCLUÍDA COM SUCESSO ===');
    await ametechSuccessSound();
    ametechSay('Missão completa!');
  });
}

// Cenário extra (aleatório/reset)
function ametechSetBackgroundRandom(){
  const choices = ['base','sala','cidade'];
  const pick = choices[Math.floor(Math.random()*choices.length)];
  ametechSetBackground(pick);
}
function ametechResetScene(){
  setScene('base');
  logLine('Cenário resetado para padrão.');
}

// ======= BLOCKLY: BLOCO CUSTOM =======
function defineBlocks(){
  // ===== EXISTENTES =====
  Blockly.Blocks['ametech_say'] = {
    init(){
      this.appendDummyInput()
        .appendField('Ametech fala')
        .appendField(new Blockly.FieldTextInput('Olá!'),'TEXT');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    }
  };
  Blockly.JavaScript['ametech_say'] = (b) =>
    `ametechSay(${JSON.stringify(b.getFieldValue('TEXT')||'')});\n`;

  Blockly.Blocks['ametech_move_to'] = {
    init(){
      this.appendDummyInput().appendField('mover Ametech para');
      this.appendValueInput('X').setCheck('Number').appendField('x');
      this.appendValueInput('Y').setCheck('Number').appendField('y');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    }
  };
  Blockly.JavaScript['ametech_move_to'] = (b) => {
    const x = Blockly.JavaScript.valueToCode(b,'X',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    const y = Blockly.JavaScript.valueToCode(b,'Y',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `ametechMoveTo(${x}, ${y});\n`;
  };

  Blockly.Blocks['ametech_center'] = {
    init(){
      this.appendDummyInput().appendField('centralizar Ametech');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    }
  };
  Blockly.JavaScript['ametech_center'] = () => 'ametechCenter();\n';

  function simple(name,label,dir){
    Blockly.Blocks[name] = {
      init(){
        this.appendDummyInput().appendField('Ametech anda '+label);
        this.appendValueInput('STEPS').setCheck('Number').appendField('passos');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
      }
    };
    Blockly.JavaScript[name] = (b)=> {
      const st = Blockly.JavaScript.valueToCode(b,'STEPS',Blockly.JavaScript.ORDER_ATOMIC) || '0';
      return `ametechStep(${JSON.stringify(dir)}, ${st});\n`;
    };
  }

  simple('ametech_move_right_simple','para a direita','direita');
  simple('ametech_move_left_simple','para a esquerda','esquerda');
  simple('ametech_move_up_simple','para cima','cima');
  simple('ametech_move_down_simple','para baixo','baixo');

  Blockly.Blocks['ametech_set_background'] = {
    init(){
      this.appendDummyInput().appendField('mudar cenário para')
        .appendField(new Blockly.FieldDropdown([['padrão','base'],['sala de aula','sala'],['cidade','cidade']]),'TYPE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(140);
    }
  };
  Blockly.JavaScript['ametech_set_background'] = (b)=>
    `ametechSetBackground(${JSON.stringify(b.getFieldValue('TYPE')||'base')});\n`;

  Blockly.Blocks['ametech_clear_speech'] = {
    init(){
      this.appendDummyInput().appendField('apagar fala do Ametech');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(140);
    }
  };
  Blockly.JavaScript['ametech_clear_speech'] = ()=> 'ametechClearSpeech();\n';

  Blockly.Blocks['ametech_jump'] = {
    init(){
      this.appendDummyInput().appendField('Ametech pula');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    }
  };
  Blockly.JavaScript['ametech_jump'] = () => `ametechJump();\n`;

  // ===== NOVOS: TEMPO =====
  Blockly.Blocks['ametech_wait_ms'] = {
    init(){
      this.appendDummyInput().appendField('esperar');
      this.appendValueInput('MS').setCheck('Number').appendField('ms');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(50);
    }
  };
  Blockly.JavaScript['ametech_wait_ms'] = (b) => {
    const ms = Blockly.JavaScript.valueToCode(b,'MS',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `ametechWaitMs(${ms});\n`;
  };

  Blockly.Blocks['ametech_wait_seconds'] = {
    init(){
      this.appendDummyInput().appendField('esperar');
      this.appendValueInput('SEC').setCheck('Number').appendField('segundos');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(50);
    }
  };
  Blockly.JavaScript['ametech_wait_seconds'] = (b) => {
    const sec = Blockly.JavaScript.valueToCode(b,'SEC',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `ametechWaitSeconds(${sec});\n`;
  };

  Blockly.Blocks['ametech_wait_until_center'] = {
    init(){
      this.appendDummyInput().appendField('esperar até chegar no centro');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(50);
    }
  };
  Blockly.JavaScript['ametech_wait_until_center'] = () => `ametechWaitUntilCenter();\n`;

  Blockly.Blocks['ametech_wait_until_edge'] = {
    init(){
      this.appendDummyInput().appendField('esperar até chegar na borda');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(50);
    }
  };
  Blockly.JavaScript['ametech_wait_until_edge'] = () => `ametechWaitUntilEdge();\n`;

  // ===== NOVOS: APARÊNCIA =====
  Blockly.Blocks['ametech_face_right'] = {
    init(){
      this.appendDummyInput().appendField('virar para a direita');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(260);
    }
  };
  Blockly.JavaScript['ametech_face_right'] = ()=> `ametechFaceRight();\n`;

  Blockly.Blocks['ametech_face_left'] = {
    init(){
      this.appendDummyInput().appendField('virar para a esquerda');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(260);
    }
  };
  Blockly.JavaScript['ametech_face_left'] = ()=> `ametechFaceLeft();\n`;

  Blockly.Blocks['ametech_face_from_rotation'] = {
    init(){
      this.appendDummyInput().appendField('ajustar face pelo giro');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(260);
    }
  };
  Blockly.JavaScript['ametech_face_from_rotation'] = ()=> `ametechFaceFromRotation();\n`;

  Blockly.Blocks['ametech_set_size'] = {
    init(){
      this.appendDummyInput()
        .appendField('tamanho do Ametech')
        .appendField(new Blockly.FieldDropdown([
          ['pequeno','pequeno'],
          ['normal','normal'],
          ['grande','grande'],
        ]),'SIZE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(260);
    }
  };
  Blockly.JavaScript['ametech_set_size'] = (b)=>
    `ametechSetSize(${JSON.stringify(b.getFieldValue('SIZE')||'normal')});\n`;

  Blockly.Blocks['ametech_show'] = {
    init(){
      this.appendDummyInput().appendField('mostrar Ametech');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(260);
    }
  };
  Blockly.JavaScript['ametech_show'] = ()=> `ametechShow();\n`;

  Blockly.Blocks['ametech_hide'] = {
    init(){
      this.appendDummyInput().appendField('esconder Ametech');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(260);
    }
  };
  Blockly.JavaScript['ametech_hide'] = ()=> `ametechHide();\n`;

  // ===== NOVOS: GIRO =====
  Blockly.Blocks['ametech_turn_left_90'] = {
    init(){
      this.appendDummyInput().appendField('girar 90° para a esquerda');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(230);
    }
  };
  Blockly.JavaScript['ametech_turn_left_90'] = ()=> `ametechRotateBy(-90);\n`;

  Blockly.Blocks['ametech_turn_right_90'] = {
    init(){
      this.appendDummyInput().appendField('girar 90° para a direita');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(230);
    }
  };
  Blockly.JavaScript['ametech_turn_right_90'] = ()=> `ametechRotateBy(90);\n`;

  Blockly.Blocks['ametech_rotate_by'] = {
    init(){
      this.appendDummyInput().appendField('girar mais');
      this.appendValueInput('DEG').setCheck('Number').appendField('graus');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(230);
    }
  };
  Blockly.JavaScript['ametech_rotate_by'] = (b)=> {
    const deg = Blockly.JavaScript.valueToCode(b,'DEG',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `ametechRotateBy(${deg});\n`;
  };

  Blockly.Blocks['ametech_set_rotation'] = {
    init(){
      this.appendDummyInput().appendField('girar para');
      this.appendValueInput('DEG').setCheck('Number').appendField('graus');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(230);
    }
  };
  Blockly.JavaScript['ametech_set_rotation'] = (b)=> {
    const deg = Blockly.JavaScript.valueToCode(b,'DEG',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `ametechSetRotation(${deg});\n`;
  };

  Blockly.Blocks['ametech_reset_rotation'] = {
    init(){
      this.appendDummyInput().appendField('resetar giro (0°)');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(230);
    }
  };
  Blockly.JavaScript['ametech_reset_rotation'] = ()=> `ametechResetRotation();\n`;

  Blockly.Blocks['ametech_turn_random'] = {
    init(){
      this.appendDummyInput().appendField('girar aleatório');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(230);
    }
  };
  Blockly.JavaScript['ametech_turn_random'] = ()=> `ametechTurnRandom();\n`;

  // ===== NOVOS: MOVIMENTO ORIENTADO =====
  Blockly.Blocks['ametech_move_forward'] = {
    init(){
      this.appendDummyInput().appendField('andar para frente');
      this.appendValueInput('STEPS').setCheck('Number').appendField('passos');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    }
  };
  Blockly.JavaScript['ametech_move_forward'] = (b)=> {
    const st = Blockly.JavaScript.valueToCode(b,'STEPS',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `ametechMoveForward(${st});\n`;
  };

  Blockly.Blocks['ametech_move_backward'] = {
    init(){
      this.appendDummyInput().appendField('andar para trás');
      this.appendValueInput('STEPS').setCheck('Number').appendField('passos');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    }
  };
  Blockly.JavaScript['ametech_move_backward'] = (b)=> {
    const st = Blockly.JavaScript.valueToCode(b,'STEPS',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `ametechMoveBackward(${st});\n`;
  };

  Blockly.Blocks['ametech_random_walk'] = {
    init(){
      this.appendDummyInput().appendField('andar aleatório');
      this.appendValueInput('STEPS').setCheck('Number').appendField('passos');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    }
  };
  Blockly.JavaScript['ametech_random_walk'] = (b)=> {
    const st = Blockly.JavaScript.valueToCode(b,'STEPS',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `ametechRandomWalk(${st});\n`;
  };

  Blockly.Blocks['ametech_bounce_once'] = {
    init(){
      this.appendDummyInput().appendField('bater na borda e voltar');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    }
  };
  Blockly.JavaScript['ametech_bounce_once'] = ()=> `ametechBounceOnce();\n`;

  // ===== NOVOS: SENSORES =====
  Blockly.Blocks['ametech_get_x'] = {
    init(){
      this.appendDummyInput().appendField('posição X do Ametech');
      this.setOutput(true, 'Number');
      this.setColour(120);
    }
  };
  Blockly.JavaScript['ametech_get_x'] = ()=> ['ametechGetX()', Blockly.JavaScript.ORDER_FUNCTION_CALL];

  Blockly.Blocks['ametech_get_y'] = {
    init(){
      this.appendDummyInput().appendField('posição Y do Ametech');
      this.setOutput(true, 'Number');
      this.setColour(120);
    }
  };
  Blockly.JavaScript['ametech_get_y'] = ()=> ['ametechGetY()', Blockly.JavaScript.ORDER_FUNCTION_CALL];

  Blockly.Blocks['ametech_is_center'] = {
    init(){
      this.appendDummyInput().appendField('Ametech está no centro?');
      this.setOutput(true, 'Boolean');
      this.setColour(120);
    }
  };
  Blockly.JavaScript['ametech_is_center'] = ()=> ['ametechIsCenter()', Blockly.JavaScript.ORDER_FUNCTION_CALL];

  Blockly.Blocks['ametech_is_edge'] = {
    init(){
      this.appendDummyInput().appendField('Ametech está na borda?');
      this.setOutput(true, 'Boolean');
      this.setColour(120);
    }
  };
  Blockly.JavaScript['ametech_is_edge'] = ()=> ['ametechIsEdge()', Blockly.JavaScript.ORDER_FUNCTION_CALL];

  Blockly.Blocks['ametech_get_rotation'] = {
    init(){
      this.appendDummyInput().appendField('giro do Ametech (graus)');
      this.setOutput(true, 'Number');
      this.setColour(120);
    }
  };
  Blockly.JavaScript['ametech_get_rotation'] = ()=> ['ametechGetRotation()', Blockly.JavaScript.ORDER_FUNCTION_CALL];

  Blockly.Blocks['ametech_is_visible'] = {
    init(){
      this.appendDummyInput().appendField('Ametech está visível?');
      this.setOutput(true, 'Boolean');
      this.setColour(120);
    }
  };
  Blockly.JavaScript['ametech_is_visible'] = ()=> ['ametechIsVisible()', Blockly.JavaScript.ORDER_FUNCTION_CALL];

  // ===== NOVOS: DECISÃO =====
  Blockly.Blocks['ametech_if_center'] = {
    init(){
      this.appendDummyInput().appendField('se Ametech estiver no centro');
      this.appendStatementInput('DO').appendField('faça');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(0);
    }
  };
  Blockly.JavaScript['ametech_if_center'] = (b)=> {
    const branch = Blockly.JavaScript.statementToCode(b,'DO');
    return `if (ametechIsCenter()) {\n${branch}}\n`;
  };

  Blockly.Blocks['ametech_if_edge'] = {
    init(){
      this.appendDummyInput().appendField('se Ametech estiver na borda');
      this.appendStatementInput('DO').appendField('faça');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(0);
    }
  };
  Blockly.JavaScript['ametech_if_edge'] = (b)=> {
    const branch = Blockly.JavaScript.statementToCode(b,'DO');
    return `if (ametechIsEdge()) {\n${branch}}\n`;
  };

  // Se/Senão custom (recebe uma condição booleana)
  Blockly.Blocks['ametech_if_else_condition'] = {
    init(){
      this.appendValueInput('COND').setCheck('Boolean').appendField('se');
      this.appendStatementInput('DO').appendField('faça');
      this.appendStatementInput('ELSE').appendField('senão');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(0);
    }
  };
  Blockly.JavaScript['ametech_if_else_condition'] = (b)=> {
    const cond = Blockly.JavaScript.valueToCode(b,'COND',Blockly.JavaScript.ORDER_NONE) || 'false';
    const doBranch = Blockly.JavaScript.statementToCode(b,'DO');
    const elseBranch = Blockly.JavaScript.statementToCode(b,'ELSE');
    return `if (${cond}) {\n${doBranch}} else {\n${elseBranch}}\n`;
  };

  Blockly.Blocks['ametech_repeat_until_edge'] = {
    init(){
      this.appendDummyInput().appendField('repetir até a borda');
      this.appendValueInput('MAX').setCheck('Number').appendField('máx passos');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(0);
    }
  };
  Blockly.JavaScript['ametech_repeat_until_edge'] = (b)=> {
    const max = Blockly.JavaScript.valueToCode(b,'MAX',Blockly.JavaScript.ORDER_ATOMIC) || '20';
    return `ametechRepeatUntilEdge(${max});\n`;
  };

  Blockly.Blocks['ametech_repeat_until_center'] = {
    init(){
      this.appendDummyInput().appendField('repetir até o centro');
      this.appendValueInput('MAX').setCheck('Number').appendField('máx passos');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(0);
    }
  };
  Blockly.JavaScript['ametech_repeat_until_center'] = (b)=> {
    const max = Blockly.JavaScript.valueToCode(b,'MAX',Blockly.JavaScript.ORDER_ATOMIC) || '20';
    return `ametechRepeatUntilCenter(${max});\n`;
  };

  // ===== NOVOS: SOM =====
  Blockly.Blocks['ametech_beep'] = {
    init(){
      this.appendDummyInput().appendField('tocar bip');
      this.appendValueInput('FREQ').setCheck('Number').appendField('freq');
      this.appendValueInput('MS').setCheck('Number').appendField('ms');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(200);
    }
  };
  Blockly.JavaScript['ametech_beep'] = (b)=> {
    const f = Blockly.JavaScript.valueToCode(b,'FREQ',Blockly.JavaScript.ORDER_ATOMIC) || '880';
    const ms = Blockly.JavaScript.valueToCode(b,'MS',Blockly.JavaScript.ORDER_ATOMIC) || '120';
    return `ametechBeep(${f}, ${ms});\n`;
  };

  Blockly.Blocks['ametech_success_sound'] = {
    init(){
      this.appendDummyInput().appendField('som de sucesso');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(200);
    }
  };
  Blockly.JavaScript['ametech_success_sound'] = ()=> `ametechSuccessSound();\n`;

  // ===== NOVOS: MISSÃO =====
  Blockly.Blocks['ametech_mission_start'] = {
    init(){
      this.appendDummyInput().appendField('iniciar missão');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(165);
    }
  };
  Blockly.JavaScript['ametech_mission_start'] = ()=> `ametechMissionStart();\n`;

  Blockly.Blocks['ametech_mission_success'] = {
    init(){
      this.appendDummyInput().appendField('finalizar missão (sucesso)');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(165);
    }
  };
  Blockly.JavaScript['ametech_mission_success'] = ()=> `ametechMissionSuccess();\n`;

  // ===== NOVOS: CENÁRIO =====
  Blockly.Blocks['ametech_set_background_random'] = {
    init(){
      this.appendDummyInput().appendField('mudar cenário aleatório');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(140);
    }
  };
  Blockly.JavaScript['ametech_set_background_random'] = ()=> `ametechSetBackgroundRandom();\n`;

  Blockly.Blocks['ametech_reset_scene'] = {
    init(){
      this.appendDummyInput().appendField('resetar cenário (padrão)');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(140);
    }
  };
  Blockly.JavaScript['ametech_reset_scene'] = ()=> `ametechResetScene();\n`;
}

function initBlockly(){
  defineBlocks();
  workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox'),
    trashcan: true,
    scrollbars: true,
    zoom: { controls:true, wheel:true, startScale:0.9, maxScale:1.3, minScale:0.5 }
  });
}

function runCode(){
  outputEl.textContent = '';
  resetStage();

  let code = '';
  try { code = Blockly.JavaScript.workspaceToCode(workspace); }
  catch(e){ outputEl.textContent = 'Erro ao gerar código: ' + e.message; return; }

  logLine('// Código gerado:');
  logLine(code.trim() || '// (vazio)');
  logLine('\n// Executando...');

  try { eval(code); }
  catch(e){ logLine('Erro ao executar: ' + e.message); }
}

function showCode(){
  try { outputEl.textContent = Blockly.JavaScript.workspaceToCode(workspace) || '// vazio'; }
  catch(e){ outputEl.textContent = 'Erro: ' + e.message; }
}

// ======= BOOT =======
window.addEventListener('load', () => {
  outputEl = document.getElementById('output');
  stageEl = document.getElementById('stage');
  ametechEl = document.getElementById('ametechWrapper');
  ametechTransformEl = document.getElementById('ametechTransform');
  speechEl = document.getElementById('speechBubble');

  resetStage();
  initBlockly();

  document.getElementById('runBtn').addEventListener('click', runCode);

  // showBtn pode estar comentado no HTML; evita erro.
  const showBtn = document.getElementById('showBtn');
  if (showBtn) showBtn.addEventListener('click', showCode);

  document.getElementById('resetBtn').addEventListener('click', resetStage);
});

// ======= ELEMENTOS =======
let workspace;
let outputEl, stageEl, ametechEl, speechEl;
let ametechFacing = 'direita';

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
  sprite.classList.remove('walking','dir-left','dir-right');

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
    // garante uma direção única
    sprite.classList.remove('dir-left','dir-right');
    sprite.classList.add(ametechFacing === 'esquerda' ? 'dir-left' : 'dir-right');
  } else {
    sprite.classList.remove('walking','dir-left','dir-right');
  }
}

function setWalkingBack(on){
  const sprite = document.getElementById('ametechSprite');
  if (!sprite) return;

  if (on){
    // Não altera a orientação (facing). Usa sprite de costas.
    sprite.classList.remove('dir-left','dir-right');
    sprite.classList.add('walking','dir-back');
  } else {
    sprite.classList.remove('walking','dir-back');
  }
}

function setSpinning(dir, on){
  const sprite = document.getElementById('ametechSprite');
  if (!sprite) return;

  sprite.classList.remove('spinning','spin-left','spin-right');
  if (on){
    sprite.classList.add('spinning', dir === 'esquerda' ? 'spin-left' : 'spin-right');
  }
}


// ======= MOVIMENTO =======
// mapeia (x,y) 0..100 para % do palco
function toLeftPercent(x){ return 5 + Math.max(0,Math.min(100,Number(x)||0))*0.7; }
function toBottomPercent(y){ return 8 + Math.max(0,Math.min(100,Number(y)||0))*0.6; }

// Move contínuo (para x/y)
function ametechMoveTo(x, y){
  return enqueue(async () => {
    const targetLeft = toLeftPercent(x);
    const targetBottom = toBottomPercent(y);

    const curLeft = parseFloat(ametechEl.style.left || '12') || 12;
    const curBottom = parseFloat(ametechEl.style.bottom || '18') || 18;

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
    const stepMs = 170;      // ms por passo (mais alto = mais lento)

    let left = parseFloat(ametechEl.style.left || '12') || 12;
    let bottom = parseFloat(ametechEl.style.bottom || '18') || 18;

    // direção do sprite apenas em movimentos laterais
    if (direction === 'direita' || direction === 'esquerda') setFacing(direction);

    // transição curta por passo
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

      // espera terminar 1 passo antes do próximo
      // eslint-disable-next-line no-await-in-loop
      await sleep(stepMs);
    }

    setWalking(false);
    logLine(`Ametech deu ${n} passos para ${direction}.`);
  });
}


function ametechStepBack(steps){
  // "Andar para trás": movimento para cima (afastando no cenário) usando o sprite de costas.
  return enqueue(async () => {
    const n = Math.max(0, Math.floor(Number(steps)||0));
    if (n === 0){
      logLine('Ametech deu 0 passos para trás.');
      return;
    }

    const stepSize = 0.75;
    const stepMs = 170;

    let left = parseFloat(ametechEl.style.left || '12') || 12;
    let bottom = parseFloat(ametechEl.style.bottom || '18') || 18;

    ametechEl.style.transition = `left ${stepMs}ms linear, bottom ${stepMs}ms linear`;
    setWalking(false);
    setWalkingBack(true);

    for (let i=0;i<n;i++){
      bottom += stepSize; // para cima
      left = Math.max(0, Math.min(90, left));
      bottom = Math.max(0, Math.min(80, bottom));

      ametechEl.style.left = left + '%';
      ametechEl.style.bottom = bottom + '%';
      // eslint-disable-next-line no-await-in-loop
      await sleep(stepMs);
    }

    setWalkingBack(false);
    logLine(`Ametech deu ${n} passos para trás.`);
  });
}

function ametechSpin(dir){
  // dir: 'esquerda' | 'direita'
  return enqueue(async () => {
    const d = (dir === 'esquerda') ? 'esquerda' : 'direita';

    setWalking(false);
    setWalkingBack(false);
    setJumping(false);

    const wrapper = document.getElementById('ametechWrapper');
    if (wrapper) wrapper.style.setProperty('--spin-ms', '520ms');

    setSpinning(d, true);
    await sleep(520);
    setSpinning(d, false);

    setFacing(d);
    logLine('Ametech girou para a ' + (d === 'esquerda' ? 'esquerda' : 'direita') + '.');
  });
}

function ametechCenter(){ return ametechMoveTo(40,25); }
function ametechSetBackground(tipo){ setScene(tipo); logLine('Cenário alterado para: ' + tipo + '.'); }

// ======= BLOCKLY: BLOCO CUSTOM =======
function defineBlocks(){
  Blockly.Blocks['ametech_say'] = {
    init(){ this.appendDummyInput().appendField('Ametech fala').appendField(new Blockly.FieldTextInput('Olá!'),'TEXT');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(210); }
  };
  Blockly.JavaScript['ametech_say'] = (b) => `ametechSay(${JSON.stringify(b.getFieldValue('TEXT')||'')});\n`;

  Blockly.Blocks['ametech_move_to'] = {
    init(){ this.appendDummyInput().appendField('mover Ametech para');
      this.appendValueInput('X').setCheck('Number').appendField('x');
      this.appendValueInput('Y').setCheck('Number').appendField('y');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(210); }
  };
  Blockly.JavaScript['ametech_move_to'] = (b) => {
    const x = Blockly.JavaScript.valueToCode(b,'X',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    const y = Blockly.JavaScript.valueToCode(b,'Y',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `ametechMoveTo(${x}, ${y});\n`;
  };

  Blockly.Blocks['ametech_center'] = {
    init(){ this.appendDummyInput().appendField('centralizar Ametech');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(210); }
  };
  Blockly.JavaScript['ametech_center'] = () => 'ametechCenter();\n';

  Blockly.Blocks['ametech_step'] = {
    init(){ this.appendDummyInput().appendField('Ametech anda')
        .appendField(new Blockly.FieldDropdown([['para a direita','direita'],['para a esquerda','esquerda'],['para cima','cima'],['para baixo','baixo']]),'DIR');
      this.appendValueInput('STEPS').setCheck('Number').appendField('passos');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(210); }
  };
  Blockly.JavaScript['ametech_step'] = (b) => {
    const dir = b.getFieldValue('DIR') || 'direita';
    const st = Blockly.JavaScript.valueToCode(b,'STEPS',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `ametechStep(${JSON.stringify(dir)}, ${st});\n`;
  };

  function simple(name,label,dir){
    Blockly.Blocks[name] = { init(){ this.appendDummyInput().appendField('Ametech anda '+label);
      this.appendValueInput('STEPS').setCheck('Number').appendField('passos');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(210); } };
    Blockly.JavaScript[name] = (b)=> {
      const st = Blockly.JavaScript.valueToCode(b,'STEPS',Blockly.JavaScript.ORDER_ATOMIC) || '0';
      return `ametechStep(${JSON.stringify(dir)}, ${st});\n`;
    };
  }


  // Andar para trás (sprite de costas)
  Blockly.Blocks['ametech_step_back'] = {
    init(){
      this.appendDummyInput().appendField('Ametech anda para trás');
      this.appendValueInput('STEPS').setCheck('Number').appendField('passos');
      this.setPreviousStatement(true); this.setNextStatement(true);
      this.setColour(210);
    }
  };
  Blockly.JavaScript['ametech_step_back'] = (b) => {
    const st = Blockly.JavaScript.valueToCode(b,'STEPS',Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `ametechStepBack(${st});\n`;
  };

  // Giro (direita/esquerda) usando sprites dedicados
  Blockly.Blocks['ametech_spin_right'] = {
    init(){
      this.appendDummyInput().appendField('Ametech gira para a direita');
      this.setPreviousStatement(true); this.setNextStatement(true);
      this.setColour(210);
    }
  };
  Blockly.JavaScript['ametech_spin_right'] = () => `ametechSpin('direita');\n`;

  Blockly.Blocks['ametech_spin_left'] = {
    init(){
      this.appendDummyInput().appendField('Ametech gira para a esquerda');
      this.setPreviousStatement(true); this.setNextStatement(true);
      this.setColour(210);
    }
  };
  Blockly.JavaScript['ametech_spin_left'] = () => `ametechSpin('esquerda');\n`;

Blockly.Blocks['ametech_jump'] = {
  init() {
    this.appendDummyInput().appendField('Ametech pula');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(210);
  }
};

Blockly.JavaScript['ametech_jump'] = () => {
  return `ametechJump();\n`;
};





  simple('ametech_move_right_simple','para a direita','direita');
  simple('ametech_move_left_simple','para a esquerda','esquerda');
  simple('ametech_move_up_simple','para cima','cima');
  simple('ametech_move_down_simple','para baixo','baixo');

  Blockly.Blocks['ametech_set_background'] = {
    init(){ this.appendDummyInput().appendField('mudar cenário para')
        .appendField(new Blockly.FieldDropdown([['padrão','base'],['sala de aula','sala'],['cidade','cidade']]),'TYPE');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(140); }
  };
  Blockly.JavaScript['ametech_set_background'] = (b)=> `ametechSetBackground(${JSON.stringify(b.getFieldValue('TYPE')||'base')});\n`;

  Blockly.Blocks['ametech_clear_speech'] = {
    init(){ this.appendDummyInput().appendField('apagar fala do Ametech');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(140); }
  };
  Blockly.JavaScript['ametech_clear_speech'] = ()=> 'ametechClearSpeech();\n';
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

  try { eval(code); } // Blockly gera chamadas diretas às funções
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
  speechEl = document.getElementById('speechBubble');

  resetStage();
  initBlockly();

  document.getElementById('runBtn').addEventListener('click', runCode);
  document.getElementById('showBtn').addEventListener('click', showCode);
  document.getElementById('resetBtn').addEventListener('click', resetStage);
});


// ======= PULO =======
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


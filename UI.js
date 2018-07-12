var contrib = require('blessed-contrib');
var blessed = require('blessed');
var fs = require('fs');

var screen = blessed.screen();

var UI = {};
// 게임을 저장한다.
var savegame = function(){
  // 유전자(Genomes)를 json으로 저장합니다.
  var jsonGenomes = [];
  for (var k in UI.learner.genomes) {
    jsonGenomes.push(UI.learner.genomes[k].toJSON());
  }

  UI.logger.log('Saving '+jsonGenomes.length+' genomes...');

  // genomes 디렉토리 안에 파일을 저장합니다.
  // 파일 이름 : gen_세대수_현재시간.json
  var dir = './genomes';
  var fileName = dir + '/gen_'+UI.learner.generation+'_'+Date.now()+'.json';
  fs.writeFile(fileName, JSON.stringify(jsonGenomes), function (err){
    if (err) {
      UI.logger.log('Failed to save! '+err);
    } else {
      UI.logger.log('Saved to '+fileName);
    }
    // 초기화(Refresh)
    UI.refreshFiles();
  });

};


// UI 오브젝트 초기화
UI.init = function (gameManipulator, learner) {
  UI.gm = gameManipulator;
  UI.learner = learner;

  UI.grid = new contrib.grid({
    rows: 12,
    cols: 6,
    screen: screen
  });


  // 센서 입력값을 만든다
  UI.uiSensors = UI.grid.set(0, 0, 3, 6, contrib.bar, {
    label: 'Network Inputs',
    // bg: 'white',
    barWidth: 12,
    barSpacing: 1,
    xOffset: 0,
    maxHeight: 100,
  });


  // 로그Log) box를 생성한다.
  UI.logger = UI.grid.set(3, 0, 3, 6, contrib.log, {
    fg: 'green',
    selectedFg: 'green',
    label: 'Logs'
  });


  // 현재 점수와 시간 view를 생성한다.
  UI.uiScore = UI.grid.set(6, 0, 3, 3, blessed.Text, {
    label: 'Game Stats',
    // bg: 'green',
    fg: 'white',
    content: 'Loading...',
    align: 'center',
  });


  // 현재 유전자(Genomes) 정보를 보여줍니다.
  UI.uiGenomes = UI.grid.set(6, 3, 3, 3, blessed.Text, {
    label: 'Genome Stats',
    // bg: 'green',
    fg: 'white',
    content: 'Hey!',
    align: 'center',
  });


  // 유전자를 가져오는 Load Tree를 생성합니다
  UI.savesTree = UI.grid.set(9, 0, 3, 3, contrib.tree, {
    label: 'Saved Genomes',
  });


  // 유전자(Genomes)를 불러오는 콜백(callback) 그리고 tree에 forcusing
  screen.key(['l','L'], UI.savesTree.focus.bind(UI.savesTree));
  UI.savesTree.on('click', UI.savesTree.focus.bind(UI.savesTree));
  UI.savesTree.on('select', function (item){

    if (item.isFile) {
      var fileName = item.name;

      UI.logger.log('Loading genomes from file:');
      UI.logger.log(fileName);

      var genomes = require('./genomes/'+fileName);

      UI.learner.loadGenomes(genomes);
    } else {
      UI.refreshFiles();
    }
  });

  UI.refreshFiles();


  // Save 버튼 생성
  UI.btnSave = UI.grid.set(9, 3, 3, 3, blessed.box, {
    label: 'Save to File',
    bg: 'green',
    fg: 'red',
    content: '\n\n\n\nSave Genomes',
    align: 'center',
  });

  UI.btnSave.on('click', function(){
      savegame();
  });

 screen.key(['o','O'], function(){
   savegame();
 });

  screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
  });

  screen.key(['s'], function (ch, key){
    if (learner.state === 'STOP') {
      learner.state = 'LEARNING';
      gameManipulator.focusGame();
      learner.startLearning();
    } else {
      learner.state = 'STOP';
    }
  });

  screen.render();
};

// 전체 폴더를 읽어와 일치하는 Json 파일을 선택합니다.
UI.refreshFiles = function (){
  var files = [];
  var fileData = {
    name: 'Saved Files',
    extended: true,
    children: [{
      name: 'Refresh Folders'
    }]
  };

  // 유전자 세대 수를 트리(tree)를 가져옵니다.
  UI.logger.log('Reading genomes dir...');
  var files = fs.readdirSync('./genomes');
  for (var k in files) {
    if (files[k].indexOf('.json') >= 0) {

      fileData.children.push({
        name: files[k],
        isFile: true,
      });

    }
  }
  // 트리(tree)로 저장합니다.
  UI.savesTree.setData(fileData);
}


// UI 화면에 데이터를 업데이트하고 랜더링 합니다.
UI.render = function () {

  // 데이터 업데이트
  UI.uiSensors.setData({
    titles: ['Distance', 'Size', 'Speed', 'Activation'],
    data: [
      Math.round(UI.gm.sensors[0].value * 100),
      Math.round(UI.gm.sensors[0].size * 100),
      Math.round(UI.gm.sensors[0].speed * 100),
      Math.round(UI.gm.gameOutput * 100),
    ]
  })

  // 유전자(Genome) 정보와 점수를 설정합니다.
  var learn = UI.learner;
  var uiStats = '';
  uiStats += 'Status: ' + learn.state + '\n';
  uiStats += 'Fitness: ' + UI.gm.points + '\n';
  uiStats += 'GameStatus: ' + UI.gm.gamestate + '\n';
  uiStats += 'Generation: ' + learn.generation;
  uiStats += ' : ' + learn.genome + '/' + learn.genomes.length;
  UI.uiScore.setText(uiStats);

  if (UI.gm.gameOutput) {
    var str = '';
    str += 'Action: ' + UI.gm.gameOutputString + '\n';
    str += 'Activation: ' + UI.gm.gameOutput;
    UI.uiGenomes.setText(str);
  } else {
    UI.uiGenomes.setText('Loading...');
  }

  // screen 랜더링(Rendering) 합니다.
  screen.render();
}

// 연속적으로 screen 랜더링(Rendering) 합니다.
setInterval(UI.render, 25);

module.exports = UI;

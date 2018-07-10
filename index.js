var robot = require('robotjs');

var GameManipulator = require('./GameManipulator');
var Learner = require('./Learner');
var Scanner = require('./Scanner');
var UI = require('./UI');


// Robotjs를 설정합니다.
robot.setMouseDelay(1);


// 게임을 초기화합니다.
GameManipulator.findGamePosition();


// 게임을 찾습니다.
if (GameManipulator.offset) {
  // 센서의 시작점(감지가 올바르게 되는지)을 디버그하기 위해서는 다음의 라인의 주석을 해제합니다.
  // robot.moveMouse(GameManipulator.offset[0]+GameManipulator.sensors[0].offset[0],
  //    GameManipulator.offset[1] + GameManipulator.sensors[0].offset[1]);

  robot.moveMouse(GameManipulator.offset[0], GameManipulator.offset[1]);
} else {
  console.error('FAILED TO FIND GAME!');
  process.exit();
}


// UI 초기화
UI.init(GameManipulator, Learner);


// Learner 초기화
// 유전알고리즘(Genetic Algorithm)와 신경망(Neural Network))
Learner.init(GameManipulator, UI, 12, 4, 0.2);


// 게임의 상태와 센서를 읽어 들이는 것을 시작합니다.
setInterval(GameManipulator.readSensors, 40);
setInterval(GameManipulator.readGameState, 200);


// 게임 시작 (API 사용법의 예제)
/*
function startGame () {
  var game = Math.round(Math.random() * 100);

  UI.logger.log('Queuing start... ', game);

  GameManipulator.startNewGame(function() {
    UI.logger.log('Game HAS started!', game);
    GameManipulator.onGameEnd = function () {
      UI.logger.log('Game HAS ended!', game);

      startGame();
    }
  });
}
*/
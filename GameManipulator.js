var robot = require('robotjs');

// http://robotjs.io/docs/syntax#getscreensize
// Screen의 사이즈를 가져옵니다 Return은 스크린의 너비(width), 높이(height) 합니다.
var screenSize = robot.getScreenSize();

//http://asprise.com/scan/scannerjs/docs/html/scannerjs-sdk.html
var Scanner = require ('./Scanner');

// Dino 색 정의 이 색은 장애의 물의 색깔과 같다.
var COLOR_DINOSAUR = '535353';
var DARK_COLOR_DINO = 'ACACAC';

var GameManipulator = {

  // 게임의 위치를 저장한다(글로벌)
  offset: null,
  width: null,

  // 점프에 대한 포인트를 저장한다
  points: 0,

  // 이벤트 Listener
  onGameEnd: null,
  onGameStart: null,
  onSensorData: null,

  // Game 상태 데이터 
  gamestate: 'OVER',

  // 화면 상에서 GameOver Position
  gameOverOffset: [190, -75],

  // 센서에 대한 정보를 array로 저장합니다.
  // 각각의 위치는 offset이라는 글로벌 변수에 상대적인 위치로 저장됩니다.
  sensors: [
    {
      lastValue: 1,

      value: null,
      offset: [84, -15], // 64,-15
      step: [4, 0],
      length: 0.3,

      // Speed
      speed: 0,
      lastComputeSpeed: 0,

      // 화면 해상도에 따른 오브젝트(object)의 크기를 계산합니다.
      size: 0,
      computeSize: true,
    },
  ]
};

// dino의 위치를 찾습니다 (fast)
GameManipulator.findGamePosition = function () {
  var pos, dinoPos, skipXFast = 15;

  // 처음부터 스크린의 너비(widht) 만큼 scan을 시작합니다.
  for (var x = 20; x < screenSize.width; x+= skipXFast) {
    dinoPos = Scanner.scanUntil(
      // 시작 지점
      [x, 80],
      // 다음의 픽셀은 scan을 넘어갑니다.
      [0, skipXFast],
      // Dino의 색깔을 검색합니다
      COLOR_DINOSAUR,
      // 일반 모드(inverse 뒤집혀있는 경우)
      false,
      // 반복 수 제한
      500 / skipXFast);

    if (dinoPos) {
      break;
    }
  }

  // 찾지 못했다면 에러이므로 null 반환
  if (!dinoPos) {
    return null;
  }

  for (var x = dinoPos[0] - 50; x <= dinoPos[0]; x += 1) {
    pos = Scanner.scanUntil(
      // 시작 지점
      [x, dinoPos[1] - 2],
      // 다음의 픽셀은 scan을 넘어갑니다.
      [0, 1],
      // Dino의 색깔을 검색합니다
      COLOR_DINOSAUR,
      // 일반 모드(inverse 뒤집혀있는 경우)
      false,
      // 반복 수 제한
      100);

    if (pos) {
      break;
    }
  }

  // 찾지 못했다면 에러이므로 null 반환
  if (!pos) {
    return null;
  }

  // 게임의 끝을 찾습니다.
  var endPos = pos;

  while (robot.getPixelColor(endPos[0] + 3, endPos[1]) == COLOR_DINOSAUR) {
     endPos = Scanner.scanUntil(
        // 시작 지점
        [endPos[0] + 2, endPos[1]],
        // 다음의 픽셀은 scan을 넘어갑니다.
        [2, 0],
        // Searching Color
        COLOR_DINOSAUR,
        // 일반 모드(inverse 뒤집혀있는 경우)
        true,
        // 반복 수 제한
        600);
  }

  // 찾지 못했다면 에러이므로 null 반환
  if (!endPos) {
    return null;
  }

  // 글로벌 변수 액세스하여 저장합니다.
  GameManipulator.offset = pos;
  GameManipulator.width = 600; //endPos[0] - pos[0];

  return pos;
};


// 게임의 상태를 읽습니다.
// 게임이 끝났거나 플레이 중이라면
GameManipulator.readGameState = function () {
  // 게임 오버인지 읽습니다.
  var found = Scanner.scanUntil(
    [
      GameManipulator.offset[0] + GameManipulator.gameOverOffset[0],
      GameManipulator.offset[1] + GameManipulator.gameOverOffset[1]
    ],

    [2, 0], COLOR_DINOSAUR, false, 20);

  if (found && GameManipulator.gamestate != 'OVER') {
    GameManipulator.gamestate = 'OVER';

    // keys를 초기화 합니다.
    GameManipulator.setGameOutput(0.5);

    // 콜백(callback)을 트리거하고 초기화 합니다.
    GameManipulator.onGameEnd && GameManipulator.onGameEnd(GameManipulator.points);
    GameManipulator.onGameEnd = null;

    // console.log('GAME OVER: '+GameManipulator.points);

  } else if (!found && GameManipulator.gamestate != 'PLAYING') {
    GameManipulator.gamestate = 'PLAYING';

    // 점수를 초기화합니다.
    GameManipulator.points = 0;
    GameManipulator.lastScore = 0;

    // keys를 초기화 합니다.
    GameManipulator.setGameOutput(0.5);

    // 센서를 초기화합니다.
    GameManipulator.sensors[0].lastComputeSpeed = 0;
    GameManipulator.sensors[0].lastSpeeds = [];
    GameManipulator.sensors[0].lastValue = 1;
    GameManipulator.sensors[0].value = 1;
    GameManipulator.sensors[0].speed = 0;
    GameManipulator.sensors[0].size = 0;

    // Output flag 변수를 초기화 합니다.
    GameManipulator.lastOutputSet = 'NONE';

    // 콜백(callback)을 트리거하고 초기화 합니다.
    GameManipulator.onGameStart && GameManipulator.onGameStart();
    GameManipulator.onGameStart = null;

    // console.log('GAME RUNNING '+GameManipulator.points);
  }
}


// 새로운 게임을 시작하기 위해 호출합니다.
// 게임이 끝날 때까지 기다리고 next 콜백(callback)을 호출합니다.
var _startKeyInterval;
GameManipulator.startNewGame = function (next) {

  // 상태를 Refresh 합니다.
  GameManipulator.readGameState();

  // 게임이 이미 끝난 상태라면, space를 누릅니다.
  if (GameManipulator.gamestate == 'OVER') {
    clearInterval(_startKeyInterval);

    // start 콜백(callback)을 설정합니다.
    GameManipulator.onGameStart = function (argument) {
      clearInterval(_startKeyInterval);
      next && next();
    };

    // 반복적으로 space를 누르면 게임을 시작합니다.
    _startKeyInterval = setInterval(function (){
      // 여러번 재시작한 후 dino가 느리게 미끄러지기 때문에 페이지를 다시 로드(reload)하는 것이 좋습니다
      GameManipulator.reloadPage();
      setTimeout(function() {
        // 한번 리로드하면 0.5초 정도를 기다리고 게임을 시작해야 합니다.
          robot.keyTap(' ');
      }, 500);
    }, 300);

    // 상태를 Refresh 합니다.
    GameManipulator.readGameState();

  } else {
    // Dino가 죽을 것을 기다리거나, 재귀적(recursive) 액션을 호출합니다.
    GameManipulator.onGameEnd = function () {
      GameManipulator.startNewGame(next);
    }
  }


}

// 페이지를 리로드(reload)합니다.
GameManipulator.reloadPage = function ()
{
  // 플랫폼을 검색합니다.
  var platform = process.platform;

  if(/^win/.test(process.platform)) { //윈도우라면 ctrl+R
    robot.keyTap('r','control');
  } else if(/^darwin/.test(process.platform)) { // 아니라면 command+R
    robot.keyTap('r','command');
  }
}


// 센서 기반으로 point를 계산합니다.
//
// 일반적으로 센서를 통해서 물체(object)를 패스했는지 검사하고,
// 이전보다 값이 높은지 확인합니다.
GameManipulator.computePoints = function () {
  for (var k in GameManipulator.sensors) {
    var sensor = GameManipulator.sensors[k];

    if (sensor.value > 0.5 && sensor.lastValue < 0.3) {
      GameManipulator.points++;
      // console.log('POINTS: '+GameManipulator.points);
    }
  }
}

// 센서를 읽어들입니다.
//
// 센서는 컴퓨터 그래픽스의 ray-traces와 같습니다.
// https://en.wikipedia.org/wiki/Ray_tracing_(graphics)
// 시작점을 가지고 있고 검색에 제한을 갖습니다.
//
// 각각의 센서는 물체(object)의 거리, 속도, 크기에 관한 정보를 가져옵니다.
GameManipulator.readSensors = function () {
  var offset = GameManipulator.offset;

  var startTime = Date.now(); // 현재 시간

  for (var k in GameManipulator.sensors) {

    var sensor = GameManipulator.sensors[k];

    // 절대적 위치를 계산합니다.
    var start = [
      offset[0] + sensor.offset[0],
      offset[1] + sensor.offset[1],
    ];

    // 커서(cursor) 전달 계산
    var forward = sensor.value * GameManipulator.width * 0.8 * sensor.length;

    var end = Scanner.scanUntil(
        // 시작 위치
        [start[0], start[1]],
        // 다음의 픽셀은 scan을 넘어갑니다.
        sensor.step,
        // dino의 색을 검색합니다.
        COLOR_DINOSAUR,
        // 일반 모드(inverse 뒤집혀있는 경우)
        false,
        // 반복 수 제한
        (GameManipulator.width * sensor.length) / sensor.step[0]);

    // 마지막 valude를 저장합니다.
    sensor.lastValue = sensor.value;

    // 센서 값을 계산합니다.
    if (end) {
      sensor.value = (end[0] - start[0]) / (GameManipulator.width * sensor.length);

      // 장애물(obstacle)의 크기를 계산합니다
      var endPoint = Scanner.scanUntil(
        [end[0] + 75, end[1]],
        [-2, 0],
        COLOR_DINOSAUR,
        false,
        75 / 2
      );

      // 끝 지점이 아니라면, 시작점을 끝으로 설정합니다.
      if (!endPoint) {
        endPoint = end;
      }

      var sizeTmp = (endPoint[0] - end[0]) / 100.0;
      if (GameManipulator.points == sensor.lastScore) {
        // It's the same obstacle. Set size to "max" of both
        // 같은 장애물(obstacle)이다. 사이즈를 최대(max)로 설정합니다.
        sensor.size = Math.max(sensor.size, sizeTmp);
      } else {
        sensor.size = sizeTmp;
      }

      // 물체(object)가 같은지 확인하여 현재 점수를 사용합니다.
      sensor.lastScore = GameManipulator.points;

      // sensor.size = Math.max(sensor.size, endPoint[0] - end[0]);

    } else {
      sensor.value = 1;
      sensor.size = 0;
    }

    // 속도를 계산합니다.
    var dt = (Date.now() - sensor.lastComputeSpeed) / 1000;
    sensor.lastComputeSpeed = Date.now();

    if (sensor.value < sensor.lastValue) {
      // 속도 계산합니다.
      var newSpeed = (sensor.lastValue - sensor.value) / dt;

      sensor.lastSpeeds.unshift(newSpeed);

      while (sensor.lastSpeeds.length > 10) {
        sensor.lastSpeeds.pop();
      }

      // 평균을 계산합니다.
      var avgSpeed = 0;
      for (var k in sensor.lastSpeeds) {
        avgSpeed += sensor.lastSpeeds[k] / sensor.lastSpeeds.length;
      }

      sensor.speed = Math.max(avgSpeed - 1.5, sensor.speed);

    }

    // 센서 값의 길이와 크기를 저장합니다.
    sensor.size = Math.min(sensor.size, 1.0);

    startTime = Date.now();
  }

  // 점을 계산합니다.
  GameManipulator.computePoints();

  // 센서 콜백(callback) 호출한다.
  GameManipulator.onSensorData && GameManipulator.onSensorData();
}


// 게임을 액션으로 설정합니다.
// 값 :
// 0.00에서 0.45까지 : 아래로(DOWN)
// 0.45에서 0.55까지 : 아무 동작 없음
// 0.55에서 1.00까지 : 위로(UP JUMP)
var PRESS = 'down';
var RELEASE = 'up';

GameManipulator.lastOutputSet = 'NONE';
GameManipulator.lastOutputSetTime = 0;

GameManipulator.setGameOutput = function (output){

  GameManipulator.gameOutput = output;
  GameManipulator.gameOutputString = GameManipulator.getDiscreteState(output);

  if (GameManipulator.gameOutputString == 'DOWN') {
    // 비스듬한(Skew)
    robot.keyToggle('up', RELEASE);
    robot.keyToggle('down', PRESS);
  } else if (GameManipulator.gameOutputString == 'NORM') {
    // 아무것도 하지 않는다.
    robot.keyToggle('up', RELEASE);
    robot.keyToggle('down', RELEASE);
  } else {

    // 점프(JUMP)를 필터합니다.
    if (GameManipulator.lastOutputSet != 'JUMP') {
      GameManipulator.lastOutputSetTime = Date.now();
    }

    // 점프(JUMP)
    // 연속적으로 3초 이상 점프하지 않았다면
    if (Date.now() - GameManipulator.lastOutputSetTime < 3000) {
      robot.keyToggle('up', PRESS);
      robot.keyToggle('down', RELEASE);
    } else {
      robot.keyToggle('up', RELEASE);
      robot.keyToggle('down', RELEASE);
    }

  }

  GameManipulator.lastOutputSet = GameManipulator.gameOutputString;
}


// 액션 문자열을 실제 값으로 맵핑합니다.
GameManipulator.getDiscreteState = function (value){
  if (value < 0.45) {
    return 'DOWN'
  } else if(value > 0.55) {
    return 'JUMP';
  }

  return 'NORM';
}


// 시작점을 클릭합니다.
// 게임이 focuse된 것을 확신합니다.
GameManipulator.focusGame = function (){
  robot.moveMouse(GameManipulator.offset[0], GameManipulator.offset[1]);
  robot.mouseClick('left');
}

module.exports = GameManipulator;